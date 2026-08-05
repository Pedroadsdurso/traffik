# Gerenciador de Anúncios e escrita na Graph API

> Leia ao mexer no Gerenciador, no sync do Facebook, ou em qualquer caminho
> que ESCREVA na Meta. O inventário do que já foi exercido de verdade está
> aqui — e o que nunca foi.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## ⚠️ Gasto das campanhas vindo zerado (corrigido)

O sync usava `date_preset: last_7d/last_30d` nos insights. Os presets da Meta são
ancorados no fuso da conta e **não trazem o dia corrente de forma confiável** — um
gasto feito hoje aparecia como R$ 0,00. Trocado por `time_range` explícito
(`since`/`until` até hoje) + `action_report_time: "impression"`.

> **Não confirmado contra a API real:** a conta de teste não tem token do Facebook
> válido nesta sessão. A correção é a explicação mais provável (havia 1 campanha, 1
> anúncio e 1 linha de métrica gravados, com `spend = 0`), mas **precisa ser validada
> com uma sincronização real**. Note também que **só 1 das contas de anúncio está com
> `trackingEnabled = true`** — se o gasto foi em outra, é preciso ligar o rastreamento
> dela na aba Anúncios.

## 🔄 Sincronização automática do Facebook (28/07/2026)

**O polling da UI sempre existiu** (5s no Dashboard, 8s no Gerenciador) — mas ele
lê o NOSSO banco. Quem trazia dado novo do Facebook era o `syncUser`, e ele só
rodava no botão "Sincronizar métricas" e no cron do GitHub Actions a cada 15 min
— que é *best-effort*, atrasa 5–20 min em pico e **é desativado sozinho após 60
dias sem commits**. Daí a impressão de que era preciso clicar e recarregar.

Agora **toda requisição do painel dispara a sincronização quando o dado está
velho** (`src/lib/facebook/autoSync.ts`), via `after()` do Next 16 — a resposta
sai primeiro, a Graph API é chamada depois. Ciclo: polling → dado velho →
sincroniza → o polling seguinte já mostra o número novo. O botão manual continua
existindo para forçar.

### Dois ritmos, porque as chamadas não custam a mesma coisa

O ciclo COMPLETO lê campanhas + conjuntos + anúncios + insights: **4 chamadas por
conta**. As métricas sozinhas são **1** (`syncAccountMetrics`, que tira o mapa
`fbAdId → id` do banco em vez da Graph). Estrutura muda raramente — criar
campanha é ato humano; o gasto muda o tempo todo.

| Ciclo | Intervalo | Custo (5 contas) | O que traz |
|---|---|---|---|
| Métricas | **20s** | 5 chamadas | gasto, impressões, cliques, CTR/CPC/CPM |
| Completo | **3 min** | ~20 + 1 por perfil | campanhas/conjuntos/anúncios novos, **contas novas da BM** |

Carga média ~15 chamadas/min — parecida com a do ciclo único de 90s que existia
antes, mas com o gasto **4,5× mais fresco**.

> ⚠️ **`lastSyncedAt` NÃO avança no ciclo de métricas.** São dois relógios
> (`lastSyncedAt` = estrutura, `lastMetricsAt` = gasto): marcar o barato como
> completo adiaria indefinidamente a descoberta de contas novas. A UI mostra a
> idade das MÉTRICAS, que é o número que o usuário fica olhando subir.
>
> ⚠️ **Anúncio criado depois do último ciclo completo não recebe métrica ainda** —
> entra no ciclo seguinte (≤3 min). É o trade-off do mapa vir do banco.

| Constante | Valor | Por quê |
|---|---|---|
| `METRICAS_MS` | 20s | Teto de defasagem do gasto |
| `COMPLETO_MS` | 3 min | Estrutura + contas novas da BM |
| `DIAS_AUTO` | 2 | Auto-sync só precisa de hoje + ontem; os 30 dias ficam no cron e no botão |
| `LOCK_EXPIRA_MS` | 10 min | Libera reserva órfã de instância que morreu no meio |
| `PROFILES_POLL_MS` | 30s | Vitrine de Integrações › Anúncios |

> ### ⛔ Por que NÃO dá para ser instantâneo
> **A Meta não empurra gasto para nós.** Não existe webhook de insights na
> Marketing API — o dado só chega se formos buscar. E os próprios números da Meta
> têm atraso de consolidação de alguns minutos: o gasto de agora não está pronto
> nem do lado deles. Baixar o intervalo além disto queima rate limit sem trazer
> número mais novo. WebSocket/SSE também não ajudaria: eles acelerariam o trecho
> banco → tela, que já leva 5–8s, e não o trecho Meta → banco, que é o gargalo.

> ### 🔒 A trava é do BANCO, não do processo
> Em serverless não há estado compartilhado entre instâncias, e o polling bate a
> cada poucos segundos — de várias abas e às vezes vários dispositivos. Uma trava
> em memória deixaria N sincronizações concorrentes batendo na Graph API e
> estourando rate limit.
>
> A reserva é um **`updateMany` condicional**: o `WHERE` só passa se o lock ainda
> estiver livre. Quem atualiza a linha ganhou a vez; quem recebe `count: 0`
> desiste em silêncio. É o mesmo padrão do upsert monotônico de vendas — quem
> decide o vencedor é o banco. **Testado com 5 reservas concorrentes: 1 vencedor.**
>
> `lastSyncedAt` só avança quando a sincronização **conclui com sucesso**;
> `syncLockedAt` marca a tentativa. Separar os dois é o que impede a UI de dizer
> "atualizado agora" depois de uma sincronização que falhou.

### Contas novas na BM aparecem sozinhas

`syncUser` só iterava as `AdAccount` **já existentes**, e a única coisa que
chamava `/me/adaccounts` era o callback do OAuth. Uma conta criada na BM depois
da conexão nunca aparecia — a saída era desconectar e reconectar o perfil.

`descobrirContas()` roda no início de toda sincronização e reconsulta
`/me/adaccounts` por perfil. O upsert também corrige **nome, moeda e status** de
contas existentes, então renomear na BM passa a refletir aqui.

> ⚠️ **Conta que some da resposta NÃO é apagada.** Perda de permissão costuma ser
> temporária, e apagar levaria junto o histórico de métricas por cascade. Isso é
> deliberadamente diferente da `podar()` de campanhas/anúncios, que só roda
> depois de uma resposta bem-sucedida daquela conta específica.
>
> ⚠️ Token de UM perfil expirado **não derruba os outros**: a descoberta é por
> perfil, dentro de `try/catch`, e o erro entra em `summary.errors`.

**Testado contra a Graph API real** (token do dono, 5 contas na BM): um usuário
descartável sem conta nenhuma descobriu as 5 sozinho, todas rastreando e ligadas
ao perfil; a 2ª passada não duplicou nem contou como nova (idempotente); e um
nome adulterado no banco foi corrigido pela descoberta seguinte. Usuário de teste
removido depois. Mais 5 asserções da trava. `tsc` e `next build` limpos.

**O cron continua**, e ainda importa: ele cobre a janela de 30 dias e mantém o
motor de regras rodando **com ninguém olhando a tela** — o auto-sync só dispara
quando há requisição do painel.

> ⚠️ **Hoje há DOIS agendadores**: o cron-job.org (configurado pelo usuário) e o
> `.github/workflows/cron.yml`, que nunca foi removido e está ativo. Ver
> "DOIS AGENDADORES RODANDO AO MESMO TEMPO".

## 📋 Rotas de cron: como ler os retornos

### ⛔ A Graph API esconde ARQUIVADOS — foi o bug do "metrics: 0"

**`/campaigns`, `/adsets` e `/ads` excluem objetos ARQUIVADOS por padrão.** Uma
conta com 7 campanhas arquivadas devolvia `0` nas três arestas, enquanto
`/insights` seguia reportando **R$ 114,34** de gasto daquelas mesmas campanhas.

A cadeia da falha:
1. `/campaigns` → 0 ⇒ nenhuma `Campaign` local
2. `/ads` → 0 ⇒ nenhum `Ad` ⇒ `adIdMap` vazio
3. `/insights` → 16 linhas com `ad_id`
4. `adIdMap.get(ad_id)` → `undefined` ⇒ **`continue` silencioso em toda linha**
5. `metrics: 0`, `errors: 0`, gerenciador zerado

Corrigido com `effective_status` explícito (`STATUS_SINCRONIZADOS` em `sync.ts`).
Resultado real: 0 → **12 campanhas, 12 anúncios, R$ 103,41, 2.756 impressões**.

> ⚠️ **`DELETED` não é recuperável.** A Meta não devolve objetos excluídos nessas
> arestas de jeito nenhum, mas os insights deles continuam vindo. Esse gasto vira
> **`metricasOrfas`** no retorno em vez de sumir — era exatamente ele que fazia
> `errors: 0` mascarar perda de dado. No teste: 2 linhas órfãs = os R$ 10,93 de
> diferença entre o total da Meta e o atribuído.

### Funil: percentual sobre a MAIOR etapa (método Utmify) + análise de gargalo

O percentual era **sobre a etapa anterior**, e por isso passava de 100% sempre
que uma etapa era maior que a precedente — "Visita na página" (220, do nosso
script) sobre "Cliques no anúncio" (98, do Meta) dava **224,49%**. Não era erro
de conta: as duas contagens vêm de fontes independentes e se cruzam de verdade.

Hoje cada etapa mostra **% da maior etapa** (`src/lib/funnel.ts`): a maior fica
em 100% e nada a ultrapassa por construção. A espessura do segmento usa esse
mesmo percentual, então desenho e número contam a mesma história. O ⚠️ de
"acima de 100%" saiu — deixou de existir o caso.

Dados reais: `98, 220, 25, 14, 2` → `44,5% · 100% · 11,4% · 6,4% · 0,9%`.

> ⚠️ **A taxa vs. etapa anterior não sumiu** — é a informação analítica de
> verdade e continua no tooltip (visitas vs. cliques segue mostrando 224,5%). Só
> deixou de ser o número em destaque.

**O funil aponta o gargalo.** Por transição calcula perda absoluta, perda %, e
o faturamento estimado na mesa; elege a transição com a maior QUEDA e a marca
com divisória âmbar + resumo no rodapé. Entre as etapas aparece "−195 · 88,6%"
sem precisar de hover.

> ⚠️ **Valor financeiro só a partir do Initiate Checkout** (`INDICE_MIN_FINANCEIRO`).
> Quem chegou ao checkout e não comprou é receita que estava ao alcance, e o
> ticket médio é estimativa defensável. Multiplicar *visitante* perdido por
> ticket médio produziria um número enorme e fictício — a maioria dos visitantes
> nunca compraria.
>
> ⚠️ **Etapa que CRESCE não é gargalo.** Só quedas reais concorrem; sem esse
> filtro o "maior" cairia numa transição saudável quando o funil inteiro
> estivesse crescendo.

> ### ⚠️ "Excluir" no Facebook = ARQUIVAR
> Trazer arquivados resolveu o gasto sumido e **criou outro problema**: a
> listagem encheu de campanha que o usuário já tinha apagado — no Gerenciador do
> Facebook, "excluir" apenas arquiva.
>
> A separação que resolve os dois: o **dado** fica no banco (o gasto do Dashboard
> segue completo, porque soma `DailyAdMetric` direto) e a **listagem** esconde
> arquivados. `lib/ads/status.ts` é a fonte única — "Todos os status" exclui
> ARCHIVED/DELETED, e existe a opção "Arquivados" para vê-los.
>
> ⚠️ **O filtro de status é do CLIENTE.** O painel manda só `period` e `account`
> na querystring — status e busca são aplicados no navegador para trocar de
> filtro não custar um round-trip. Logo, `filters.status` chega ao servidor
> SEMPRE como `"todos"`.
>
> Enquanto "todos" significava "tudo", filtrar no servidor era inofensivo.
> Quando "todos" passou a excluir arquivados, o filtro do servidor virou uma
> peneira que **descartava as arquivadas antes de saírem da API** — e a opção
> "Arquivados" da tela ficou filtrando uma lista vazia (abas em "0 item(ns)"
> logo após um sync que reportou "12 campanhas"). O servidor não filtra mais por
> status; quem decide é `lib/ads/status.ts` no cliente. **Se um dia voltar a
> filtrar lá, o status PRECISA ir na querystring junto.**
>
> ⚠️ A contagem das abas usava `array.length` cru e mostrava "12" com a tabela
> vazia. Passou a aplicar o mesmo filtro das linhas.
>
> ⚠️ `pausado` significava `status !== "ACTIVE"`, que varria arquivados junto.
> Hoje é `PAUSED` estrito.

### Botão "Atualizar" — ponto ÚNICO de sincronização manual

Os botões "Sincronizar métricas" (Gerenciador) e "Sincronizar tudo" (Integrações)
foram removidos. O **"Atualizar" do Dashboard** é o único gatilho manual — ele
chama `POST /api/sync/manual`, que delega ao **mesmo `autoSyncSeNecessario`** dos
crons e do polling. Ou seja: o botão respeita os mesmos intervalos e **não
sincroniza cegamente**.

> O botão "Sincronizar" **por conta** em Integrações continua: é ação dirigida
> ("só esta conta agora"), não um segundo botão global.

**Custo medido** (1 perfil, 2 contas elegíveis), interceptando o `fetch`:

| Cenário do clique | Modo | Chamadas à Graph |
|---|---|---|
| Tudo em dia (< 20s) | `pulado` | **0** |
| Métricas vencidas | `metricas` | **2** (1 `/insights` por conta) |
| Estrutura vencida (**pior caso**) | `completo` | **9** |
| 5 cliques seguidos após um sync | `pulado` ×5 | **0** |

O pior caso se decompõe em `1 × /me/adaccounts` + `2 × (/campaigns + /adsets +
/ads + /insights)`. A fórmula é **`perfis + contas_elegíveis × 4`** — com N
contas rastreadas, `1 + 4N`.

**Trava contra clique repetido, em duas camadas:**
1. **Cliente** — botão desabilitado com spinner. O `syncManualBusy` é lido de
   dentro do `setS` (não num `if` antes), porque entre um `if` e o `setS` cabe
   outro clique e dois cliques rápidos disparariam duas requisições.
2. **Banco** — a reserva do `autoSync`. É a única que protege de verdade: duas
   abas, dois dispositivos ou um F5 no meio passariam pela primeira sem esbarrar
   em nada.

O botão também **recarrega o painel só DEPOIS** de sincronizar. Antes ele apenas
recarregava a tela, relendo o mesmo dado do banco — daí a impressão de que não
fazia nada.

### Fonte de verdade por métrica (Gerenciador)

> ### ✅ Dupla contagem é IMPOSSÍVEL por construção — não é disciplina, é estrutura
> Pedimos ao `/insights` **apenas** `spend,impressions,clicks,ctr,cpc,cpm,reach,frequency`.
> **Nenhum evento de conversão** — nada de `actions`, `conversions` ou
> `purchase_roas` — e `DailyAdMetric` não tem coluna para guardá-los. Quando a
> Meta enfim consolida as conversões dela, o dado **não entra no nosso banco**.
> Não existe caminho no código onde uma venda da Meta e uma venda nossa se somem.

| Métrica | Fonte | Por quê |
|---|---|---|
| Gasto, Impressões, CPM, Alcance, **Cliques** | **Meta** | Só o Facebook sabe quanto cobrou e quanto entregou |
| CPC, CTR | **Meta** | Denominador precisa bater com o painel da Meta |
| **Cliq. atr.** | **Nosso** | Chegou ao site com UTM. Coluna SEPARADA — nunca somada aos cliques da Meta |
| IC | **Nosso** | A Meta nem enxerga: o checkout é do gateway |
| **Vend. inic.** | **Nosso** | Vendas em qualquer status |
| Vendas, Faturamento | **Nosso** | Cruzamos com o gateway — sabemos o que foi APROVADO |
| CPA, ROAS, ROI, Lucro, CPI | **Derivada** | Custo da Meta ÷ conversão nossa |

**As conversões já eram tempo real** e isso não precisou ser construído: venda
(webhook → `Sale`), IC (`px.js` → `PixelEvent`) e clique (`t.js` → `Click`)
entram no nosso banco no instante do evento, e `computeAdsOverview` lê essas
tabelas **direto**, sem tocar na Graph API. Com o polling de 8s, aparecem em
segundos. Só gasto e impressões esperam a Meta.

> ⚠️ **Cliques da Meta ≠ cliques nossos, e as duas colunas coexistem.** O da
> Meta é métrica de mídia e é o denominador de CTR/CPC — trocá-lo faria o CTR
> divergir do painel deles sem motivo. A diferença entre as duas colunas é
> informação útil: clique da Meta sem clique nosso = quem clicou e não carregou
> a página (ou está sem o script de UTM).
>
> **Por que nosso número difere do Gerenciador da Meta:** (1) atraso de
> consolidação deles; (2) janela de atribuição — a Meta credita venda em até 7
> dias após clique e 1 após visualização, nós casamos por UTM/`fbclid` direto;
> (3) a Meta deduplica por pessoa entre dispositivos, nós por sessão. A UI traz
> ponto colorido por coluna (azul Meta / roxo nosso / cinza derivada) e legenda
> com essa explicação — sem isso o usuário compara, vê divergência e conclui que
> um dos dois está errado.

### Glossário dos contadores

| Campo | Significa |
|---|---|
| `users` | Usuários processados. **No `sync-facebook`**: com perfil do Facebook conectado. **No `run-rules`**: com ao menos uma regra ATIVA — `0` aqui significa "nenhuma regra cadastrada", não falha de query |
| `accounts` | Contas de anúncio efetivamente sincronizadas |
| `contasElegiveis` | Contas que passam no filtro `trackingEnabled: true` **e** têm perfil vinculado |
| `contasTotais` | Todas as contas do usuário, elegíveis ou não |
| `campaigns` / `adSets` / `ads` | Entidades criadas ou atualizadas |
| `metrics` | Linhas de `DailyAdMetric` gravadas (uma por anúncio × dia) |
| `metricasOrfas` | Insights descartados por não achar o anúncio local (anúncio excluído na Meta) |
| `totalMetrics` | Soma de `metrics` de todos os usuários |
| `errors` | Quantidade de falhas; `detalheErros` traz as mensagens |
| `contasNovas` | Contas detectadas agora na BM que ainda não existiam |
| `removidos` | Entidades apagadas localmente por não virem mais da Meta |
| `evaluated` / `acted` | (`run-rules`) regras avaliadas / que dispararam ação |

**Modos do `sync-facebook`:**

| `modo` | O que houve |
|---|---|
| `pulado` + `motivo: "intervalo"` | **Normal e esperado.** Não venceu o intervalo (20s métricas / 3 min completo). É a proteção de rate limit — a maioria das chamadas de um cron de 1 min cai aqui |
| `metricas` | Rodou o ciclo barato: 1 chamada por conta, só gasto/impressões/cliques |
| `completo` | Rodou o ciclo caro: estrutura + contas novas da BM |
| `completo-30d` | `?full=1` — janela de 30 dias, ignora intervalos |
| `erro` | Falhou; o campo `erro` traz a mensagem |

> **`accounts: 0` com `modo: "pulado"` é correto** — nada rodou, então não há o
> que contar. Só investigue `accounts: 0` quando o modo for `metricas`,
> `completo` ou `completo-30d`.

## ✍️ ESCRITA NA GRAPH API: o que já foi exercido (31/07/2026)

> ### ⛔ A documentação afirmava, em QUATRO lugares, que nenhuma escrita real
> ### tinha acontecido. Era FALSO.
> O usuário **pausou campanha e alterou orçamento pela ferramenta, em produção, e
> os dois funcionaram no Facebook.** A afirmação nasceu correta ("não exercida
> *nesta sessão*, a conta de teste não tem token") e foi sendo copiada adiante
> perdendo o "nesta sessão", até virar uma verdade geral que ninguém checou.
>
> **Lição:** "não verificado por mim" não é "não verificado". Antes de registrar
> algo como não exercido, pergunte ao usuário — ele usa o produto.

### Inventário — quatro caminhos de escrita, e dois rodam SOZINHOS

| Caminho | Onde | Exercido? |
|---|---|---|
| Pausar/ativar pelo toggle | `/api/ads/status` | ✅ uso real |
| Alterar orçamento (caneta inline) | `updateDailyBudget` | ✅ uso real |
| **`Purchase` na CAPI** | `dispatchPixel` | ✅ **automático, em TODA venda aprovada** |
| **`Lead`/`AddToCart`/`IC` na CAPI** | `/api/pixel/event` | ✅ **automático, pelo script instalado** |
| Teste de pixel | `/api/pixel/test` | ✅ |
| **Regras agindo sozinhas** | `rules/engine.ts` | ✅ **31/07/2026, em produção.** PAUSAR (por acidente) e AJUSTAR_ORCAMENTO (teste dirigido) |
| **Clamp NO teto de orçamento** | `rules/engine.ts` | ✅ **31/07/2026** — R$ 20 +50% com teto R$ 25 → **R$ 25,00 no Facebook**; a 2ª execução pulou com `já no teto` sem chamar a Meta |
| Criar campanha | `/api/ads/campaign` | ✅ 31/07/2026 — a cobaia crua |
| Ações em massa | `/api/ads/bulk` | ❌ nunca |
| Duplicar | `/copies` | ❌ nunca |
| Excluir | `deleteEntity` | ❌ nunca (irreversível) |

> ⚠️ Os dois automáticos são fáceis de esquecer porque ninguém clica neles: **cada
> venda aprovada escreve na Meta** e alimenta a otimização da campanha. Não é
> escrita de configuração, mas é dinheiro real sendo influenciado.

### ✅ A cadeia de unidades está correta (verificada no código)

`sync.ts` → `budget(v) = Number(v) / 100` (centavos → reais).
`manage.ts` → `Math.round(reais * 100)` (reais → centavos).

Consistente nos dois sentidos, e confirmada pelo uso real do usuário. **Não é
onde procurar se um orçamento sair errado** — procure no caminho da REGRA, que é
o único que nunca rodou.

### 🧪 Plano de validação do que falta

> ### 🔴🔴 A PREMISSA DA COBAIA CAIU — ela GASTOU (31/07/2026)
> A versão anterior desta seção dizia que a campanha de engajamento era **crua
> (sem conjunto e sem anúncio)** e por isso **não gastaria nem se fosse
> ativada** — "risco financeiro zero, não baixo".
>
> **Ela gastou R$ 0,13.** O valor apareceu no `details.avaliado` do log da regra
> que disparou por engano. Gasto só existe com entrega, e a Meta **só entrega
> através de conjuntos** — então ela tem conjunto e anúncio ativos, ou passou a
> ter em algum momento. A frase escrita acima já estava falsa quando foi lida.
>
> **Consequências, todas do plano de validação:**
> - o Passo 1(b) ("ativar é seguro porque não há entrega") **não vale mais**;
> - o Passo 2 (clamp de orçamento) mexeria numa campanha que entrega de verdade;
> - "risco financeiro zero" vira "risco real, pequeno".
>
> ⚠️ **A regra que fica: não confie na descrição de uma cobaia — MEÇA.**
> `npm run conta:estrutura` responde por campanha quantos conjuntos e anúncios
> ATIVOS ela tem e quanto gastou, e marca com `● PODE GASTAR` toda campanha
> `ACTIVE` com conjunto e anúncio ativos. Uma campanha só é segura enquanto for
> **crua (zero conjuntos)** — e isso é uma medição, não uma lembrança.
>
> ✅ **Pausada, ela volta a ser inofensiva** — campanha pausada não entrega, e o
> Passo 1(a) (pausar o que já está pausado) continua sendo o teste mais seguro.
> Mas o Passo 1(b) e o Passo 2 precisam de **outra** cobaia, comprovadamente
> crua pelo `conta:estrutura`.

**Passo 0 — ensaio a seco, obrigatório.** Regra com condição impossível
(`Gasto ≥ 999999`), nível Campanha, conta CA 1 MARIA. O `details.avaliado` do log
lista **cada entidade que a regra viu**, sem agir. Serve para responder: *as 12
campanhas ARQUIVADAS da conta entram no escopo?* Se entrarem, nenhuma regra de
ATIVAR pode rodar antes de apertar o escopo.

**Passo 1 — motor agindo.** (a) `Gasto ≥ 0` + **Pausar** numa campanha já pausada:
escrita real, efeito nulo, prova o caminho inteiro. (b) mesma regra com **Ativar**:
prova mudança de estado, e é segura porque sem conjuntos não há entrega.

**Passo 2 — o clamp.** Orçamento em **R$ 20**, regra **+50% com teto R$ 25**.
Esperado no Facebook: **R$ 25,00**. R$ 30 = clamp não aplicou; R$ 0,25 ou
R$ 2.500 = erro de unidade no caminho da regra.

**Passo 3 — ações em massa.** O teste mais informativo é pedir **R$ 1,00** de
orçamento: a Meta **rejeita** (abaixo do mínimo) e isso prova que o banco local só
é atualizado DEPOIS de a Graph aceitar.

**Passo 4 — duplicar.** Nasce **pausada** (`status_option: PAUSED`, o diálogo
pergunta). `deep_copy: true`.

> 🔴 **Reverter o duplicar é o problema:** a única remoção pela ferramenta é
> Excluir, e `deleteEntity` grava `status: DELETED`, que **a Meta não desfaz**.
> Arquive a cópia pelo Gerenciador do Facebook.

> ### ⛔ BID CAP NÃO É TESTÁVEL NESTA COBAIA
> `bid_amount` é campo de **CONJUNTO**, não de campanha, e exige estratégia
> `LOWEST_COST_WITH_BID_CAP` ou `COST_CAP`. Testá-lo exigiria criar um conjunto —
> o que remove a propriedade de "não pode gastar". Fica para quando houver uma
> campanha real de baixo risco.

**Rejeições LEGÍTIMAS, para não confundir com bug nosso:** orçamento abaixo do
mínimo diário da conta; `bid_amount` em campanha ou com estratégia incompatível;
orçamento de campanha quando os conjuntos têm orçamento próprio (ABO). Ativar
campanha pausada e o objetivo de engajamento **não** rejeitam nada.

## 🚦 Status de VEICULAÇÃO — `status` × `effective_status` (31/07/2026)

**Migration `20260731020000`** — `effectiveStatus String?` em `Campaign`,
`AdSet` e `Ad`. Aditiva: três colunas nullable, sem default e sem backfill.

### 🔴 O campo estava na chamada, e mesmo assim não era guardado

`effective_status` aparece **duas vezes** na requisição, com papéis diferentes:

| Onde | Papel |
|---|---|
| `effective_status: STATUS_SINCRONIZADOS` | **filtro** de quais objetos trazer |
| `fields: "…,effective_status,…"` | **campo** a ler |

O sync tinha só o primeiro. A chamada trazia exatamente os objetos certos e
**jogava fora a informação** — nada falhava, nada logava, e a resposta para "por
que minha campanha não está rodando" simplesmente não existia no banco.

| Campo | Responde |
|---|---|
| `status` | o que foi **configurado** — é o que o toggle da tabela reflete |
| `effective_status` | se está **realmente veiculando** |

### O mapa, e por que ele é DADO e não `switch` na view

`lib/ads/veiculacao.ts` é a fonte única — o `AdsTable` mostra e a `ads:sonda`
confere contra a resposta crua. Mesma razão de `corFinanceira` e de
`lib/ads/status.ts`: rótulo e cor decididos na tela divergem quando aparece a
segunda tela.

| `effective_status` | Na tela | Tom |
|---|---|---|
| `ACTIVE` | Veiculando | verde |
| `PAUSED` | Pausado | cinza |
| `ADSET_PAUSED` | Conjunto pausado | âmbar |
| `CAMPAIGN_PAUSED` | Campanha pausada | âmbar |
| `DISAPPROVED` | Reprovado | vermelho |
| `PENDING_REVIEW` | Em análise | âmbar |
| `PREAPPROVED` | Aprovado provisoriamente | âmbar |
| `PENDING_BILLING_INFO` | Falta pagamento | vermelho |
| `IN_PROCESS` | Preparando | âmbar |
| `WITH_ISSUES` | Com problema | vermelho |
| `ARCHIVED` | Arquivado | cinza |
| `DELETED` | Excluído | cinza |

> ### 📏 SONDA RODADA EM PRODUÇÃO (31/07/2026) — 2 dos 12 valores existem
> O campo **vem em 39 de 39 objetos** (2 contas × 3 níveis). Mas só dois valores
> apareceram:
>
> | Observado | Quantos |
> |---|---|
> | `ARCHIVED` | 36 |
> | `ACTIVE` | 3 |
>
> **Os outros 10 mapeamentos são TRADUÇÃO NÃO EXERCIDA** — `ADSET_PAUSED`,
> `CAMPAIGN_PAUSED`, `DISAPPROVED`, `PENDING_REVIEW`, `PREAPPROVED`,
> `PENDING_BILLING_INFO`, `IN_PROCESS`, `WITH_ISSUES`, `PAUSED` e `DELETED`
> nunca chegaram da API real. Eles vieram da documentação e continuam corretos
> em teste, mas ninguém viu a Meta emitir nenhum deles nesta conta.
>
> ⚠️ Isso vale principalmente para o caso mais útil da coluna: **nenhuma
> divergência foi observada** (zero objetos `ACTIVE` sem entregar). O selo âmbar
> com ⚠ existe, está testado e **nunca apareceu com dado real**.
>
> ⚠️ **`PREAPPROVED` e `PENDING_BILLING_INFO` continuam FORA de
> `STATUS_SINCRONIZADOS`**, agora com evidência: a sonda consulta com a lista
> maior e não achou nenhum objeto nesses estados. Não há o que ganhar mexendo
> num filtro que já derrubou o sync inteiro uma vez.
>
> ✅ **O sync está fiel:** o cruzamento status-local × status-da-Meta deu
> **nenhuma divergência**. O motor de regras decide pelo status local, então
> essa checagem vale repetir a cada sonda.

> ### ⛔ Valor NOVO da Meta aparece CRU — nunca vira chute
> A Meta acrescenta valores sem aviso. Um `default` que dissesse "não está
> veiculando" produziria diagnóstico falso; um que dissesse "veiculando"
> esconderia problema real. Valor fora do mapa é exibido **como veio** e marcado
> `desconhecido` — é o que faz a lacuna pedir correção em vez de passar batido.
>
> Pelo mesmo motivo a coluna é **`String?`, não enum**: um enum faria o **sync
> falhar** num valor novo, em vez de apenas exibi-lo sem tradução.

### 🔴 Três decisões que produzem alarme errado se forem invertidas

1. **NULO é "não informado", NUNCA "parado".** Antes do primeiro sync com este
   código, TODA linha do banco tem `effectiveStatus` nulo. Se nulo virasse
   alarme, o Gerenciador inteiro apareceria em âmbar no dia do deploy.
2. **Divergente = configurado `ACTIVE` **e** veiculação ≠ `ACTIVE`.** É o selo
   âmbar com ⚠. Linha **pausada** com `DISAPPROVED` não alarma: ela está parada
   por escolha, e o alarme existe para o que o usuário acha que está no ar.
3. **Status conclusivo responde sozinho.** `PAUSED`/`ARCHIVED`/`DELETED` não têm
   ambiguidade, então dispensam o campo da Meta. **É isto que faz a aba
   Arquivados distinguir arquivado de excluído** (o pedido): a Meta **não
   devolve objetos `DELETED`** em aresta de listagem nenhuma, então essas linhas
   nunca receberão `effectiveStatus` — sem esse ramo, "Excluído" ficaria em "—"
   para sempre.

### Onde aparece

Coluna **Veiculação**, logo depois do nome — antes de qualquer número, porque é
a pergunta que se faz primeiro: *"isto está rodando?"*. Gasto zerado numa linha
que não veicula não é problema de tracking, é a campanha parada.

O rodapé de totais mostra **"N sem entregar"** em âmbar. Um selo por linha se
perde numa lista de 40, e quem procura "por que não gastou nada" não vai rolar
até achar.

> ⚠️ **Na aba Contas a célula é um "—" seco, e a ausência é significativa.** Ali
> o toggle é "rastreando na Traffik", não entrega da Meta — quem veicula é
> campanha, conjunto e anúncio. Por isso `LinhaTabela.effectiveStatus` tem TRÊS
> estados: string (informado), `null` (não informado ainda) e **ausente** (este
> nível não tem veiculação). Um "aguardando sincronização" na aba Contas seria
> mentira.

> ⚠️ **`STATUS_SINCRONIZADOS` NÃO foi alterado.** Ele não pede `PREAPPROVED` nem
> `PENDING_BILLING_INFO`, então objeto nesses estados **não existe na
> ferramenta** — nem com o filtro "Arquivados". Acrescentá-los sem prova seria
> mexer no filtro que já derruba o sync inteiro quando erra (foi assim que 12
> campanhas sumiram). A `ads:sonda` consulta com a lista MAIOR justamente para
> dizer se existe algum: **se existir, ela manda acrescentar à lista.**

**Testado:** `npm run test:veiculacao` (40 asserções puras) + `test:veiculacao:e2e`
(13 asserções contra o banco de DEV, provando que o valor **chega** em
`computeAdsOverview` nos três níveis — a armadilha do `pedidoId` fora do
`select`, que nenhum `tsc`/`lint`/`build` acusa). **Conferido na tela** nos 4
níveis: campanha "Veiculando" × "⚠ Com problema", conjunto ligado com
"⚠ Campanha pausada", anúncio "⚠ Reprovado" ao lado de um "—" que **não** conta
no rodapé, e Contas com "—". Dados de teste restaurados por id depois.

### ⚠️ O que NÃO foi verificado

- 🔴 **Nenhuma resposta REAL da Graph API foi observada.** O campo entrou numa
  chamada que já acontecia (custo zero de rate limit), mas o formato e os
  valores continuam sendo os da documentação. **Rode a `ads:sonda` depois do
  primeiro sync** — é o mesmo risco de `AdSet.geoCountries`, que pode ficar
  inerte em silêncio.
- **Sem backfill**: toda linha nasce com `effectiveStatus` nulo e só o primeiro
  sync preenche. É por isso que nulo não pode alarmar.

## 🧫 A COBAIA: nenhuma campanha é crua, e não há tela para criar uma

**Medido em 31/07/2026:** as **13 campanhas** das duas contas têm 1 conjunto e 1
anúncio cada. **Nenhuma é crua.** A "Nova campanha de Engajamento" tinha
conjunto e anúncio ATIVOS e o gasto subiu de R$ 0,13 para R$ 0,17 entre duas
medições — estava entregando.

**A reconstrução:** o usuário criou a campanha pelo Gerenciador do Facebook, que
no fluxo guiado cria conjunto e anúncio junto. Ele acreditou ter criado uma
campanha crua, isso virou premissa escrita, e o plano de validação inteiro foi
construído em cima dela. É a mesma falha do "nenhuma escrita real foi
exercida": **uma afirmação plausível que ninguém mediu.**

> Isso também explica o `8/8/8` que a `ads:sonda` reportava por conta — não era
> campanha órfã, era 1 conjunto por campanha.

### 🔴 `POST /api/ads/campaign` cria SÓ a campanha — e não tem tela

Lido no código (`app/api/ads/campaign/route.ts` → `lib/facebook/manage.ts`):

```
POST /act_<conta>/campaigns
  name, objective, status: "PAUSED", special_ad_categories: "[]"
  daily_budget (só se vier no corpo, em centavos)
```

**Uma chamada, uma aresta.** Nada de `/adsets` nem de `/ads` — nem na Graph, nem
no banco local (o `upsert` cria só a linha de `Campaign`, com `status: PAUSED`).
É o oposto do fluxo guiado do Facebook.

> ### ✅ RESOLVIDO: a tela existe (31/07/2026)
> **"+ Nova campanha"** na aba Campanhas do Gerenciador →
> `views/ads/NovaCampanhaModal.tsx`. Conta, nome, objetivo (ODAX) e orçamento
> diário opcional. O texto diz o que ela cria e o que **não** cria.
>
> ⚠️ Os quatro handlers do estado eram `ChangeEvent<HTMLSelectElement>` —
> assinatura de `<select>` nativo, que este projeto não usa mais. Viraram
> `setNewCampaign*(valor)`. Nunca houve tela consumindo aquilo, então a
> assinatura era herança de um formulário que não existiu.
>
> ⚠️ **O campo de orçamento é o que define CBO**, e o texto diz isso: em branco,
> o orçamento vive nos conjuntos (ABO) e **regra de orçamento no nível de
> campanha não consegue alterá-lo**. Para a cobaia do teste do clamp, preencher
> é obrigatório.
>
> #### O histórico (por que ela não existia)
> `useTraffikState` tem `newCampaignOpen`, `openNewCampaign`, os 4 `onNewCampaign*`
> e o `createCampaign` — e **nenhum `.tsx` importa qualquer um deles**. A rota
> funciona, o estado existe, a tela nunca foi escrita.
>
> É o **sexto** caso do PROCEDIMENTO OBRIGATÓRIO nesta base: pronto, compilando,
> inerte. Entra na fila junto do resto do nav morto — mas aqui a dívida deixou
> de ser cosmética: **é o que impede criar a cobaia pela ferramenta.**

**Alternativa sem tela** (não é mais necessária, fica registrada): o console do
navegador logado no painel — usa o cookie de sessão, e a rota valida a posse da
conta pelo `userId`.

```js
await fetch("/api/ads/campaign", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    accountId: "<id INTERNO da conta>",   // npm run conta:estrutura mostra
    name: "COBAIA — não usar",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 20,                       // CBO: exigido pelo teste do clamp
  }),
}).then((r) => r.json());
```

`npm run conta:estrutura` passou a imprimir o **`accountId` interno** no
cabeçalho de cada conta, porque ele não aparece em lugar nenhum da interface.

⚠️ **Medir depois de criar, sempre.** `conta:estrutura` tem de mostrar
`○ crua (sem conjunto)`. Assumir foi exatamente o erro anterior.

### O que volta a ser seguro com uma cobaia comprovadamente crua

| Passo | Situação |
|---|---|
| **1(a)** pausar o já pausado | ✅ sempre foi seguro |
| **1(b)** ativar | ✅ volta a ser: sem conjunto não há entrega |
| **2** clamp de orçamento | ✅ volta a ser — ver abaixo |
| **3** ações em massa (recusa de R$ 1,00) | ✅ |
| **4** duplicar | ⚠️ nasce pausada, mas **reverter é o problema**: a única remoção pela ferramenta grava `DELETED`, que a Meta não desfaz |
| bid cap | ❌ continua impossível: é campo de CONJUNTO, e criar um destrói a propriedade que torna a cobaia segura |

### 🎯 Como exercitar o CLAMP sem risco financeiro

**A pergunta é boa: campanha crua não gasta, logo não gera métrica, logo nenhuma
condição real dispara.** Então sim, é preciso forçar — mas com uma diferença
decisiva em relação ao acidente:

> **Forçar de propósito, com a ferramenta dizendo que você está forçando.**
> `Gasto ≥ 0` faz a análise estática emitir *"todas as condições são sempre
> verdadeiras… a regra vai agir sobre TODAS as entidades do escopo"*, e o
> "Testar condição" responde *"Bate em N de N"*. O acidente foi forçar **sem
> saber**; aqui a tela avisa antes de salvar.

**O valor do orçamento não pode custar dinheiro, e é isso que fecha o risco.**
Orçamento é **teto de gasto, não gasto**. Numa campanha sem conjunto não há
entrega, então mesmo um erro de unidade que gravasse R$ 2.500 em vez de R$ 25
**não gastaria um centavo**. A cobaia crua protege exatamente contra o erro que
o teste existe para pegar.

**Receita:**

| | |
|---|---|
| Cobaia | crua, **PAUSADA**, criada com `dailyBudget: 20` |
| Regra | nível Campanha · conta = só a da cobaia · **aumentar 50%** · **teto R$ 25** |
| Condição | `Gasto ≥ 0` |
| Limite diário | **1** |

> ⚠️ **`AJUSTAR_ORCAMENTO` não exige status ACTIVE** — só `PAUSAR`/`ATIVAR`
> checam status. A campanha pode (e deve) ficar pausada durante o teste.

Esperado no Facebook: **R$ 25,00**.

| Resultado | Leitura |
|---|---|
| R$ 25,00 | ✅ clamp aplicou e as unidades estão certas |
| R$ 30,00 | clamp não aplicou (unidade ok) |
| R$ 0,25 | erro de unidade: dividiu por 100 |
| R$ 2.500,00 | erro de unidade: multiplicou duas vezes |
| Recusa da Meta | orçamento abaixo do mínimo da conta — rejeição legítima, é o Passo 3 |

Rodar **de novo** exercita a outra guarda: deve registrar `já no teto
(R$ 25,00)` **sem chamar a Meta**.

> ### 🔴 O RISCO REAL não é o clamp — é o ESCOPO
> `Gasto ≥ 0` bate em **tudo** que estiver no escopo. Se outra campanha daquela
> conta tiver orçamento no nível de campanha (CBO), **o orçamento dela também
> sobe até o teto**. Não é hipótese: é o mesmo mecanismo do acidente.
>
> Antes de salvar, `npm run conta:estrutura` mostra por campanha o campo
> *"orçamento na campanha"*: quem exibe `—` é ABO e o motor **pula** com
> *"sem orçamento diário (CBO?)"*; quem exibe um valor **será alterado**.
> Escolha a conta em que a cobaia seja a única com valor ali.
>
> ✅ **A prévia deixou de superestimar** (31/07/2026): ela agora informa
> **quantas a AÇÃO alcançaria**, não só quantas satisfazem a condição. Numa
> conta só de ABO, uma regra de orçamento aparece como *"Bate em 13 · ⚠ Mas a
> ação não alteraria nenhuma delas"*, com `sem orçamento diário (CBO?)` ao lado
> de cada linha. Ver "Prévia da regra".

## 🔎 Drill-down no Gerenciador (31/07/2026)

Marcar campanhas faz as abas **Conjuntos** e **Anúncios** mostrarem só o que
pertence a elas; marcar conjuntos filtra **Anúncios**. A marcação **sobrevive à
troca de aba** — sem isso o recurso não existiria.

### ⛔ É a GENERALIZAÇÃO do `contasFiltro`, não um segundo mecanismo

O `contasFiltro` já era exatamente isto para um nível só: reaproveitava o
checkbox da tabela (que na aba Contas não tinha função, porque não há ação em
massa para conta) como filtro das abas de baixo. Virou:

```ts
const [marcados, setMarcados] = useState<Record<Aba, Set<string>>>({
  accounts: new Set(), campaigns: new Set(), adsets: new Set(), ads: new Set(),
});
const selecao = marcados[v.adsSub];   // ← seleção de ação em massa da aba atual
```

> **O que está marcado num nível é, ao mesmo tempo, a seleção para ação em massa
> naquela aba e o filtro das abas abaixo dela.** São a mesma intenção do usuário
> ("estou trabalhando nestas"), então são o mesmo dado. Um filtro de campanha
> paralelo ao de conta divergiria do primeiro — foi assim que a contagem das
> abas e o filtro da tabela já divergiram, mostrando "12 campanhas" com a tabela
> vazia.

> ⚠️ **A contagem das abas usa EXATAMENTE os mesmos filtros das linhas.** Com o
> drill-down a chance de divergir dobrou: um filtro novo aplicado só nas linhas
> produziria a mesma mentira de novo. `contar()` recebe `campaignId`/`adSetId`
> além de `accountId`.

> ⚠️ **Trocar de aba NÃO limpa a marcação.** O `setSelecao(new Set())` que havia
> no clique da aba tornaria o drill-down impossível — a marcação É o filtro.

> ⚠️ **Ação em massa limpa só o nível onde agiu.** As abas acima seguem
> marcadas: elas são o filtro que trouxe aquelas linhas, e apagá-las tiraria o
> usuário do contexto em que estava trabalhando.

**Interseção, nunca substituição.** Vazio em qualquer nível = "todos". Conta +
campanha + conjunto se acumulam.

**A barra mostra só os níveis ACIMA do atual** — o que está marcado na própria
aba é seleção de ação em massa, não filtro dela mesma. Cada chip diz o nível
("campanha X", "conjunto Y"), remove individualmente, e há "Limpar seleção".

> ⚠️ **O estado vazio precisou de um caso novo**: *"Nenhum conjunto pertence ao
> que está selecionado nas abas acima."* Sem ele, a tabela vazia parece dado
> faltando. Vem **depois** do aviso de arquivados — aquele é o surpreendente
> (ninguém pediu por ele); este explica uma escolha do próprio usuário.

**Conferido na tela** (dev, 2 contas × 2 campanhas × 2 conjuntos × 2 anúncios):
marcar 1 campanha levou Conjuntos e Anúncios de "2 itens" para "1 item", com a
barra nomeando a campanha; marcar o conjunto acumulou o segundo chip e manteve
Anúncios em 1; a marcação sobreviveu a duas trocas de aba; contagem das abas e
linhas da tabela coerentes em todos os passos.
