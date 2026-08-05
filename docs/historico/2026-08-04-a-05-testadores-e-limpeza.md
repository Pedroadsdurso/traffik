# Histórico — 2026-08-04-a-05-testadores-e-limpeza

> Registro de sessão, mantido inteiro. Não é regra e não precisa estar
> carregado a cada sessão — mas é onde está o "por que ficou assim" de
> cada decisão do período, e várias delas voltaram a importar.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🔴 TESTES COM USUÁRIOS REAIS (04/08/2026) — as TRÊS RAÍZES

Primeira rodada com testadores de verdade. Os ~16 problemas relatados não são
16 causas: são **três**, e cada uma aparece em telas diferentes com cara
diferente. Classificar por raiz é o que evita consertar o mesmo defeito quatro
vezes e deixar a quinta ocorrência de pé.

### Raiz 1 — MAIS DE UMA IMPLEMENTAÇÃO DA MESMA CONTA

Já conhecida (foi assim que a tela de Áreas passou a dizer "Sem webhook" para
uma área com webhook), mas ainda não estava valendo para o **dinheiro**.

**Existem TRÊS "ROI" e TRÊS "lucro" no produto:**

| Onde | ROI | Lucro |
|---|---|---|
| Dashboard | `lucro líquido ÷ custoTotal` (`lib/financeiro.ts`) | líquido − anúncios − recorrentes |
| Gerenciador | `(faturamento − gasto) ÷ gasto` (`lib/ads/metrics.ts`) | bruto, sem taxas |
| Taxas e Despesas | — | `revenue − spend − expenses.total` (`useTraffikState`) |

> ⚠️ **A terceira reimplementa o cálculo e erra**: `expenses.total` é
> `fin.totalDescontos`, que **exclui as despesas recorrentes**. O painel mostra
> a linha "Despesas − R$ X" e **não a subtrai** do Lucro exibido. O mesmo erro
> está no tooltip do ROI (`spend + expenses.total`). Só não aparece para quem
> tem despesa zerada. E o painel não tem linha de coprodução nem custo de
> produto, então com esses cadastrados ele deixa de fechar visualmente.

### Raiz 2 — ATRIBUIÇÃO INCOMPLETA, tratada de 4 jeitos diferentes

A venda que não cola numa campanha existe, e **cada tela decide sozinha o que
fazer com ela**:

| Tela | O que faz com o não atribuível |
|---|---|
| Dashboard | soma tudo (correto: é nível de conta) |
| Gerenciador, nível campanha | ignora, e **herda dos filhos** com `\|\| agg.X` |
| Gerenciador, conjunto e anúncio | 🔴 `results: 0, revenue: 0` **fixos no código** |
| Funil | conta em etapas de fontes diferentes |

> ### 🔴 Conjunto e anúncio NUNCA tiveram faturamento
> `overview.ts` monta `adRows` e `adSetRows` com `results: 0, revenue: 0`
> literais. Não é o drill-down que "perde as métricas" — é que naquele nível o
> número nunca existiu. O drill-down só levou o usuário até onde o zero mora.

> ### ⚠️ `splitPipe` rejeita o ID e ACEITA o NOME
> `{{campaign.name}}|{{campaign.id}}` vira `campaignId: null` (bom, o id não é
> numérico) e `campaignName: "{{campaign.name}}"` (ruim: entra no balde de
> atribuição por nome). **Não existe verificação de chaves duplas nem de `%7B`
> em lugar nenhum** — nem no parser, nem em `/api/track/click`, nem na ingestão.
> Template não substituído significa que o clique **não veio de entrega de
> anúncio** (preview, crawler, link colado): o destino certo dele é tráfego
> direto.

### 🔴 Raiz 3 — CONTROLE QUE NÃO CONTROLA NADA

**A mais perigosa das três**, e a que motivou a varredura: são controles que o
usuário mexe acreditando ter mudado alguma coisa. Não há erro, não há log, e a
tela **confirma** a escolha — só o comportamento não muda.

> ### ⛔ É pior que código morto, e por um motivo específico
> Código inerte (os casos anteriores do PROCEDIMENTO) não faz nada e ninguém
> depende dele. Um **controle** inerte é pior: ele produz uma crença. O usuário
> desliga o rastreamento de uma conta, vê o toggle desligado, e **decide com
> base nisso**. A tela virou a fonte de uma informação falsa.
>
> **Ao entregar um controle, o teste não é "salva?" — é "quem LÊ o que ele
> salvou?".** É o mesmo `grep` do PROCEDIMENTO, aplicado do lado da escrita.

### Varredura completa dos controles (04/08/2026)

Todo `<Checkbox>`, `<Select>` e `role="switch"` do produto, rastreado até o
consumidor. **4 inertes de ~40.**

| Controle | Onde | Veredito |
|---|---|---|
| 🔴 **Toggle da aba Contas** | Gerenciador | **no-op absoluto** — `nivel` é `null` e o handler era `if (nivel) …`. ✅ **corrigido** |
| 🔴 **Rastreamento da conta** | Integrações › Anúncios | salva `trackingEnabled`, e **nada em `computeAdsOverview`/`computeDashboard` filtra por ele**. Desligar só afeta sincronizações futuras; a listagem e o gasto continuam |
| ✅ **Produtos da regra** | Regras | a gaveta gravava `targetProducts` (plural) e o motor lia `targetProduct` (**singular**, legado), que a gaveta nunca preenche. **Uma regra restrita a um produto agia sobre TODOS** — com o card escrevendo o nome escolhido. **Corrigido em 04/08/2026**: `produtosDaRegra()` une as duas colunas, e a prévia usa a mesma função |
| 🔴 **"Nome do dashboard"** | Notificações | `showDashboardName` é salvo, viaja no DTO e `dispatchNotification` usa os outros três `show*` e **não usa este** |
| ⚠️ "Fixar" | Gerenciador | inerte por decisão declarada (só de sessão) — não conta |
| ✅ demais ~35 | — | rastreados até um consumidor real |

> ⚠️ **Os dois primeiros são a mesma coluna vista dos dois lados**: um não
> chamava a action, o outro chamava e ninguém lia o resultado. Consertar só o
> toggle teria deixado o usuário com um controle que agora responde e continua
> sem efeito — que é pior, porque passa a parecer que funciona.

> ✅ **`targetProducts` foi ligado em 04/08/2026, e o que tornou isso barato foi
> a MEDIÇÃO.** O risco era mudar o escopo de regras já cadastradas em silêncio —
> nos dois sentidos, porque uma regra criada achando que era global e que passa
> a ser restrita também é mudança silenciosa. O `diag:testadores` respondeu
> **zero regras nos dois usuários**, então não havia comportamento existente
> para quebrar: sem migração, sem aviso, sem backfill.
>
> ⚠️ **Se houvesse regra ativa, o caminho seria outro** — avisar antes, ou fazer
> a UI dizer a verdade em vez de mudar o motor. Não repita o atalho sem refazer
> a contagem.

> ### 🔴 O que ESCONDEU este bug: `rule as unknown as RuleRow`
> O motor carrega as regras com `findMany` (sem `select`, então todas as colunas
> vêm) e converte com um **cast duplo**. É ele que fez `targetProducts` faltar
> na interface `RuleRow` sem o compilador dizer nada.
>
> **Coluna nova no schema precisa ser acrescentada à `RuleRow` à mão.** O cast
> não avisa — é a mesma família da armadilha do `pedidoId` fora do `select`,
> só que do lado do tipo em vez do lado da consulta.

### 🔴 7º caso do PROCEDIMENTO: comentário que afirma o CONTRÁRIO do código

`dispatchPixel.ts` enviava `eventId: sale.id` com o comentário
`// dedup com o pixel do navegador`. **A dedup do Purchase nunca funcionou** —
e não é regressão: está assim desde `f62d2db`, o primeiro commit do pixel.

`sale.id` é um cuid do nosso banco. Nenhum pixel de navegador consegue
reproduzi-lo, e o **nosso script nunca dispara `Purchase`** (é server-side; a
rota `/api/pixel/event` o recusa explicitamente). Nunca houve par para a Meta
juntar.

> ### ⛔ Os casos anteriores eram código INERTE. Este era código ATIVO com uma
> ### legenda falsa.
> Ele rodava, em toda venda, fazendo exatamente o que o código dizia — e o
> comentário descrevia um efeito que não existia. Todo mundo que leu aquela
> linha (inclusive eu, em três sessões) concluiu que a duplicata estava
> resolvida e foi procurar o problema em outro lugar.
>
> **Comentário que afirma um efeito é uma afirmação testável.** Se ele diz
> "isto deduplica", tem que existir o outro lado do par — e o `grep` que
> procura o outro lado leva 10 segundos.

**A correção é PARTIÇÃO**, não coordenação — não existe id compartilhável aqui.
Ver `lib/pixel/preset.ts`: o preset ganhou uma **segunda pergunta** ("alguém
mais já avisa o Facebook quando a venda é aprovada?") que decide o dono do
`Purchase`.

> ### ⛔ São DUAS perguntas porque são DUAS páginas
> `temPixelNativo` fala da **página de vendas**; o `Purchase` é disparado na
> **página de obrigado ou no checkout do gateway**, que quase nunca é do
> usuário. Derivar uma da outra erra nos dois sentidos: "tem pixel ⇒ ele manda
> o Purchase" faz quem só tem pixel na página de vendas **perder toda venda na
> Meta, em silêncio**; o contrário é o bug atual.

> ⚠️ **O padrão continua sendo "a Traffik envia"**, e é escolha: não enviar
> perde conversão sem nada denunciar; enviar duplicado aparece no Gerenciador
> de Eventos. Mesma regra do `lerDonos`. Por isso o **aviso âmbar aparece na
> resposta PADRÃO**, ao contrário de quase todo aviso do produto — é ela que
> custa caro quando está errada, e o usuário não tem como saber o que o
> checkout do gateway dele faz sem ir olhar.

> ### ⚠️ `Purchase` saiu da assinatura do script (detectores v3)
> O dono do Purchase **não muda o script** (ele nunca sai do navegador), mas
> entrava em `ORDEM_EVENTOS` e em `eventosAlheios` — então trocá-lo mudava o
> hash e a gaveta mandava **regerar e recolar o snippet à toa**. Aviso que às
> vezes mente treina o usuário a ignorar todos.
>
> `VERSAO` foi para `v3` e a comparação de `hashDonos` passou a exigir
> **mesma versão** nos dois lados: um script v2 instalado reporta um hash
> calculado sobre outro conjunto de eventos, e compará-lo acusaria divergência
> em 100% dos scripts v2 corretos.

### ⚡ O N+1 do sync saiu (04/08/2026)

`syncAccountMetrics` e `syncAccount` faziam **um `upsert` por linha de insight**,
em série. Conta com 48 anúncios × 2 dias = **96 idas ao Supabase**: a ~99 ms de
latência, ~9,5 s só de rede, dentro de um `after()` com `maxDuration`.

Medido em produção: as contas de **48 e 28 anúncios nunca gravaram métrica
nenhuma**; a de **4 anúncios** funcionava. É a assinatura de estouro de tempo —
a função morre, a reserva do `autoSync` fica presa até expirar (10 min), tenta
de novo e morre de novo.

Agora é `gravarMetricas()`: **uma instrução por lote de 500 linhas**.

> ### ⛔ `createMany({ skipDuplicates: true })` NÃO serve aqui
> Ele pula a linha que já existe — e a linha de HOJE sempre existe, porque o
> gasto do dia corrente é reescrito a cada ciclo enquanto a campanha entrega.
> **O gasto congelaria no primeiro valor do dia**, com o número continuando
> plausível. Tem de ser `ON CONFLICT DO UPDATE`.

> ### ⚠️ As duas colunas que o Prisma preenche e o SQL cru não
> | Coluna | Por que quebraria |
> |---|---|
> | `id` | `@default(cuid())` é gerado na APLICAÇÃO; no banco é `NOT NULL` **sem default** |
> | `updatedAt` | `@updatedAt` também é do cliente; o INSERT violaria `NOT NULL` e o UPDATE deixaria o valor velho |
>
> `timezone('UTC', now())` e não `now()`: a coluna é `timestamp WITHOUT time
> zone` guardando UTC, e `now()` seria convertido pelo fuso da SESSÃO.
>
> ⚠️ O dia viaja como **string `YYYY-MM-DD`** até o `::date` do SQL. O
> `new Date(ins.date_start)` que existia transformava o dia num instante — a
> origem clássica de bug de fuso neste projeto.

`npm run test:metricas-lote` — 16 asserções contra o banco de DEV: inserção,
atualização pelo `ON CONFLICT` (a que o `skipDuplicates` não faria), `id` e
`updatedAt` preenchidos, lote com conflito no meio, e nenhuma linha perdida.

### 🔴 RISCO: uma restrição no APP derruba TODOS os usuários de uma vez

Descoberto em 04/08/2026 num testador: a **conta de desenvolvedor** dele foi
restringida pela Meta. O token inteiro parou, e a Graph passou a responder
`(#200) … permission` **por conta** — a mensagem imprecisa de sempre.

> ### ⛔ Reconectar NÃO resolve enquanto a restrição durar
> É a única das três causas do `(#200)` em que o caminho óbvio falha. Quem
> tenta reconectar, vê falhar e não tem o que olhar em seguida fica sem saída —
> por isso a terceira hipótese entrou no texto de `erroMeta.ts`.

**O risco maior é estrutural e ainda não aconteceu.** Hoje cada testador precisa
de conta de desenvolvedor porque o app está em modo desenvolvimento. Aberto ao
público, os clientes não terão — mas **o nosso app pode ser restringido, e aí
todos param simultaneamente**.

| | Hoje (modo dev) | Aberto |
|---|---|---|
| Quem precisa de conta de desenvolvedor | cada testador | ninguém |
| Restrição derruba | um usuário | 🔴 **todos, ao mesmo tempo** |
| O que a tela diz | erro por perfil | o mesmo — e cada um acha que é problema dele |

⚠️ **O que falta:** quando N usuários falham com a mesma mensagem na mesma
janela, a causa é nossa, não deles. A ferramenta precisa dizer isso — hoje ela
manda cada um conferir o próprio Business Manager. Não implementado; o sinal já
existe no banco (`AdProfile.lastDiscoveryError` + `AdAccount.lastSyncError`),
então é consulta de agregação, não coluna nova.

### ⏳ Backoff das tentativas — `lib/facebook/backoff.ts`

A conta do testador acumulou **50 tentativas** contra um erro que não passa
sozinho. Erro de permissão não se resolve tentando de novo em 20 s.

| Falhas seguidas | Espera |
|---|---|
| 0–2 | nenhuma (pode ser rede, blip da Meta) |
| 3–9 | 5 min |
| 10–29 | 30 min |
| 30+ | 2 h (teto) |

> ### ⚠️ O motivo NÃO é economizar chamada
> O rate limit da Graph é **por APP**. Uma conta em repetição queima cota que é
> de todos — com N clientes, um token quebrado degrada a sincronização dos
> outros.

> ### ⛔ Três coisas que NÃO podem mudar
> 1. **O botão "Sincronizar" ignora o backoff.** Quem acabou de arrumar precisa
>    conferir na hora; 2 h de espera no clique manual faria a correção parecer
>    que não funcionou. (`syncSingleAccount` não passa pelos laços.)
> 2. **Reconectar ZERA os contadores** — inclusive o erro do perfil. O ato de
>    reconectar é a evidência de que a causa mudou.
> 3. **Estar em espera não esconde a conta nem o erro.** A linha continua na
>    tela, com o motivo e um "nova tentativa em ~28 min". Conta que para de
>    tentar sem dizer que vai voltar é indistinguível de conta esquecida.
>
> ⚠️ O teto de 2 h existe para a volta ser detectada **sozinha**: liberada a
> restrição, o sync retoma em no máximo duas horas sem ninguém clicar.
>
> ⚠️ `emEspera` entra no `SyncSummary` para `accounts: 0` não parecer "não achou
> conta nenhuma" quando o que houve foi backoff.

`npm run test:backoff` — 16 asserções, incluindo o estado inconsistente
(contador sem data) que erra para o lado de TENTAR: travar uma conta para
sempre por causa de dado incompleto seria pior que uma tentativa a mais.

### ✅ Status de conta, tradução, backoff e reset — EXERCIDOS em produção (04/08)

Com dado real de outro usuário, e três dos casos foram os de borda que o
desenho previa:

| Observado | O que valida |
|---|---|
| `"1"` → **Desabilitada**, com bloco traduzido e sem tentar mais | `account_status: 2` + backoff |
| Conta 1 → **Pagamento pendente**, 48 anúncios, 0 métricas | `account_status: 3` |
| Contas 2 e 3 → **Ativa** | `account_status: 1` |
| Perfil → sem aviso | `lastDiscoveryError` limpo pelo reconectar |

> ### ✅ "Pagamento pendente" prova a distinção que quase se perdeu
> `account_status: 3` **para de veicular e continua legível pela API**. Se
> `sincroniza` fosse `false` para ele — o que parece natural, já que a conta
> "não está ativa" —, a ferramenta teria escondido o **gasto histórico** dela.
> A separação entre "não veicula" e "não sincroniza" não era teoria.

### 🔴 O PRODUTO AINDA DEPENDE DE ALGUÉM MANDAR CLICAR

O testador só descobriu porque foi instruído a clicar em "Sincronizar".
Sozinho, ele veria **três contas com zero métrica** e concluiria que a
ferramenta não funciona.

A causa: **o auto-sync pede só `DIAS_AUTO = 2`**. Conta sem gasto nas últimas
48h nunca recebe linha nenhuma — e o histórico só entra pelo cron `?full=1` ou
pelo botão manual.

⚠️ E hoje **"sem gasto no período" e "ainda não buscamos o histórico" são
indistinguíveis na tela**: as duas mostram zero.

### 🔴🔴 DOIS AGENDADORES RODANDO AO MESMO TEMPO (descoberto em 05/08/2026)

O usuário configurou o **cron-job.org** numa sessão anterior. O
`.github/workflows/cron.yml` **nunca foi removido** — e está ATIVO. Medido pela
API do GitHub: `state: "active"`, **291 execuções**, a mais recente minutos
antes da verificação.

> ⚠️ **A documentação daqui dizia que o Actions era a rede de segurança e não
> mencionava o cron-job.org.** Isso fez o usuário se preocupar com um risco que
> não existia (o Actions desativar por 60 dias sem commit) e **não ver o que
> existia** (os dois disparando as mesmas rotas).

**Nem toda rota sofre igual** — e a diferença é a proteção que cada uma tem:

| Rota | Chamada em dobro | Por quê |
|---|---|---|
| `/api/cron/sync-facebook` | ✅ **inofensiva** | `autoSyncSeNecessario` tem a reserva no banco e os intervalos. A segunda sai `pulado` |
| `/api/cron/manutencao` | ⚠️ desperdício | as consultas são idempotentes |
| `/api/cron/reports` | 🔴 **notificação duplicada** | `generate.ts` faz `notification.create` sem condição |
| `/api/cron/run-rules` | 🔴🔴 **AÇÃO EM DOBRO** | ver abaixo |

> ### 🔴 `run-rules` tem uma corrida de ler-checar-agir, e ela move dinheiro
> ```js
> if (rule.lastRunAt && now - rule.lastRunAt.getTime() < rule.frequencyMin * 60_000) continue;
> const result = await evaluateRule(rule);   // ← PAUSA CAMPANHA / MUDA ORÇAMENTO
> await prisma.$transaction([ log, update lastRunAt ]);   // ← só AGORA marca
> ```
> A frequência é checada, a **ação acontece**, e só depois `lastRunAt` é
> gravado. Dois chamadores simultâneos passam os dois pela checagem.
>
> Numa regra de `+50%` de orçamento, execução dupla dá **+125%**. O
> `maxBudget` limita o estrago; não o impede.
>
> ⚠️ **O `concurrency` do workflow não cobre isto** — ele impede o Actions de se
> sobrepor a si mesmo, não de coincidir com o cron-job.org.
>
> **O conserto é o padrão que esta base já usa três vezes** (reserva do
> auto-sync, upsert monotônico de venda, `garantirAreaPrincipal`): um
> `updateMany` condicional que reserva a execução ANTES de agir — quem recebe
> `count: 0` desiste. Quem decide o vencedor é o banco.

⚠️ **O que NÃO dá para saber daqui:** quais rotas o cron-job.org chama e com
qual frequência. É serviço externo, sem API configurada aqui. **Só o painel
dele responde.**

### 🔴🔴 TODA DESPESA CADASTRADA ERA IGNORADA NO LUCRO (05/08/2026)

O maior achado desta rodada, e ele estava lá **desde sempre**.

```ts
export function whereDespesasDaArea(areaId: string) {
  return { workspaceId: areaId };   // ← descarta as NULAS
}
```

E `Expense.workspaceId` **NULO significa "vale para TODAS as áreas"** — não
"sem dono". É a exceção que este arquivo já registrava. O formulário não prende
taxa a área nenhuma, então **toda despesa cadastrada era descartada** no
cálculo de lucro.

O lucro aparecia maior que a realidade, com número plausível. Reproduzido na
tela: cinco descontos cadastrados, painel mostrando `Taxas de gateway − R$ 0,00`
em todos.

> ### ⛔ O que o torna especialmente perigoso: estava nos DOIS filtros
> `whereDespesasDaArea` (o cálculo) e `whereDespesas` (a listagem) tinham o
> **mesmo erro**. Se fosse só no cálculo, o usuário veria a taxa na listagem e
> não no lucro — e desconfiaria. **Errados juntos, a divergência que denunciaria
> o erro não existe.**
>
> ### 🔴 REGRA: dois lugares que fazem o MESMO filtro compartilham a função
> Duplicá-la não produz duas chances de acertar — produz duas chances de errar
> **igual**, e destrói o único sinal que restaria.
>
> É o outro lado da regra que este arquivo já tinha ("duas fontes para a mesma
> pergunta divergem sempre"). A divergência é ruim quando as duas deveriam
> concordar; a **convergência** é pior quando ambas estão erradas — porque
> nenhuma checagem cruzada é possível.

### ⛔ REGRA: uma asserção precisa poder FALHAR pelo motivo que ela alega medir

Formulação do usuário, 05/08/2026, e é o critério que faltava:

> **Se os dois desfechos possíveis produzem o mesmo valor observado, a asserção
> não mede nada — passa por coincidência e quebra por acaso.**

O caso que revelou isso: `"produto renomeado degrada para o dono do webhook"`
mapeava o webhook para a **Principal**. Degradar para o webhook e cair na
Principal por engano davam o **mesmo `areaId`**. Verde por anos, sem nunca ter
exercido a distinção que dá nome ao teste.

⚠️ **Ao escrever asserção, pergunte qual valor o CASO ERRADO produziria.** Se
for igual ao do caso certo, o cenário está montado de forma que impede a falha
— e mais dado, mais execução ou mais tempo não consertam isso.

### ⛔ Teste que escolhe o próprio dado no backup REAL testa outra coisa a cada dia

`teste-atribuicao-areas.mjs` falhou três vezes e ficou três sessões sem
investigação — "quebra porque o backup mudou" vira ruído, e teste ruidoso é
teste ignorado.

Investigado em 05/08/2026, e a causa é pior que dado velho: **a asserção não
testava o que afirmava, nem quando passava.**

| | |
|---|---|
| O que ela dizia medir | "produto renomeado degrada para o dono do webhook" |
| Como estava montada | o webhook era mapeado para a **Principal** |
| Consequência | "degradou para o webhook" e "caiu na Principal por engano" davam o **mesmo `areaId`** — indistinguíveis |

Ela passava por coincidência (o `motivo` calhava de vir `"webhook"` naquele
dado) e quebrou quando o backup mudou. **Quebrar foi sorte.**

Havia ainda uma segunda dependência: ela mapeava `wh[0]` — o primeiro webhook
do usuário — e atribuía uma venda escolhida à parte. Se a venda viesse de outro
webhook, o mapeamento não se aplicava.

> ### ⛔ A escolha entre congelar fixture e reescrever a asserção
> **Congelar um backup como fixture foi RECUSADO.** Ele resolveria o sintoma
> (parar de quebrar) e manteria o defeito: a asserção continuaria sem separar o
> caso certo do errado, só que sobre dado que nunca muda — teste verde para
> sempre, medindo nada.
>
> A asserção foi reescrita para o cenário ser **sintético e explícito**: o
> webhook DA PRÓPRIA VENDA vai para uma área nomeada, e a asserção verifica que
> a venda cai nela e **não** na Principal. Sem depender de qual venda ou qual
> webhook o backup traz.
>
> ⚠️ **O resto da suíte continua rodando contra o backup REAL**, e deve
> continuar: as verificações de partição (nada se perde, nada é contado duas
> vezes) só têm valor sobre dado de verdade. O que sai do backup é a escolha do
> CENÁRIO, não os dados do teste.

### ⛔ PADRÃO: mudar QUANDO o estado é gravado pode criar silêncio novo

Descoberto em 05/08/2026, numa correção minha e no mesmo dia em que ela subiu.

A corrida de ler-checar-agir do `run-rules` foi consertada movendo a gravação
de `lastRunAt` para **antes** da ação. A reserva estava certa. O que faltou foi
olhar o que acontecia **depois** dela:

| | Antes da reserva | Depois |
|---|---|---|
| `evaluateRule` lança | `lastRunAt` intacto → tenta de novo no ciclo seguinte | `lastRunAt` **já avançado** → pula a janela inteira |
| Registro | nenhum (tolerável — ia tentar de novo) | nenhum (**silêncio**, e a regra não roda) |

O usuário veria *"última execução há 30 min"* e concluiria que rodou normal.

> **Uma correção que muda o MOMENTO em que o estado é gravado transforma o
> significado de todo caminho de erro que passa por ali.** O erro que era
> tolerável — porque seria repetido — vira erro definitivo e mudo.
>
> ⚠️ Ao mover uma gravação para antes de uma operação, **liste o que pode falhar
> entre as duas** e decida o que cada falha significa agora. Aqui a resposta foi
> um `try/catch` que registra `status: "ERRO"` no histórico da regra.

É primo da regra do `NULL` (o mesmo valor significando coisas diferentes em
colunas diferentes): aqui é o mesmo CÓDIGO significando coisas diferentes
antes e depois de uma mudança de ordem.

### ✅ `userTimezone` caía em São Paulo EM SILÊNCIO — resolvido em 05/08/2026

> ### ⛔ Com usuário fora do Brasil, isso deixa de ser fallback e vira ERRO EM TUDO
> O fuso decide onde o dia começa. Ele não afeta um número: afeta **todos** —
> janela do período, `byHour`, `byDay`, buckets do gráfico, a janela de
> comparação dos deltas, o `time_range` mandado à Meta, o limite diário do motor
> de regras e a hora do relatório. É a seção "Fuso horário — causa raiz" inteira,
> reintroduzida por um `catch`.
>
> E é **sistemático, não intermitente**: quem está em Lisboa vê todo dia
> começando 4h cedo, sempre.

**A correção veio em duas etapas, e a segunda é a que importa:**

| Etapa | O quê |
|---|---|
| `33638c4` | `console.error` nos dois casos de **DEFEITO** (string corrompida, falha de leitura) |
| **05/08/2026** | aviso **na tela**, para o caso que não é defeito — o **padrão** |

> ### 🔴 O caso perigoso nunca foi o `catch`, foi o `@default`
> `User.timezone` é `@default("America/Sao_Paulo")` e **não é nulo nunca**, então
> "escolhi Brasília" e "nunca abri esta tela" são **indistinguíveis no banco** —
> não há como logar "usei o fallback", porque do ponto de vista do código não
> houve fallback nenhum. E log de servidor não é lido por quem usa a ferramenta.
>
> Quem sabe a resposta é o **navegador**. O card "Fuso horário" compara com
> `Intl.DateTimeFormat().resolvedOptions().timeZone` e oferece a troca num
> clique. Ver "O FUSO CAI NO PADRÃO EM SILÊNCIO — agora a tela diz".

### ✅ VALIDADO EM PRODUÇÃO com dado de OUTRO usuário (04/08/2026)

O testador reconectou depois que a restrição da conta de desenvolvedor dele
caiu, e quatro coisas foram exercidas de uma vez, com dado real que não é nosso:

| | O quê |
|---|---|
| ✅ | `accountStatus` gravado e traduzido — as contas voltaram a "Ativa" |
| ✅ | Tradução do erro `(#200)` |
| ✅ | Aviso de perfil (`lastDiscoveryError`) apareceu **e sumiu sozinho** ao reconectar |
| ✅ | Reset dos contadores no callback do OAuth |
| ⚠️ | Upsert em lote — ver a ressalva abaixo |

> ### ⚠️ A leitura de que o LOTE destravou os 102 anúncios NÃO se sustenta
> A conclusão natural foi: "102 anúncios × 40 dias teria estourado o tempo com
> o N+1". Ela é plausível e **os números não a sustentam**.
>
> O `40` daquela mensagem é `summary.metrics` — **linhas gravadas**, não dias
> (o rótulo "dias" no botão está errado e é dívida). Foram 40 linhas, não
> 4.080: a maioria dos 102 anúncios não teve gasto no período. E 40 upserts em
> série são ~4 s, que o caminho MANUAL (`syncSingleAccount`, requisição direta,
> fora do `after()`) aguentaria sem lote.
>
> **O que destravou foi o token voltar.** O lote continua sendo a correção
> certa — ele protege o ciclo automático recorrente, que é onde o orçamento é
> apertado —, mas atribuir a ele este caso seria confundir correlação com causa.
>
> ⚠️ Fica um sinal a conferir: **Conta 2 sincronizou 28 anúncios e `0` linhas de
> métrica.** Pode ser ausência de gasto (legítimo) ou `metricasOrfas`. O
> `diag:testadores` responde na seção "Por conta".

### 📋 ORDEM DE RETOMADA aprovada em 04/08/2026

Depois dos testes com usuários reais. **Atribuição saiu da frente**: o guarda de
template está feito e o que falta (o `click_id` chegando da OnyxPag) é trabalho
do usuário, no checkout dele.

| # | O quê | Por quê nesta posição |
|---|---|---|
| 1 | **1.3 — taxas por forma de pagamento** | bug isolado e concreto: a opção "Todas" salva `OUTRO`, que é uma forma de pagamento REAL. Não depende de nada |
| 2 | **1.1 — ROI único, com fórmula visível** | ver abaixo |
| 3 | **1.2 — gasto às 00:00** | |
| 4 | **Família 1 da varredura** (3 pontos) | `dispatchPixel`, `checkoutEvent`, `dispatchNotification` — os três afetam dinheiro em silêncio, e o padrão de conserto já está provado com o `lastSyncError` |
| 5 | **1.4 — auditoria completa de métricas** | só depois que a fonte única de ROI/lucro existir; antes disso ela mediria o alvo errado |
| 6 | Bloco 4 — funcionalidades novas | |

> ### 🔴 O card de ROI mostra QUANTO NÃO ESTÁ ATRIBUÍDO, junto do número
> Decisão do usuário, e é o desenho certo: medido em 04/08/2026, **49,6% do
> faturamento dele e 100% do faturamento do testador não têm campanha**.
>
> A fórmula correta vai continuar mostrando número ruim enquanto a atribuição
> não subir — e é exatamente isso que ela precisa **deixar visível**. Sem o
> número ao lado, o usuário culpa a campanha por um problema de tracking.
>
> ⚠️ Esconder ou suavizar o ROI nesse caso seria o pior desfecho: decisão de
> mídia tomada sobre um número que descreve o rastreamento, não o anúncio.

⏳ **Fora da fila, sem prazo:** `capi.ts` e `rules/engine` (Família 1, os dois
que já deixam rastro), a Família 2 inteira, e o rótulo "dias" do botão
Sincronizar, que na verdade mostra LINHAS gravadas.

### 🔍 `npm run falha:coletiva` — "é problema dele ou é nosso?"

Uma restrição no NOSSO app derruba todos ao mesmo tempo, e a tela diz a mesma
coisa que diria para um problema individual — cada um abre chamado achando que
é problema dele.

Agrupa as contas com erro recente pela **causa traduzida** e conta **usuários
distintos**. Dois ou mais já é o sinal.

> ### ⚠️ Agrupa pela CAUSA, nunca pelo texto cru
> A Meta prefixa o nome da conta e anexa a URL da doc, então duas mensagens da
> mesma causa nunca são strings iguais. Agrupar por texto cru não acharia grupo
> nenhum — foi exercitado com dois usuários e textos diferentes.

> ⛔ **O veredito não é binário.** "1 de 1 usuário falhando" não é evidência de
> nada; é o caso normal de quem tem um usuário só. Com menos de 2 usuários
> conectados o script **diz que não consegue distinguir**, em vez de dar um
> veredito que não se sustenta.

O aviso automático na tela fica para quando houver volume — a decisão foi
começar pelo script, rodado sob suspeita.

### 🔍 `npm run diag:testadores` — só leitura, pode rodar em produção

```
npm run diag:testadores -- --url "<conn>"
npm run diag:testadores -- --url "<conn>" --dias 7 --email alguem@exemplo.com
```

Responde três perguntas que só o dado de produção responde: **quanto do
faturamento está atribuído a campanha** (é o que explica o ROI divergente),
**o estado do sync de cada testador** (`lastSyncedAt` × `lastMetricsAt` ×
última métrica GRAVADA × token expirado) e **quantos cliques têm template não
substituído**, com o impacto da reclassificação medido antes de decidir.

> ⚠️ **Tudo recortado por `userId`, e não existe total do banco no relatório** —
> é a regra que o `origem-venda.mjs` custou para aprender.
>
> ⚠️ Ele imprime `lastMetricsAt` **e** a última linha de `DailyAdMetric`
> gravada. São perguntas diferentes: a primeira diz que TENTAMOS sincronizar, a
> segunda que CHEGOU dado. `autoSyncSeNecessario` devolve `modo: "erro"` e **a
> tela descarta** — um token expirado faz o sync falhar a cada 20s para sempre
> sem nada aparecer no painel.

### 🐛 Conta nova nasce com um webhook

`signupAction` (`app/(auth)/actions.ts`) cria explicitamente um
`Webhook principal` da plataforma `CUSTOM` em toda conta nova, e a tela de
cadastro anuncia isso ("Seu webhook de vendas já sai configurado").

⚠️ Como `CUSTOM` tem `auth.exigir: false`, esse webhook é um **endpoint de
ingestão sem segredo**, criado para todo usuário sem que ele peça. Quem
conhecer o token consegue inserir venda na conta. Decidir se ele deixa de
nascer ou se passa a exigir chave.

## 🛒 (histórico) a especificação, antes de ser feita

**Pedido do usuário em 05/08/2026, com escopo fechado.** Fica registrado aqui
inteiro porque é a especificação, não um lembrete.

Hoje quem tem checkout no próprio domínio precisa **saber que a regra de
detecção existe**, abrir o avançado, escolher "contém URL" e adivinhar o
trecho. Errando, fica sem InitiateCheckout **sem nada avisar** — que é a
mesma família do bug do IC vazio (`b38de14`).

### O que a resposta "no meu próprio site" deve entregar

| # | O quê |
|---|---|
| 1 | Regra já em **contém URL**, campo do trecho em destaque, com exemplo real (`/checkout`, `/finalizar`, `/pagamento`) |
| 2 | **Validação do que ela digitou**: URL inteira → extrai o caminho sozinho; trecho que casaria com tudo (`/` ou o domínio) → avisa |
| 3 | Snippet dizendo que vai nas **DUAS páginas** (vendas e checkout), e que sem ele no checkout o IC não dispara |
| 4 | **Checklist do que só a pessoa pode fazer**: mandar `click_id` e `customer_ip` ao criar a cobrança, com código pronto |
| 5 | **Estado real por evento**: "IC recebido pela última vez há X" ou "nenhum IC desde que você configurou" |

> ### ⛔ Vazio NÃO salva, e a mensagem tem de dizer o porquê
> `location.href.indexOf("")` é **sempre verdadeiro**: toda visita viraria
> checkout. A trava já existe no gerador e no Salvar desde `b38de14` — o que
> falta é a frase em português explicando a consequência, não mais uma trava.

> ### 🔑 O código do checklist é lido pelo DESENVOLVEDOR da página, não pelo
> ### usuário da Traffik
> Então o texto não pode pressupor nada da ferramenta. Ele precisa: ler o
> `click_id` do cookie `traffik_track` **ou** da querystring, mandar em
> `tracking` **E** `metadata` (é grátis e dobra a chance de voltar no webhook),
> e **avisar que, se a cobrança nasce no backend, o valor tem de viajar do
> navegador até lá** — que é o passo que todo mundo esquece.
>
> ⚠️ O campo é **`click_id`**, NUNCA `sck`. O parser lê os dois, mas só o
> primeiro vira `matchClick`; mandar em `sck` grava a string e **não casa
> clique nenhum**, sem erro em lugar nenhum.

> ### 🎯 O item 5 é o que impede a PRÓXIMA versão do mesmo bug
> O IC vazio ficou invisível porque não havia como saber que não funcionava —
> e o diagnóstico dizia "ok" sobre um tipo que o script não tinha. "Último
> evento recebido" já existe na gaveta; o que falta é **por evento**.

### Escopo, fechado pelo usuário

- **Sem tela nova.** Tudo dentro da gaveta do Pixel, no caminho que a resposta
  "no meu próprio site" abre.
- **O caminho de checkout HOSPEDADO não muda** — funciona e é o caso da
  maioria.

---

## 🔗 A CÓPIA DOS UTMS EXISTIA E NINGUÉM LIA (2ª parte de 05/08/2026)

`Sale.utmSource/Medium/Campaign/Content/Term` + `fbclid` são gravados na ingestão
**desde a migration `20260731080000`**. Nenhum leitor os consultava: toda a
atribuição fazia `sale.click.utmCampaign` direto, e `Sale.clickId` é `SetNull`.

> ### 🔴 Seguro que é PAGO em toda ingestão e não cobre nada
> Não era um TODO esquecido — era um custo recorrente sem benefício. Apagar um
> clique tirava da venda a campanha, o criativo e a fonte, que é de onde saem
> ROAS, CPA e a área dela. O `tsc` passava, o dado estava lá, e a única coisa que
> faltava era alguém perguntar.

**`CAMPOS_UTM`** (em `lib/vendas/utmsDaVenda.ts`) é o conserto ESTRUTURAL: uma
constante espalhada nos dois `select`. Lembrar de listar seis campos em nove
consultas é disciplina; espalhar uma constante é estrutura — e a diferença
aparece na décima consulta.

| Consumidor ligado | O que a cópia sustenta |
|---|---|
| `areas/precedencia.ts` | de qual ÁREA a venda é (passo 1, conta de anúncio) |
| `ads/overview.ts` | ROAS, CPA e faturamento por campanha |
| `ads/creatives.ts` | ranking de criativos |
| `dashboard/metrics.ts` | fonte, origem, posicionamento e o feed |
| `rules/engine.ts` | 🔴 CPA/ROAS de regra que PAUSA campanha sozinha |

> ### ✅ PROVADO no-op sobre os dados REAIS antes de mexer
> No backup de produção de 01/08: **27 vendas examinadas, 284 cliques, 0** com
> `clickId` nulo e cópia preenchida. Ligar o fallback não mexeu em número nenhum.
> E 2/2 vendas com `clickId` tinham a cópia gravada — o lado da escrita funciona.
>
> ⚠️ **O primeiro script de verificação caiu na armadilha da regra #4 acima**:
> reportou "0" porque o parser não achou linha nenhuma (as chaves do backup são
> `t`/`r`, não `tabela`/`linha`). Contagem `=== 0` sobre coleção vazia, exatamente
> o modo de falha que esta sessão documentou uma seção antes. Hoje o script
> **aborta** se não houver venda a examinar.

> ### ⚠️ `origem` foi o único lugar onde a cópia muda a LEITURA, não só o número
> `if (!s.click) origem.semOrigem += v` — e `semOrigem` é a ÚNICA das três que
> pede ação. Sem consultar a cópia, uma venda cujo clique foi apagado mandaria o
> usuário investigar o rastreamento de uma venda que rastreou certo.
> `fonte === "copia"` **prova que houve clique**.
>
> ⚠️ Limite honesto: clique de tráfego DIRETO apagado tem cópia toda nula, então
> continua em `semOrigem`. Não há o que preserve a existência dele.

> ### ⛔ NÃO copiamos `Click.workspaceId`, e não é esquecimento
> É o passo 2 da precedência (a área que o script declarou). O único caminho que
> apaga clique é "apagar dados" na exclusão de área — e ali a área declarada está
> sendo excluída junto, então `valida()` a recusaria de todo jeito. Seria peso
> morto.

> ### ⚠️ Os TRÊS efeitos pós-venda seguem lendo o clique direto, de propósito
> `dispatchPixel`, `checkoutEvent` e `dispatchNotification` rodam no `after()` do
> próprio request de ingestão, microssegundos depois do match, e **não têm
> caminho de reprocessamento** (verificado: só `ingestSale` os chama). Ali o
> clique não pode ter sumido. Acrescentar a cópia sugeriria que ela é necessária
> na ingestão, e isso confundiria quando ela DE FATO é.

**`npm run test:utm-orfa` — 14 asserções.** Semeia clique + venda, **apaga o
clique de verdade** e lê o número no fim da cadeia (`computeAdsOverview` e
`computeDashboard`): faturamento da campanha 100+400 = 500, ROAS 2,5x, 2
conversões, "Meta Ads" 500.

> ### ⛔ Cada bloco carrega um CONTROLE — senão o teste não mede nada
> Uma venda órfã atribuída certo e uma que vazou por engano dariam o mesmo
> `revenue` total. Então existe a venda de R$ 7 **sem clique e sem cópia**, que
> tem de continuar fora da campanha e em "Direto / Orgânico".
>
> ✅ **Falsificabilidade EXERCIDA:** reintroduzi o bug em `overview.ts` e o teste
> ficou **vermelho em 4 asserções**, com os controles seguindo verdes. Um teste
> que não foi visto falhar não provou nada.

> ### 🐛 E a primeira versão do teste passava pelo caminho ERRADO
> Usei ids de campanha com letras (`c-orfa-1`). `splitPipe` **descarta id não
> numérico**, então a atribuição caía no fallback por NOME e a asserção passava
> sem nunca exercer o caminho primário. Hoje os ids são numéricos (como a Meta
> manda) **e os nomes dentro do UTM são deliberadamente diferentes** dos nomes no
> banco — assim só o id pode casar.

---

## 🕐 O FUSO CAI NO PADRÃO EM SILÊNCIO — agora a tela diz (2ª parte de 05/08/2026)

O `console.error` dos dois casos de DEFEITO já existia (commit `33638c4`). O que
faltava é o caso que importa, e ele **não é defeito**: `User.timezone` é
`@default("America/Sao_Paulo")` e **não é nulo nunca**, então no banco "escolhi
Brasília" e "nunca abri esta tela" são **indistinguíveis**. Quem se cadastra em
Lisboa começa com o dia virando 4h cedo, sempre.

E log de servidor não é lido por quem usa a ferramenta.

**Quem sabe a resposta é o navegador.** O card "Fuso horário" (Taxas e Despesas)
compara o fuso da conta com `Intl.DateTimeFormat().resolvedOptions().timeZone` e
oferece a troca em um clique.

> ### ⚠️ Compara OFFSET, não nome — e o aviso é DISPENSÁVEL
> `America/Sao_Paulo` × `America/Bahia` são strings diferentes e o mesmo
> deslocamento: o dia começa no mesmo instante, nenhum número muda, não há o que
> avisar. **Aviso que aparece sem motivo se aprende a ignorar** — e aí o legítimo
> também é.
>
> E quem opera um negócio brasileiro morando fora tem razão de manter Brasília:
> "Manter" grava a dispensa em `localStorage` **por fuso de aparelho**, então
> quem dispensou em Lisboa e depois abre em São Paulo vê o aviso de novo.

> ### ⚠️ `fusosDiscordam` sonda QUATRO instantes ao longo do ano
> Por causa do horário de verão. Em **janeiro**, `UTC` e `Europe/London` têm o
> mesmo offset: uma sonda única concluiria que concordam, e a divergência
> apareceria sozinha em março, sem nada ter mudado na configuração. O teste tem
> esse caso explícito.

`npm run test:fusos` — **15 asserções**, a maioria do lado *"NÃO deve avisar"*,
que é o risco mais caro a longo prazo.

**Verificado na tela** (fuso da conta em `Europe/Lisbon`, navegador em
`America/Sao_Paulo`): o aviso âmbar aparece nomeando os dois fusos e a
consequência; "Usar America/Sao_Paulo" **gravou no banco** e recarregou;
"Manter Europe/Lisbon" dispensou e a dispensa sobreviveu ao reload; sem
divergência o aviso não existe.

---

## 🧹 FAXINA DO NAV MORTO — a dívida mais antiga do projeto (2ª parte de 05/08/2026)

Aberta desde o **Bloco 1 (24/07/2026)**, quando a navegação por estado virou
rotas reais. **`useTraffikState.ts`: 2235 → 1952 linhas (−283).**

| Removido | Por que estava morto |
|---|---|
| `activeTab`, `navAnalise`, `navAuto`, `navConfig`, `pageTitle`, `pageSubtitle`, `NAV_DEF`, `TITLES` | `Sidebar`/`Header` decidem por `usePathname` desde o Bloco 1 |
| `fbTabs`, `fbSub` | as sub-abas de Integrações são ROTAS próprias |
| `ruleForm` + os ~17 `onRule*` + `addRule` + `runRules` + `ruleBusy`/`ruleRunBusy`/`ruleRunResult` | a `RulesView` foi reescrita autocontida no Bloco 8 |
| `utmUrl`/`utmSource`/`utmMedium`/`utmCampaign`/`utmContent`, `generatedLink`, `snippetText`, `copySnippet`, `copyLink`, `snippetCopied`, `linkCopied` | o gerador de link/snippet antigo saiu no Bloco 11 |
| `metricList`, `persistPrefs`, `editDashOpen`, `openEditDash`, `closeEditDash` | só o `EditDashboardDrawer` os usava |
| **`EditDashboardDrawer.tsx` (deletado)** | montado no `DashboardShell` e **inalcançável** — nada chamava `openEditDash` |
| `TabKey` (em `types.ts`) | o vocabulário da navegação por estado |
| `setNested` | só os `onRule*` o usavam |

> ### 🔴 A faxina achou uma CONSULTA AO BANCO alimentando nada
> `State.rules` vinha de `initialRules`, passada pelo `DashboardShell`, que vinha
> de **`listRules()` dentro do `Promise.all` do layout** — ou seja, uma ida ao
> Supabase **em todo carregamento de página**, cujo único consumidor era um
> derivado que ninguém lia.
>
> Isso deixa de ser dívida cosmética: o layout é o caminho crítico de toda
> navegação. A `RulesView` busca as próprias regras desde o Bloco 8, e a página
> **continua funcionando** com a prop removida — o que é a prova de que era peso.

> ### ⛔ `newCampaign*` NÃO é código morto — não remova
> `newCampaignOpen`/`openNewCampaign`/`createCampaign` **têm consumidor** desde
> 31/07: `views/ads/NovaCampanhaModal.tsx`. O CLAUDE.md os listava como inertes
> e essa entrada envelheceu. **Conte os consumidores antes de apagar** — foi o
> `grep` que separou os 11 símbolos mortos dos 4 vivos.

**Método:** contar consumidores fora do hook para cada símbolo (11 deram 0),
remover, e deixar `tsc` + `lint` apontarem os órfãos em cascata — foram 9 numa
passada e 11 na seguinte (imports, tipos, helpers).

**Verificado:** `tsc`, `lint` (zero avisos) e `next build` limpos; **as 12 rotas
do dashboard respondem 200** sem erro no HTML; Dashboard renderiza 46 cards e
Regras abre o estado vazio normalmente. Suítes: 248 asserções em 9 arquivos, 0
falhas.

### ⛔ As quatro regras que esta sessão acrescentou

> #### 1. "Não se aplica" não é "falhou" — por isso vocabulário, não booleano
> `outro_dono` é o desfecho CORRETO de quem configurou a partição do pixel.
> Um `ok: boolean` o contaria como falha e a tela pediria para consertar o que
> está certo. `sem_pixel` (não configurou) e `sem_token` (configurou e nada
> sai) parecem iguais de longe e só um é bug. Ver `lib/webhook/efeitos.ts`.

> #### 2. Razão com unidades diferentes nos dois lados
> `chargebackRate` dividia **itens por pedidos**. Não é imprecisão: o
> resultado sai dobrado em quem vende com order bump, e continua entre 0 e
> 100 — plausível. **Ao escrever uma razão, pergunte se numerador e
> denominador contam a mesma coisa.**

> #### 3. Indefinido é `null`, e a correção precisa alcançar os IRMÃOS
> O ROI já tinha recebido isso (`totalCost === 0` devolvia 0 e a tela dizia
> "0,00x", que se lê como empate). `cpa`, `ticket`, `roas`, `ctr` e `arpu`
> ficaram para trás por sessões — enquanto o Gerenciador sempre devolveu
> `null` pelo `div()`. **Duas telas respondendo diferente à mesma pergunta.**
>
> ⚠️ O card de ROAS sabia pela METADE: a COR já tratava o caso como
> indefinido (`spend > 0 ? roas : null`) e o NÚMERO continuava dizendo
> "0,0x". Meia correção é a assinatura de que a outra metade foi esquecida —
> **ao achar uma, procure a outra ponta.**
>
> Os formatadores (`brl`, `pct`, `multFmt`) passaram a aceitar `null` e
> devolver "—". Um `?? 0` esquecido num call site desfaria tudo em silêncio.

> #### 4. Contagem de violações === 0 passa com a coleção VAZIA
> `vazios === 0` é verdade quando tudo está certo **e** quando nada foi
> examinado — e o segundo é a regressão que importa (módulo morto, lista
> vazia, base inerte). **Prove primeiro que houve o que examinar.**
> Três asserções estavam nesse estado; a do `teste-pais` teria continuado
> verde durante a sessão inteira em que a base de países ficou inerte.

### ⚠️ O que NÃO foi feito

- **`Sale.utmTerm` não é usado na atribuição** — a tabela de posicionamento lê
  `click.utmTerm` com a cópia como fallback, mas nenhuma outra métrica passou
  a usar a cópia. Continua valendo a decisão de 31/07: ligar isso mudaria
  números sem gatilho que justifique.
- **O imposto de anúncio não entra no Gerenciador.** Lá o lucro é bruto por
  desenho (não há como ratear custo de conta por campanha), e o tooltip já diz
  isso. Se um dia entrar, `roiMidia` deixa de ser comparável com o painel da
  Meta.
- **Free name nos 5 blocos de despesa já existia** — o item da fila estava
  desatualizado. O que faltava era o MODO (R$ por venda), agora em coprodução
  e custo de produto. Imposto continua só percentual: alíquota é percentual
  por natureza.

### 📋 Fila

1. 🔴 **Item (d), o que sobrou — e o BLOQUEIO é do ambiente, não do código.**
   O `resize_window` foi exercido de novo em 05/08 e **mentiu de novo**: disse
   *"Successfully resized … to 560x900"* e `innerWidth` ficou **2560**. A janela
   do grupo de abas do MCP continua **maximizada** (`innerWidth ===
   screen.availWidth`).
   **PRECISA DO USUÁRIO:** desmaximizar (Win+Down ou duplo clique na barra de
   título) **a janela que contém o grupo de abas do MCP** — não a janela
   principal do Chrome. A extensão manda tecla para a PÁGINA, não para o
   gerenciador de janelas, então eu não consigo fazer isso daqui.
   ⛔ **O CDP não substitui:** `chrome-devtools-mcp` roda num browser SEPARADO e
   **não autenticado**, e o cookie de sessão do NextAuth é `httpOnly` — não há
   como transplantá-lo. Ele nunca alcança o dashboard.
   ⏳ Falta também o **Gerenciador com filtros/estados combinados** (exige semear
   campanhas com status variados; o banco de dev está sem campanha nenhuma).
2. Evento de TESTE da Cakto contando como venda — bloqueado até reativá-la.
3. Import/export do Bloco 8.

> ✅ **A metade do item (d) que NÃO dependia de viewport foi FEITA em 05/08:**
> os condicionais da gaveta de Integrações › Anúncios (erro de perfil, conta
> Desabilitada + backoff *"nova tentativa em ~2 h"* + detalhe técnico cru, badge
> Pagamento pendente) foram vistos na tela — **0 de 63 descendentes vazam** num
> painel de 560px, sem rolagem horizontal.
>
> ✅ **A faxina do nav morto e o `EditDashboardDrawer` saíram desta fila** — ver
> a seção própria.
