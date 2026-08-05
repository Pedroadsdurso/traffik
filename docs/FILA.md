# FILA DE TRABALHO — a versão completa

> O CLAUDE.md tem a fila curta (o que vem agora). Este arquivo tem o raciocínio
> completo de cada item, incluindo o que já foi verificado como FEITO.

> ### ⚠️ Esta fila ENVELHECE
> Vários itens dela já estavam feitos quando foram lidos (3b, 3c, o free name
> das despesas, `newCampaign*`). **Confira no código antes de executar
> qualquer item.**

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 📋 FILA DE TRABALHO PENDENTE

Para referência direta: *"vamos para o item 3d"*. Ordem de prioridade definida
pelo usuário em 30/07/2026.

> ⚠️ **Os itens 3b e 3c foram VERIFICADOS no código e já estão feitos** — a fila
> original vinha de um levantamento antigo. Ver as notas em cada um. Confira
> antes de executar qualquer item desta lista: esta fila também envelhece.

### 🔴 EXCLUIR WEBHOOK ÓRFA AS VENDAS E APAGA O GATEWAY DELAS (31/07/2026)

**Não apaga venda** — `Sale.webhookId` é `onDelete: SetNull` e `deleteWebhook`
faz um `delete` seco, sem cascade. O faturamento histórico sobrevive, que é o
comportamento certo: quem troca de gateway não pode perder o histórico.

🔴 **Mas a PLATAFORMA é perdida para sempre.** `Sale` **não tem coluna
`platform`** — a única forma de saber de qual gateway uma venda veio é
`sale.webhook.platform`. Com o webhook excluído, a venda fica indistinguível de
uma ingerida por chave de API (que também nasce com `webhookId` nulo).

Consequências medidas no schema:

| | Efeito |
|---|---|
| Faturamento, KPIs, funil, globo | ✅ **intactos** — nenhum filtra por `webhookId` |
| Gateway de origem | 🔴 **perdido**, sem backfill possível |
| Área que filtre por webhook | a venda **sai** dela e cai na Principal |
| Venda de TESTE já ingerida | continua contando, e agora sem gateway para achá-la |

> ⚠️ **`SetNull` está certo; a falta da coluna é que não.**

✅ **CORRIGIDO em 31/07/2026** — migration `20260731030000_sale_platform`
(aditiva: `Sale.platform TEXT` nullable + índice `(userId, platform)`).
`receber.ts` passa `platform: dono.rotuloLog` para o `ingestSale`, que é a mesma
string do `WebhookLog` — de propósito, para as duas não divergirem.

`npm run backfill:platform` recupera o histórico **enquanto os webhooks
existirem**. Simula por padrão; lista as órfãs com data, produto, valor, status
e **id**, que é o que permite agir sobre uma linha específica.

> ### ⏳ ESTE BACKFILL TEM PRAZO
> Cada gateway que o usuário remove leva junto a procedência das vendas dele,
> **sem segunda fonte**. Rodar cedo salva mais história. As duas vendas da Cakto
> já se perderam assim, antes da coluna existir.

### 🔴 RELATÓRIO MULTI-USUÁRIO QUE AGREGA SEM SEPARAR (31/07/2026)

`origem-venda.mjs` listava as vendas órfãs **separadas por dono** e, no fim,
calculava o impacto com um `SUM` **sem `WHERE "userId"`** — somando o banco
inteiro. Saiu uma "distorção de 40,9% do faturamento" que **não era de conta
nenhuma**: misturava as vendas de teste do `teste@traffik.io` (a conta do seed)
com as do dono real.

**O usuário pegou o erro antes de apagar.** O número teria justificado excluir
dado para resolver um problema que a conta dele não tinha.

> ### ⛔ A REGRA
> **Toda métrica de diagnóstico é recortada por `userId`, e o total do banco não
> é exibido** — ele não corresponde ao dashboard de ninguém.
>
> O produto inteiro filtra por usuário. Um script que não filtra **está medindo
> outra coisa**, e o resultado é plausível o bastante para ninguém desconfiar.
> Foi por pouco que não virou exclusão de venda.
>
> ⚠️ Vale para qualquer script novo: `sonda`, `auditar`, `simular`, `inspecionar`.
> Se a saída tem um número somado, pergunte **de quem é esse número**.

⚠️ **Sintoma de reconhecimento:** o relatório *separa* na listagem e *soma* no
resumo. A listagem por dono dá a impressão de que o recorte está feito — e o
resumo desfaz, três telas abaixo.

⚠️ **Por que o erro passou, e é a parte reaproveitável:** a listagem **separava
por dono** e o resumo somava três telas abaixo. A separação visível na exibição
deu a impressão de que o recorte estava feito no cálculo também.

> ### ⛔ Relatório que separa na EXIBIÇÃO precisa separar no CÁLCULO
> Senão a separação vira **falsa garantia** — e é pior que não separar, porque
> quem lê já viu a divisão na tela e não desconfia do total.

### 🔴🔴 CREDENCIAL EM CÓDIGO-FONTE: a conta de seed em produção

`prisma/seed.ts` criava a conta com **senha literal no código**, e a conta
existia **no banco de produção** — foi lá que apareceram as 10 vendas de teste de
24-25/07 (`CERT-KV-1`, `CERT-API-1`, `burst-0..4`, `race-0..2`), resíduo dos
testes dos Blocos 10 e 13.

> ### ⛔ A REGRA: credencial em código-fonte é VAZAMENTO mesmo com o isolamento correto
> O isolamento por `userId` funcionava — a conta não via os dados do dono. E isso
> **não resolve nada**, porque o problema não é leitura de dado:
>
> **O isolamento protege os DADOS; ele não impede a SESSÃO.**
>
> Dentro daquela sessão dá para criar webhook, conectar perfil do Facebook,
> gerar chave de API e disparar eventos para a CAPI — no ambiente real, com
> qualquer pessoa que tenha lido o repositório.
>
> ⚠️ Não avalie "vazou credencial?" perguntando *o que ela consegue ver*.
> Pergunte *o que ela consegue fazer*.

#### ⛔ COMO ISSO ENTROU — e é o que faz voltar

Ninguém decidiu vazar nada. Alguém achou **útil anotar a credencial de teste na
documentação para não esquecer** — e isso é genuinamente conveniente. Depois, no
**mesmo formato e na mesma linha**, entrou a de produção:

```
Logins: teste@traffik.io / <senha> (vazio) · pedrodurso8@gmail.com / <senha> (dono)
```

O formato é o veículo. Uma vez que existe um lugar "onde as senhas ficam
anotadas", a próxima senha vai para lá sem ninguém reavaliar — inclusive uma que
abre a conta com o perfil do Facebook e 6 contas de anúncio reais.

> ### 🔴 DOCUMENTAÇÃO DE PROJETO É CÓDIGO VERSIONADO
> `CLAUDE.md`, `README`, `AGENTS.md` e comentário em migration vão no mesmo
> commit e no mesmo clone que o `.ts`. **A regra de credencial é idêntica** — não
> existe "é só a documentação".
>
> ⚠️ Credencial de TESTE não é exceção: ela é a porta de entrada do hábito. O
> lugar de qualquer senha é o `.env` (gitignored) ou o cofre do provedor.
>
> ⚠️ E é por isso que as 4 menções restantes da senha antiga foram **removidas
> deste arquivo** mesmo já estando inertes: enquanto o padrão de anotar
> credencial na documentação existir aqui, ele será seguido de novo.

**Corrigido em 31/07/2026, com DUAS travas independentes** — cada uma bastaria,
e é por isso que as duas ficam:

1. **`exigirBancoDeDesenvolvimento()` no `seed.ts`**, antes de abrir conexão.
   É o que impede a conta de **voltar a existir** em produção. Verificado: com
   o ref de produção na `DATABASE_URL`, `npx prisma db seed` é recusado.
2. **Senha por `SEED_PASSWORD`**; sem ela, uma **aleatória** é gerada e impressa
   uma vez. Não existe mais valor conhecido para vazar.

O `upsert` passou a reescrever o `passwordHash` no `update` — sem isso, rodar o
seed numa base que já tem a conta manteria a senha antiga, inclusive a
a senha literal legada. Rodar o seed virou a forma de rotacionar.

⚠️ **A correção não apaga a conta que já existe em produção.** Ela impede a
recriação. Apagar é operação manual — ver `npm run conta:inventario`.

### Auditoria de credenciais no repositório (31/07/2026)

| Onde | O quê | Veredito |
|---|---|---|
| `prisma/seed.ts` | senha literal da conta de seed | 🔴 **era real e em produção** — corrigido |
| `scripts/seed-dev.mjs` | `dev123456` | ⚠️ literal, mas o script **já tem** `exigirBancoDeDesenvolvimento()` — não alcança produção. Migrar para env quando conveniente |
| `src/lib/gateways/exemplos/cakto.ts` | `secret: "f8c3de3d-…"` | ✅ valor da **documentação** da Cakto, usado só pelo testador. Não cria nada |
| `src/generated/prisma/**` | `accessToken`, `secret` | ✅ falso positivo — são **nomes de coluna** do cliente gerado |
| `.env*` | tudo | ✅ gitignored (`.env*`, com `!.env.example`) |

> ⚠️ **Nenhuma senha de banco está versionada** — mas as do dev e da produção
> passaram pelo chat e seguem pendentes de rotação em Supabase › Settings ›
> Database. Isso é anterior a esta auditoria e continua aberto.

### ⚠️ `teste@traffik.io` EXISTE EM PRODUÇÃO, com senha documentada

Criado por `prisma/seed.ts` (com a senha literal, hoje corrigida), é a conta que `demo-data.mjs` mira.
Ela está **no banco de produção** — foi lá que apareceram as 10 vendas de teste
de 24-25/07 (`CERT-KV-1`, `CERT-API-1`, `burst-0..4`, `race-0..2`), resíduo dos
testes dos Blocos 10 e 13.

🔴 **A senha está escrita neste arquivo e no seed.** Qualquer um que leia o
repositório entra na produção com ela. Os dados são de outra conta e o
isolamento por `userId` se mantém — mas é uma sessão válida no ambiente real.

**Ação recomendada:** apagar o usuário em produção (o `User` tem 15 relações
`Cascade`, então leva junto vendas, cliques, eventos, webhooks e pixels dele) ou
trocar a senha. **Rodar `prisma db seed` contra produção recria a conta.**

### 🔴 MIGRATION QUE CRIA CONSTRAINT TEM DE FAZER O DADO SATISFAZÊ-LA

**31/07/2026 — `20260731040000_pixel_event_dedup` falhou em produção** com
`23505 — could not create unique index`, duplicata
`(…, PageView, PageView-nblqy2)`.

A causa imediata foi a ordem invertida (push antes da migration). Mas a lição
**não** é "siga a ordem":

> Uma migration que exige que o mundo já esteja num certo estado é **dependente
> de ordem** — e ordem se inverte. Deploy corre em paralelo com quem roda o
> comando, um retry acontece, alguém aplica na sequência errada. Se a única
> defesa é disciplina humana, ela falha eventualmente.
>
> **A migration tem de ser autossuficiente:** se cria constraint, ela mesma
> remove o que a viola, no mesmo arquivo e na mesma transação. Aí ela funciona
> em qualquer ordem, e rodar de novo é seguro.

⚠️ **Neste caso a janela era estreita e mesmo assim foi atingida.** O índice era
criável enquanto todo `eventId` fosse aleatório (não colidem nunca). Bastou o
código determinístico subir primeiro para a duplicata nascer — em minutos.

#### Respondendo às duas alternativas consideradas

| Alternativa | Veredito |
|---|---|
| **Migration limpa antes de criar o índice** | ✅ **é a correta.** `DELETE … USING` mantendo a linha mais antiga, e só então `CREATE UNIQUE INDEX` |
| Código fazer upsert tolerando a ausência da constraint | ❌ não era o problema. `createMany({ skipDuplicates: true })` **já** funciona sem o índice — sem ele apenas não deduplica, o que é degradação, não falha. O código estava certo; a migration é que não era |

#### Estado durante a falha, para a próxima vez

`CREATE UNIQUE INDEX` roda dentro da transação da migration, então a falha faz
**rollback completo**: o índice não existe, nenhuma coluna mudou, nenhum dado
foi tocado. O bloqueio é **só de contabilidade** — a linha em
`_prisma_migrations` com `finished_at` nulo. O schema fica íntegro.

#### ⚠️ Por que a `040000` NÃO foi retrofitada

Ela **já tinha sido aplicada com sucesso no banco de desenvolvimento**. Editar
um arquivo de migration já aplicado muda o checksum que o Prisma guarda, e o
`migrate deploy` seguinte passa a recusar com *"migration modified after being
applied"*. Corrigir o passado quebraria o dev para consertar a produção.

A saída foi **`npm run pixel:duplicatas`** (simula por padrão; mantém a linha
mais antiga de cada grupo, desempate por `id` para ser determinístico), seguido
de `migrate resolve --rolled-back` e nova aplicação.

**Exercitado no dev derrubando o índice, semeando 3+2 duplicatas e limpando:**
3 removidas de 3 previstas, 0 grupos restantes, e os sobreviventes foram
exatamente as linhas mais antigas de cada grupo.

### ⛔ REGRA PERMANENTE: excluir configuração não pode apagar a PROCEDÊNCIA

Já existia a metade fácil da regra — *exclusão de configuração nunca destrói
dado de negócio* —, e ela estava sendo cumprida: `SetNull` em vez de `Cascade`.
Faltava a outra metade:

> **Guardar só a FK para a configuração deixa o dado órfão de CONTEXTO quando
> ela some.** O dado sobrevive e deixa de significar alguma coisa.
>
> Todo atributo que responde *"de onde isto veio?"* tem de ser **copiado para a
> linha no momento em que ela nasce**, não derivado por `join` na hora da
> leitura. O `join` é conveniência; a cópia é o registro.

**Auditoria das 15 relações `SetNull` do schema — um segundo caso, e é grave:**

| Relação | Procedência em risco | Veredito |
|---|---|---|
| `Sale.webhookId` | gateway de origem | ✅ **corrigido** (`Sale.platform`) |
| `Sale.apiCredentialId` | veio por chave de API | ✅ coberto — o backfill grava `platform: "API"` |
| `Sale.clickId` | campanha, criativo, fonte, UTMs | ✅ **FECHADO em 05/08/2026** |
| `AdAccount.adProfileId` | perfil do Facebook | tolerável: a conta guarda `act_id` e nome próprios |
| `Notification.saleId` | venda que gerou o aviso | tolerável: a notificação carrega o texto |
| `*.workspaceId` (9×) | área | não é procedência — área é recorte, e é reatribuível |

> ### ✅ `Sale` guarda cópia dos UTMs — e a atribuição finalmente a LÊ
> A cópia (`Sale.utmSource/Medium/Campaign/Content/Term` + `fbclid`) existe desde
> a migration `20260731080000`. **Mas nenhum leitor a consultava até 05/08/2026**
> — toda a atribuição fazia `sale.click.utmCampaign` direto, então o seguro era
> pago em toda ingestão e não cobria nada.
>
> Hoje quem decide é `utmsDaVenda` (a cadeia `Sale → Click` vence; a cópia entra
> quando o clique já não existe), e os `select` espalham `CAMPOS_UTM` para a
> coluna não poder ser esquecida. Ver "A CÓPIA DOS UTMS EXISTIA E NINGUÉM LIA".
>
> ⚠️ **`Click.workspaceId` continua sem cópia, de propósito** — o único caminho
> que apaga clique é "apagar dados" na exclusão de área, e ali a área declarada
> está sendo excluída junto, então `valida()` a recusaria de todo jeito.

### 🧪 PASSO OBRIGATÓRIO ao adicionar gateway: como ele sinaliza EVENTO DE TESTE

Acrescentado ao roteiro de 5 passos de `lib/gateways/` como **passo 0**, porque
tem de ser respondido **antes** de conectar em produção:

> **Descubra como o gateway marca um evento de teste, e declare isso no
> registro.** Se não houver sinal, **avise o usuário de que todo teste de
> webhook dele vai contar como venda real** — no faturamento, no CPA, no funil e
> no globo.

Não é hipótese: a Cakto ingeriu `Produto Teste / R$ 90,00` como venda, e a linha
**ainda conta**, agora sem gateway para achá-la (foi removida antes da coluna
`platform` existir). Um gateway novo repete isso por omissão.

⚠️ **O sinal tem de ser ESTRUTURAL** (`test: true`, ambiente declarado, id
reservado) — **nunca o nome do produto**. Detectar "Produto Teste" apagaria a
venda real de quem chame o produto assim.

### 🧪 Evento de TESTE da Cakto conta como venda real — PENDENTE

O webhook de teste da Cakto ingeriu `Produto Teste / R$ 90,00` e a linha
**conta no dashboard como venda**. Não há noção de "evento de teste" em lugar
nenhum do contrato de gateways.

**Bloqueado por falta do payload real.** Suspeita forte: ela reenvia o exemplo
da documentação verbatim — `exemplos/cakto.ts` tem `product.name: "Produto
Teste"` e `amount: 90`, que batem com o observado. **Não detectar por nome de
produto** (apagaria venda real de quem chame o produto assim); o sinal tem de
ser estrutural.

⚠️ **Enquanto isto não for resolvido, todo teste de webhook na Cakto vira
faturamento.** O usuário removeu a Cakto em 31/07/2026, então a investigação só
retoma quando ele reativar:

```bash
npm run venda:inspecionar -- --url '<conn>' --gateway CAKTO --n 5
```

### 🔌 Vias de atribuição por gateway — decisão de 31/07/2026

> ### ⛔ CAMPANHA precisa de CERTEZA. PAÍS precisa só de PLAUSIBILIDADE.
> Tratar as duas com o mesmo mecanismo faz pagar o preço da certeza para
> resolver a segunda. Errar a campanha move dinheiro entre campanhas e envenena
> a otimização; errar o país move um ponto no globo.

| Uso | Via aprovada |
|---|---|
| **Atribuição (campanha)** | **A** (parâmetro ecoado pelo gateway, uma linha no `REGISTRO`) + **B** (`fbc`/`fbp`, já pronto) |
| **País, e só país** | **D** (beacon de checkout com `click_id`, casado por proximidade de tempo + produto) — **com `countrySource` próprio**, para a confiança ficar registrada |
| Recusadas | **C** (e-mail pré-checkout: a maioria dos funis não coleta) |

| Gateway | `click_id` ecoado (A) | `fbc`/`fbp` (B) | IP do comprador |
|---|---|---|---|
| **Kirvano** | `src` ✅ | só `fbp` | ✅ `customer.ip` |
| **Cakto** | `sck` ✅ | ✅ os dois | ❌ |
| **OnyxPag** | 🔴 `tracking` **não volta** no webhook documentado | ❌ nenhum | ❌ |

> ### 🔴 A OnyxPag não tem via de atribuição NENHUMA
> A, B e E falham nela por desenho. Venda dela entra **sem campanha, sem
> criativo e sem país**, dependendo só do fallback. **A interface precisa
> avisar** — a capacidade já está declarada no registro, falta a tela ler.

### 0. GERENCIADOR — (a) e (b) FEITOS em 31/07/2026

**(a) Drill-down por campanha** → ✅ feito. Ver "Drill-down" abaixo.

> ⚠️ **Interseção com o filtro de conta, nunca substituição.** Nenhuma
> selecionada = mostra todas. A seleção sobrevive à troca de aba.
>
> É **generalização** do filtro de conta que já existe (`contasFiltro` +
> `daConta()` em `AdsManagerView`), não código novo. Se virar um segundo
> mecanismo paralelo, está errado — os dois vão divergir, como já divergiram a
> contagem das abas e o filtro da tabela.
>
> Custo: só cliente e interface. Sem schema, sem sync, sem migration — portanto
> sem ordem de deploy e sem risco em produção.

**(b) `effective_status`** → ✅ feito. Ver "Status de VEICULAÇÃO" abaixo.

### 0b. PRÉVIA DA REGRA → ✅ FEITO (31/07/2026)

Ver "Testar condição" abaixo. O que segue é o desenho, mantido porque explica
**o que foi recusado** e por quê.

#### Como ficou

| Peça | Onde |
|---|---|
| `previewRule(rule)` | `lib/rules/engine.ts` — reusa `loadEntities` + `conditionsMet` |
| `analisarCondicoes(conds)` | `lib/rules/analise.ts` — puro, sem dado nenhum |
| `previewRuleConditions(input)` | `lib/actions/rules.ts` — recebe o RASCUNHO, não um id |
| Botão "Testar condição" | `views/rules/RuleDrawer.tsx`, dentro do bloco Condições |

> ### 🔴 A prévia REUSA o motor — nunca uma segunda implementação
> Ela é uma **promessa do que o motor vai fazer**. Uma segunda cópia da
> avaliação divergiria da primeira, e a prévia passaria a prometer uma coisa
> enquanto o motor faz outra — pior que não ter prévia, porque cria confiança
> falsa em algo que mexe em orçamento real.
>
> `previewRule` para **antes** do caminho de ação: não chama `setEntityStatus`
> nem `updateDailyBudget`, não grava log, não mexe em `lastRunAt`.

> ⚠️ **A prévia NÃO aplica janela de horário nem limite diário**, de propósito.
> A pergunta é sobre a CONDIÇÃO ("bate em quem?"), não sobre "rodaria neste
> minuto?". Misturar as duas faria a prévia responder "0" às 3h da manhã por
> causa da janela, e o usuário concluiria que a condição está errada.

> ⚠️ **O resultado é descartado quando o rascunho muda.** `chavePrevia` cobre
> condições, nível, contas, período e produtos. Número velho ao lado de condição
> nova é pior que número nenhum — parece confirmação.

> ⚠️ **Quando nada bate, ela lista o que foi AVALIADO** (com "·" em vez de "✓").
> Uma tela muda justamente quando o usuário precisa entender *por que* não bateu
> seria o pior momento para ficar calada.

#### 🔴 BATER a condição ≠ SER ALTERADA (corrigido em 31/07/2026)

A primeira versão contava só quem satisfazia a condição, e isso **exagerava**.
Numa conta em que **todas as campanhas são ABO** — o caso real do usuário, 13 de
13 —, uma regra de orçamento bate em todas e altera **nenhuma**. Um número que
exagera ensina o usuário a ignorá-lo, que é o oposto do objetivo.

A prévia devolve `agiria` além de `bateram`, e cada linha traz **o motivo do
pulo**: `sem orçamento diário (CBO?)`, `já pausada`, `já ativa`, `já no teto
(R$ …)`, `recusado: aumento sem teto de orçamento configurado`.

> ### 🔴 `planejarAcao` — a decisão foi EXTRAÍDA do motor, não copiada
> Ela decide se a ação agiria e qual seria o novo orçamento, e é chamada pelos
> **dois**: o laço de `evaluateRule` e a prévia. Reimplementar a regra do teto
> na prévia produziria o pior resultado possível — uma prévia que promete uma
> coisa e um motor que faz outra, num código que mexe em orçamento real.
>
> ⚠️ O campo `ok` do plano preserva a semântica do log: pulo esperado ("já
> pausada", "já no teto") conta como sucesso; recusa ("sem teto", "sem
> orçamento") não. É o que alimenta `affected` — mexer ali muda o que a
> ferramenta reporta como feito.

> ⚠️ **A ação e seus parâmetros entram na `chavePrevia`.** Eles não mudam quem
> BATE, mas mudam quem a ação ALCANÇA — trocar de "pausar" para "ajustar
> orçamento" com o número antigo na tela seria a pior forma de mentir.

#### O que a análise estática pode e não pode afirmar

`lib/rules/analise.ts` só emite o que é demonstrável **por álgebra**:

1. **Contradição** — `Gasto > 100 E Gasto < 50` nunca é verdadeira.
2. **Piso das métricas** — `cpa`, `roas`, `ctr`, `gasto` e `vendas` são todas
   ≥ 0 por construção em `metricValue`, então `gasto ≥ 0` é sempre verdadeira e
   `gasto < 0` nunca é.

> ### ⛔ `gasto ≤ 999999` NÃO gera aviso estático — e isso é a decisão, não uma falha
> Provar que "999999 é grande" exigiria conhecer a faixa plausível de cada
> métrica. Erraria nos dois sentidos, e **um aviso que às vezes mente treina o
> usuário a ignorar todos os avisos** — inclusive os dois acima, que são certos.
>
> Quem responde "isso pega tudo?" é a PRÉVIA, contando: ela mostra
> **"Bate em 2 de 2"** em âmbar, com a frase *"a condição bate em tudo que está
> no escopo; se a ideia era filtrar, confira o operador"*. Contar em vez de
> adivinhar é a regra deste módulo.
>
> ⚠️ **ROI está fora da lista de propósito**: ele pode ser negativo (o piso é
> −1). Não é métrica de regra hoje; se entrar, o piso dele **não é 0**.

**Testado:** `npm run test:analise-regra` (32 asserções puras, várias delas
provando o que o módulo **se recusa** a afirmar) + `npm run test:previa-regra`
(16 asserções contra o banco de DEV: escopo igual ao do motor, arquivada fora,
o caso `≤ 999999` × `≥ 999999`, e **nada muda no banco depois de rodar**).
**Conferido na tela** com os dois operadores: `≤ 999999` → "Bate em 2 de 2" em
âmbar com o aviso; `≥ 999999` → "Bate em 0 de 2" em cor neutra, listando as duas
avaliadas com o gasto real.

> 🐛 **O primeiro `teste-analise-regra.mjs` deu 29 falsos negativos**: o helper
> `eq` comparava com `===` e quase toda asserção devolve um ARRAY, então
> comparava identidade de referência — "obtido" e "esperado" saíam idênticos na
> tela e o teste falhava. O módulo estava certo desde o início. Hoje o helper
> compara por `JSON.stringify`. **Teste que falha imprimindo dois valores iguais
> é bug do teste, não do código.**

#### Desenho original (mantido para referência)

A condição `gasto ≤ 999999` (pega tudo) é **visualmente idêntica** a
`gasto ≥ 999999` (não pega nada), e nada no produto distingue as duas até a
regra rodar. Ver "O ENSAIO A SECO DISPAROU".

> ### ⛔ NÃO implemente isto como heurística de "condição trivial"
> A tentação óbvia é um aviso do tipo *"`≤ 999999` provavelmente pega tudo"*.
> Isso é chute com cara de garantia: depende de saber a faixa plausível de cada
> métrica, erra nos dois sentidos, e um aviso que às vezes mente treina o
> usuário a ignorá-lo — o mesmo defeito do aviso âmbar que aparece sempre.
>
> **A resposta certa não é adivinhar, é CONTAR:** um botão *"Testar condição"*
> na gaveta que roda a avaliação sem agir e responde
> **"bate em N de M campanhas agora"**. Com `≤ 999999` teria dito "1 de 1", e o
> erro seria visível antes de salvar.
>
> Ele **reusa `loadEntities` + `conditionsMet`** — a mesma avaliação do motor,
> nunca uma segunda cópia (o motor divergiria da prévia, e a prévia é justamente
> a promessa do que ele vai fazer). O caminho de ação fica de fora: prévia não
> chama `setEntityStatus` nem `updateDailyBudget`.
>
> É o Passo 0 do plano da Graph API virando **funcionalidade** em vez de
> procedimento manual — e é o que teria evitado o disparo acidental.

**Complemento barato, este sim determinístico:** contradição entre condições
(`gasto > 100 E gasto < 50` nunca bate) e limite inferior conhecido (toda
métrica é ≥ 0, então `métrica ≥ 0` é sempre verdadeira e `métrica < 0` nunca é).
Esses dois são demonstráveis sem dado nenhum, ao contrário de "999999 é muito".

### 1. CAKTO + arquitetura universal de gateways — **PRÓXIMO**

Segundo gateway, com a camada de parsers que suporta muitos outros depois.
**Destrava o item 2.**

> ### ✅ O CRITÉRIO DE ACEITE: o teste do décimo gateway
> **Integrar o 10º gateway tem de custar um arquivo de parser + o cadastro da
> plataforma. Zero mudança em qualquer outro lugar.**
>
> Se integrar o próximo exigir mexer em rota, em `ingestSale`, na UI de
> Webhooks, num `switch` ou num `if` de plataforma, **a arquitetura falhou** —
> não importa quão limpo esteja o parser. O teste não é "o código está bonito",
> é "quantos arquivos eu toco".
>
> Hoje a rota `/api/webhook/sale/[webhookId]` já escolhe o parser pela
> `platform`, e o `GATEWAYS` da `WebhooksView` já é um array extensível. Os dois
> são o embrião certo — o trabalho é levar isso até o fim, não recomeçar.

> ### 🎛️ CAPACIDADES são propriedade do REGISTRO, nunca caso especial no código
> Gateways diferem no que conseguem entregar, e **essa diferença tem de ser
> declarada como dado**, ao lado do parser:
>
> | Capacidade | Por que importa | Se faltar |
> |---|---|---|
> | **Manda o IP do comprador?** | é a fonte confiável do país da venda | a venda cai no fallback do clique, e **55,6% do tráfego humano passa pelo datacenter da Meta** — o país vira estimativa |
> | **Manda `fbc`/`fbp`?** | melhora a correspondência na CAPI | perde sinal de atribuição |
> | **Manda taxas já calculadas?** | evita recalcular gateway/imposto | o cálculo cai em `lib/financeiro.ts`, com as taxas cadastradas |
> | **Manda telefone? Em que formato?** | E.164 antes do hash da CAPI | ver `lib/facebook/telefone.ts` |
> | **Reentrega o mesmo evento?** | idempotência | já coberto pelo upsert monotônico |
>
> ⚠️ **Declarar, e não descobrir por `if`.** Um `if (platform === "CAKTO")`
> espalhado pela ingestão é exatamente o que faz o 10º gateway custar caro. A
> capacidade vira campo do registro; o código lê o campo.
>
> ⚠️ **A tela precisa ler isso.** É o que permite avisar "este gateway não manda
> o IP do comprador, então o país destas vendas é estimado" — hoje o chip âmbar
> "estimado" do ranking já existe e é alimentado por `countrySource`. A
> capacidade declarada é o que torna o aviso **preventivo** em vez de
> retrospectivo.
>
> A tabela por gateway já iniciada está em "REQUISITO DE TODA INTEGRAÇÃO DE
> GATEWAY NOVA" — **Kirvano ✅ confirmado com 15 vendas reais**, os demais ❓.

> ### 🔴 Restrição que vale desde já
> **O reprocessamento PRECISA preservar `country`/`countrySource` quando já não
> são nulos.** `ingestSale` recalcula `paisDaVenda` a cada ingestão e a 2ª fonte
> é o IP do payload — reprocessar com o IP removido (item 2) faria o país
> recalculado **piorar**, caindo para o país do clique ou para o texto cru.
>
> Sem essa regra, a primeira correção de parser que rodar degrada
> geolocalização que já estava certa.

Hoje só a **Kirvano** tem parser dedicado (`parseKirvano.ts`), mais o
`normalizeSale` genérico. Ver "REQUISITO DE TODA INTEGRAÇÃO DE GATEWAY NOVA" —
a pergunta obrigatória é **se o gateway manda o IP do comprador no payload**.

### 2. FASE A — limpeza do IP nos payloads — **ADIADA**

**Pré-condição: a arquitetura de parsers do item 1 estar estável**, e não haver
mais nada a reprocessar. O payload cru é a única fonte para refazer uma venda
com um parser corrigido.

**Versão preferida: remover só o campo de IP**, preservando o resto. Substituir
o valor (`"ip": "[ip removido]"`), **não apagar a chave** — apagá-la muda a forma
do payload e faz depurar contra um formato que nunca chegou. Detalhes completos
na seção "🔐 Passo 7".

### 3. FILA DE UX — nunca executada, ~5 sessões

**(a) Microcópia** — textos com termo técnico ou plural entre parênteses.

> ⚠️ **A lista de ~52 reescritas NÃO existe no repositório.** Procurei: o que
> está documentado são os ~30 textos **já reescritos** (grupos 1 e 2) e os
> grupos 3 e 4, que viraram tooltips em `lib/explicacoes.ts`. **O levantamento
> precisa ser refeito**, não recuperado.
>
> Ao refazer: `lib/explicacoes.ts` é mais completo do que parece — confira antes
> de "adicionar tooltip". E vale a regra permanente: **simplifique jargão de
> PROGRAMAÇÃO, nunca de TRÁFEGO.** ROAS, CPA, CBO, pixel e gateway são o
> vocabulário nativo do usuário.

**(b) Scripts e snippets em gaveta** — ✅ **JÁ FEITO.** Verificado: `UtmsView`,
`PixelView` e `WebhooksView` usam `Drawer`/`CampoCopiavel`. A URL do webhook
visível já é a exceção prevista.

**(c) Padronização de controles** — ✅ **JÁ FEITO.** Verificado no código:

| | Alegado na fila | Real |
|---|---|---|
| `<select>` nativos | ~22 em 8 arquivos | **0**, fora das 2 exceções documentadas (mês/ano do `DateRangePicker`, `test-checkout`) |
| Checkboxes nativos | 7 | **0** (a única ocorrência é um comentário) |
| Ícones `0 0 256 256` | dois sistemas | **0** — `Icon.tsx` foi deletado; a única ocorrência é um comentário histórico |

**(d)** ⚠️ **ESCOPO REDUZIDO em 01/08/2026** — ver "ITEM (d) — escopo NOVO". Não é mais varrer 23 blocos: são 4 tipos de overlay + os condicionais.

**(d) PROMPT J — responsividade em duas dimensões** (viewport e container).
Inclui os dois casos confirmados:
- Rodapé do funil — ✅ **resolvido** (`min-height:0`; a causa é genérica, ver a
  seção própria)
- ⏳ **Varredura de elementos condicionais** — semear dados que ativem **cada**
  caminho (estados de erro, avisos, rodapés, badges, chips) e conferir **cada um
  na tela**. A auditoria feita deu "0 de 23", mas só prova que não há transbordo
  **naquele estado de dados**.

**(e) Espaço mal aproveitado nas abas** — ✅ **FEITO.** Webhooks, UTMs, Taxas e
Pixel em 30/07/2026; **Testes e Notificações em 31/07/2026** (ver a seção
própria). Áreas e Regras **não têm restrição de largura** — o item da fila
estava desatualizado.

**(g)** ✅ **FEITO em 01/08/2026** — ver "COMECE AQUI". O que segue é o desenho
original, mantido porque explica o que foi recusado (o preset) e por quê.

**(g) 🔴 REGRAS EM DUAS REGIÕES — prioridade ACIMA do (f)** *(decidido em
31/07/2026)*

Herdar da gaveta do Pixel reformada as duas coisas que transferem, e só elas:

1. **Separação por região, com selo** — o análogo do `⟳ muda o script` × `⚡ vale
   na hora`:

   | Região | Selo |
   |---|---|
   | Ação, teto de orçamento, escopo (contas/produtos/nível) | **mexe na sua conta do Facebook** |
   | Período de cálculo, frequência, intervalo de execução, limite diário | **só decide quando roda** |

2. **Esconder no avançado** o que tem padrão sensato: intervalo de execução,
   limite diário e período de cálculo. De ~11 controles visíveis para ~5 (nome +
   escopo + condição + ação).

> ### 🔴 Por que isto vale MAIS que na gaveta do Pixel
> Lá o pior caso de misturar as regiões era **script defasado**. Aqui um dos
> grupos **move dinheiro real** — pausa campanha e altera orçamento sozinho, de
> madrugada — e hoje os dois estão **intercalados** na mesma gaveta.

> ### ⛔ NÃO invente uma pergunta única aqui
> A terceira ideia da gaveta do Pixel — *uma pergunta em vez de vinte escolhas* —
> **não transfere**, e isso foi avaliado e recusado em 31/07/2026. Ela funciona lá
> porque existe um caso comum de verdade (infoprodutor com o pixel do Facebook já
> na página) que deriva os demais campos. Numa regra não existe caso comum: a
> escolha da ação **é** a decisão. Um preset aqui inventaria uma pergunta, que é o
> oposto do objetivo.
>
> Pelo mesmo motivo isso não vale para as outras telas: Webhooks já é montada do
> registro, Áreas já foi reduzida a três campos na Sessão 3, e Notificações são
> booleanos independentes — lá o que faltava era tornar visível a dependência
> (com os dois alertas desligados, os quatro "Exibir na notificação" não aparecem
> em lugar nenhum), e isso já foi acrescentado.

**(f)** ✅ **FEITO em 01/08/2026** — ver "COMECE AQUI". Os tooltips ⓘ nas métricas
já existiam em `lib/explicacoes.ts` desde os grupos 3 e 4; o que faltava eram os
7 estados vazios mudos e o checklist que mostrava a área errada.

**(f) Camada didática** — estados vazios que ensinam, indicador de progresso de
configuração, tooltips ⓘ nas métricas.

### 4. RAMOS NUNCA EXERCIDOS — mapeado, sem ação

`cities`, `regions` e `country_groups` em `paisesDaSegmentacao` (`sync.ts`).
Cobertos por asserção e **nunca rodaram contra resposta real da Graph API** — a
sonda de 30/07/2026 mostrou 12 conjuntos, todos pelo caminho simples
(`countries`), zero dos outros três.

Aparecem quando o usuário criar campanha segmentada por cidade/região, ou usar
grupo de países. **`country_groups` é o mais arriscado**: não é expandido de
propósito, então uma campanha "Europa" produz lista vazia e simplesmente não
desempata — comportamento correto, mas silencioso.


## 🔬 ITEM (d) — MEDIDO em 05/08/2026: metade do escopo já não existe

**A seção abaixo está desatualizada e foi mantida só como histórico.** Ela diz
que o `Drawer` tem "largura FIXA em px — 520 padrão, 560 nas gavetas de Regra e
Pixel. Abaixo de ~600px de viewport não cabe". **Isso é falso hoje.**

Medido lendo o código:

| Overlay | Estado real |
|---|---|
| `ui/Drawer` | ✅ `width:min(${largura}px, 100%)` — vira 100% no estreito |
| `ui/Modal` | ✅ mesma fórmula |
| Dropdown do `Select` (`.tk-pop`) | ⚠️ **não é `position:fixed` nem portado** — é `absolute` com `left:0` |
| Popup do `DateRangePicker` | ⚠️ idem |

> ### ⛔ "4 tipos de overlay `position:fixed`" também está errado
> Só **dois** são `fixed` e portados para o `<body>` (Drawer e Modal), e os dois
> já se resolvem sozinhos no estreito. Os outros dois são `absolute` dentro do
> próprio container — o que muda o problema: não é largura, é **ancoragem**.

**O que sobrou de verdade:** `.tk-pop` tem `min-width` vindo de quem chama (até
290px) e `left: 0`, sem reposicionamento. Num viewport estreito ele podia ficar
mais largo que a tela.

✅ **Aplicado agora:** `max-width: calc(100vw - 24px)` no `.tk-pop`. O
`min-width` perde para o `max-width` no CSS, então o teto vence — e em tela
larga a regra é **inerte**, porque o popup nunca chega perto de 100vw.

⚠️ **O que NÃO foi feito, de propósito:** a ancoragem continua `left: 0`. Um
seletor colado na borda direita ainda pode transbordar para fora. Reposicionar
(flip) muda o comportamento em TODAS as larguras, e eu não consegui medir no
estreito — mudar o que não dá para verificar é como o rodapé do funil ficou
invisível por semanas.

### 🔴 A pré-condição do resize continua BLOQUEADA — e foi reproduzida

Com a janela maximizada (medido: `innerWidth 2560 === screen.availWidth 2560`):

```
resize_window(560, 850) → "Successfully resized window ... to 560x850 pixels"
innerWidth                → 2560
```

**Reportou sucesso e não redimensionou.** Os três contornos, e por que nenhum
serviu nesta sessão:

| Contorno | Situação |
|---|---|
| Restaurar a janela (Win+Down) | 🔴 precisa do usuário — a extensão manda tecla para a PÁGINA, não para o gerenciador de janelas |
| `chrome-devtools-mcp` → `resize_page` (CDP) | 🔴 **as ferramentas estavam desconectadas** nesta sessão |
| `window.open` com largura | 🔴 bloqueado (sem gesto do usuário) |

**Para a próxima sessão: restaure a janela ANTES de começar.** E a regra que
não muda: depois de qualquer resize, **leia `innerWidth` e compare** — a
mensagem de sucesso não vale nada.

### ✅ A varredura de CONDICIONAIS não depende de viewport, e rodou

Semeando os estados que só aparecem sob certos dados (efeito com erro +
mensagem crua longa, `sem_token`, espelho quebrado, "sem registro"):

| | |
|---|---|
| Cards em Integrações › Testes | 15 |
| Com transbordo | **0** |
| Página com rolagem horizontal | **não** |
| Caminhos condicionais que ATIVARAM | **6 de 6**, confirmados por texto na tela |

> ⚠️ **A confirmação de que ativaram é o que dá valor ao "0 de 15".** Sem ela
> seria o mesmo "0 de 23" da auditoria anterior: um layout que não quebra
> porque nada foi renderizado. Foi essa checagem que mostrou que o bloco de
> erro de CONTA **não** vive na vitrine de Anúncios (está dentro da gaveta do
> perfil) e portanto continua sem varredura.

**Ainda sem varredura:** os condicionais que vivem DENTRO de gaveta (erro de
conta + backoff em Integrações › Anúncios) e o Gerenciador com filtros/estados
combinados.
