# Gateways — arquitetura universal, parsers e capacidades

> Leia ao integrar gateway novo, mexer em parser, ou investigar venda que
> entrou incompleta. O roteiro de 5 passos e o critério do 10º gateway estão
> aqui.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🔌 ARQUITETURA UNIVERSAL DE GATEWAYS (30/07/2026 — etapa 1 de 8)

`src/lib/gateways/` é a camada por onde passa **toda** venda que entra na
ferramenta, venha de qual gateway vier.

```
lib/gateways/
  contrato.ts        VendaNormalizada, Capacidades, GatewayDef  ← LEIA PRIMEIRO
  campos.ts          pick/toStr/toNumber/comoLista/fbclidDoFbc
  registro.ts        REGISTRO — um gateway = uma entrada
  autenticar.ts      estratégias plugáveis (segredo, HMAC)
  receber.ts         receptor único: log → auth → parse → ingestão
  parsers/{kirvano,generico}.ts
```

### ⛔ Como adicionar um gateway novo — o roteiro completo

1. **`parsers/<nome>.ts`** — uma função `parse(payload) → { vendas: [] }`.
2. **Uma entrada em `REGISTRO`** — auth, capacidades, URL, campos, instalação.
3. **`public/logos/<nome>.webp`** (e a chave em `ui/LogoGateway`).
4. **Um payload de exemplo** em `exemplos`, para o testador.
5. **Rodar o payload real no testador** (Integrações › Testes) e conferir que
   **não sobrou nada em âmbar**.

> ### 🔴 O passo 5 não é opcional — é onde o parser errado se denuncia
> O testador tem três estados por campo, e o terceiro é a razão de ele existir:
>
> | Estado | Significa |
> |---|---|
> | **lido** (verde) | o parser extraiu o valor |
> | **o gateway não enviou** (cinza) | não há nada parecido no payload |
> | 🔴 **está no payload e não foi lido** (âmbar) | o dado VEIO, com outro nome, e o parser o descartou |
>
> Campo vazio parece igual nos dois últimos casos. Sem o âmbar, um gateway que
> manda o IP como `buyer_ip_address` (em vez de `customer.ip`) passaria como
> "não envia IP" — e a geolocalização de todas as vendas dele viraria estimativa
> sem ninguém saber por quê.
>
> **Âmbar sobrando = parser incompleto.** Corrija antes de conectar em produção.
>
> ⚠️ Confira também o bloco "O que este gateway entrega": *"veio, mas não estava
> previsto"* é sempre erro do **registro** — a capacidade declarada está mentindo
> para o usuário na tela.

**Nada mais.** Nem rota, nem `ingestSale`, nem métrica, nem tela. Se um gateway
novo exigir mexer em qualquer um desses, a arquitetura regrediu — o critério não
é "o código está bonito", é **quantos arquivos eu toco**.

> ⚠️ **NÃO crie rota para gateway novo.** `/api/webhook/sale/{token}` é o
> receptor universal: o token identifica o webhook, o webhook diz a plataforma, o
> registro diz o resto. A rota `/api/webhook/kirvano?id=` existe **só** porque
> aquela URL já está colada no painel do usuário — é alias de 3 linhas, e é a
> única exceção que jamais deve ganhar companhia.

### As 3 regras do contrato — as três já custaram caro em outro lugar

| | Regra | O que ela evita |
|---|---|---|
| 1 | **Ausência é `null`, nunca `0`** | `taxaGateway: 0` afirma "não cobrou"; `null` diz "não sabemos" e cai na taxa cadastrada. Colapsar as duas faz o líquido aparecer maior que a realidade, plausível e falso |
| 2 | **Reprocessar nunca degrada dado derivado** | `country`/`countrySource` e `clickId`/`matchMethod` só podem ser sobrescritos por fonte **igual ou mais forte**. Reprocessar com o IP já purgado pioraria o país já resolvido |
| 3 | **`parse` devolve sempre uma LISTA** | order bump e upsell existem em quase todo gateway; quem assume "1 payload = 1 venda" quebra em silêncio, com faturamento certo e contagem inflada |

> ⚠️ A **regra 2 está declarada no contrato mas ainda não implementada** — é a
> etapa 2. Hoje o `ingestSale` tem uma versão parcial (`...(country ? {} : {})`)
> que protege contra apagar com `null`, e **não** contra sobrescrever com fonte
> mais fraca.

### 🎛️ Capacidades são DADO, não `if`

Gateways diferem no que entregam, e a diferença é declarada ao lado do parser:
`ipDoComprador`, `fbc`, `fbp`, `utms`, `taxasCalculadas`, `comissoes`,
`telefone`, `agrupaItens`, `reentregaEventos`.

É o que permite a tela avisar **antes** — "este gateway não informa o endereço do
comprador, então o país destas vendas é estimado" — em vez de o usuário descobrir
olhando um mapa errado. Um `if (plataforma === "CAKTO")` na ingestão é exatamente
o que faz o décimo gateway custar caro.

> ⚠️ **As capacidades da Kirvano foram medidas nos 64 payloads REAIS**, não lidas
> na documentação — e duas contrariaram a suposição: ela **manda `fee` e o bloco
> `fiscal`** (36 de 46 eventos) e **manda `cookies.fbp`** (45 de 46). Os dois
> estavam sendo descartados pelo parser. Ela **não** manda `fbc`.

### Prova de paridade — `npm run test:gateways`

`scripts/fixtures/parsers-esperado.json` congela a saída do código ANTIGO sobre
**167 payloads reais de produção** (115 `WebhookLog` + 26 `Sale.rawPayload`). O
teste compara a camada nova contra ele: 31 asserções, 0 falhas.

> ⛔ **Nunca regenere o snapshot para "fazer o teste passar".** Ele existe para
> recusar isso. `snapshot-parsers.mjs` exige `--aceitar` escrito no comando, pela
> mesma razão do `ALLOW_PROD_WRITES`: atalho curto vira hábito.

E `npm run test:receptor` prova que a camada está **sendo exercida**, não só
compilando: 13 asserções em HTTP real contra o dev server (banco de DEV, limpeza
por id no fim). Ver o PROCEDIMENTO OBRIGATÓRIO — `tsc`, `lint` e `build` passam
com a coisa desligada.

### ⏱️ Orçamento de 5 segundos

A Cakto considera **falha de entrega** acima de 5 s. Medido: **~318 ms** aquecido
no caminho de recusa (2 idas ao banco), ~700 ms no caminho completo.

> ⚠️ A folga existe porque a CAPI do Facebook e as notificações rodam no
> `after()` do Next 16. **Chamada HTTP nova no caminho síncrono** devolve dois
> problemas de uma vez: estoura o orçamento do gateway e segura conexão do pool,
> alongando a janela de disputa entre eventos concorrentes.

### Etapa 2 — precedência de fonte e dois bugs de status

**A REGRA 2 saiu do papel** (`lib/gateways/fontes.ts`): a força da procedência
entra no `WHERE` do `UPDATE`, em instrução separada da do status. São perguntas
diferentes — "este evento é mais novo?" × "esta inferência é melhor?" — e um
evento pode responder sim a uma e não à outra.

> 🐛 **Bug que já existia:** o upsert fazia `...(match.clickId ? {...} : {})`,
> que protege contra apagar com `null` e **não** contra sobrescrever com fonte
> mais fraca. Um segundo evento casando por `ip` num clique DIFERENTE substituía
> um match `direct`. A venda passava a apontar para outro visitante — e daí saem
> país, campanha e atribuição.

**Fonte desconhecida vale 0**, o mínimo. Esquecer de cadastrar nunca amplia
permissão de escrita — mesma regra da autenticação: a dúvida vira bloqueio.

#### 🔴 PIX vencido e carrinho abandonado inflavam "Vendas pendentes" em 67%

Medido na produção: **13 das 14 vendas pendentes estavam erradas.**

| | Vendas | Valor |
|---|---|---|
| Exibido | 14 | R$ 512,35 |
| PIX vencido (`PIX_EXPIRED`) | 12 | R$ 317,65 |
| Carrinho abandonado | 1 | R$ 24,90 |
| **Pendente de verdade** | **1** | **R$ 169,80** |

`PIX_EXPIRED` não estava no mapa e caía num fallback que só reconhecia
`"APPROVED"` — virava PENDENTE apesar de o payload dizer `status: "CANCELED"`.

> ### ⚠️ A correção que importa NÃO foi acrescentar o evento ao mapa
> Foi trocar o fallback pelo `statusPeloTexto()`. Tentar adivinhar a lista
> completa de eventos de um gateway é uma corrida que se perde sempre; ler o
> campo de situação, que o gateway preenche de qualquer jeito, faz o **próximo**
> evento desconhecido cair no lugar certo em vez de virar "pendente" por omissão.

**Migration `20260730220000`** acrescenta `EXPIRADA` e `ABANDONADA`.

> ### ⛔ Por que NÃO reusar CANCELADA para o PIX vencido
> Ela é **terminal** (força 4), e o dado real traz a sequência
> `PIX_GENERATED → PIX_EXPIRED → PIX_GENERATED` no MESMO pedido: o cliente volta
> a tentar. Com status terminal, o `SALE_APPROVED` seguinte não conseguiria
> sobrescrever e **a venda paga sumiria do faturamento**. Perder receita para
> consertar um KPI seria péssimo negócio.
>
> A escala virou `ABANDONADA 0 < PENDENTE 1 < EXPIRADA 2 < APROVADA 3 < terminais 4`.
> EXPIRADA acima de PENDENTE impede que a reentrega do `PIX_GENERATED` antigo
> ressuscite o PIX vencido; abaixo de APROVADA garante que pagar corrige tudo.
>
> ⚠️ **Custo consciente:** quem gera um PIX NOVO depois do vencimento fica
> exibido como EXPIRADA até pagar. Erra para o lado de *subnotificar* pendente —
> o oposto do bug — e o faturamento sai certo nos dois casos.

> ### ⚠️ `gerouCheckout` existe porque separar os status quase apagou o funil
> `checkoutEvent.ts` decidia por `status === "PENDENTE"`. Com o carrinho
> abandonado virando ABANDONADA, ele deixaria de gerar `InitiateCheckout` — o
> funil encolheria como efeito colateral **invisível** de uma correção de KPI.
> Hoje quem decide é o EVENTO, declarado pelo parser no contrato.

#### `npm run backfill:status` — simula por padrão

> ### ⚠️ A guarda óbvia estava ERRADA, e só rodar contra linhas reais mostrou
> A primeira versão recusava qualquer rebaixamento (`FORCA[novo] <= FORCA[atual]`)
> — e `PENDENTE → ABANDONADA` **é** um rebaixamento, ou seja, ela vetava
> exatamente a correção que existe para fazer.
>
> A guarda certa é outra: no upsert em tempo real dois EVENTOS disputam a linha
> e o mais avançado vence; no backfill é o MESMO evento relido por um parser
> corrigido. O que sobra a proteger é o que custaria caro perder — venda
> **APROVADA** e os terminais, cujo status veio de mapeamento explícito e nunca
> do fallback quebrado.
>
> Provado no dev com os 4 casos semeados: PIX vencido → EXPIRADA, carrinho →
> ABANDONADA, PIX gerado **fica** PENDENTE, e a venda APROVADA **não é tocada**.

### Etapa 3 — CONVERSÃO ≠ ITEM VENDIDO

**Migration `20260730230000`**: `Sale.pedidoId` (nullable) + `Sale.itemTipo`
(default `"principal"`) + índice `(userId, pedidoId)`.

`lib/pedidos.ts` é a fonte única. As duas contagens existem e respondem a
perguntas diferentes:

| Pergunta | Conta |
|---|---|
| Quanto faturei? | **linhas** — 90 + 27 = 117 |
| Quantas conversões tive? | **pedidos** — 1 |
| CPA, taxa de aprovação, funil | **pedidos** |
| Ticket médio | faturamento ÷ **pedidos** (é o valor do carrinho) |
| Vendas por produto | **linhas** — ali o item é o assunto |

Medido com 1 checkout com order bump + 1 simples (3 linhas, 2 compradores):

| | contando ITENS | contando PEDIDOS |
|---|---|---|
| Vendas | 3 | **2** |
| CPA | R$ 100,00 | **R$ 150,00** |
| Ticket médio | R$ 72,33 | **R$ 108,50** |
| Faturamento | R$ 217,00 | R$ 217,00 |

**O CPA aparecia 33% mais barato que a realidade** — e o número parecia
plausível, que é o que torna esse erro caro.

> ### ⛔ Contagem e soma no MESMO laço, nunca `umPorPedido` onde há valor
> A primeira versão trocou `for (const s of approved)` por
> `for (const s of umPorPedido(approved))` nos laços de país, hora e dia. Isso
> corrige a contagem e **descarta o faturamento do order bump** — o gráfico
> deixaria de bater com o KPI de faturamento.
>
> Onde o laço soma valor, ele percorre TODAS as linhas e incrementa a contagem
> só no primeiro item de cada pedido. `umPorPedido` só serve onde não há soma
> (taxa de aprovação).

> ### ⚠️ `pedidoId` NULO é o que preserva o histórico
> `chaveDoPedido()` cai no próprio `id`: venda anterior à migration é o próprio
> pedido, exatamente como antes. Sem esse fallback, todas colapsariam num balde
> `null` e o CPA histórico explodiria.

> ### 🐛 Faltou o `pedidoId` no `select` — e a contagem voltou a ser por item
> Com a coluna fora do `select`, `chaveDoPedido` cai no `id` e **tudo volta ao
> comportamento antigo, em silêncio**, com o número parecendo plausível. Foi
> pego pelo teste ponta a ponta; nenhum `tsc`/`lint`/`build` acusaria.
>
> Vale para os três consumidores: `dashboard/metrics.ts`, `ads/overview.ts` e
> `ads/creatives.ts`.

> ### ⚠️ O `Set` de pedidos é POR DESTINO, não global
> No Gerenciador a mesma venda é atribuída a uma campanha **e** a um anúncio. Um
> conjunto único faria a segunda atribuição ser descartada, zerando a coluna de
> vendas no nível de anúncio.

**`checkoutEvent` deduplica por `gw:<pedidoId>`.** Com a chave por item, um
checkout com bump geraria N `InitiateCheckout` para o mesmo carrinho, inflando o
topo do funil e derrubando a taxa de conversão.

> ⚠️ **A Kirvano continua sendo 1 linha por venda**, e é o correto: o order bump
> dela vem dentro de `products[]` (com `is_order_bump: true`), na MESMA venda.
> Separar em linhas exigiria mudar o `externalId` para `<sale_id>:<offer_id>` — e
> mudar identificador já emitido faria o upsert criar linhas NOVAS ao lado das
> existentes. O custo aceito: os produtos de bump da Kirvano não aparecem em
> "Vendas por produto". Quem gera N linhas é a Cakto, cujos itens já vêm com id
> próprio.

> ### 🕐 O teste tropeçou no bug de fuso que o projeto documenta
> Ele semeava o gasto com `CURRENT_DATE`, que é o dia do BANCO (UTC). Rodando às
> **00h01 UTC = 21h01 em Brasília**, o gasto caiu no dia seguinte e o CPA veio 0.
> É a janela exata descrita em "Fuso horário — causa raiz". Hoje semeia com
> `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.
>
> **Nenhuma agregação usa o dia do processo — e nenhum teste deveria semear com ele.**

### Etapa 4 — taxa REAL do gateway vence a cadastrada

**Migration `20260731000000`**: `Sale.taxaGateway` e `Sale.coproducao`, ambas
`Decimal?`. A Kirvano manda `fee` e o bloco `fiscal` em 36 de 46 eventos reais;
a Cakto manda `fees` e `commissions[]`. Tudo isso era descartado, e o desconto
saía de uma taxa **média** cadastrada à mão.

> ### 🔴 PERÍODO MISTO É O CASO NORMAL — e a tela é obrigada a dizer
> Basta ter dois gateways, ou um que só informe a taxa em parte dos eventos.
> Um Faturamento Líquido que soma **medida com estimativa sem dizer qual é
> qual** é pior que não ter o dado: parece exato e não é. Exigência explícita do
> usuário em 31/07/2026.
>
> Por isso a procedência vive no **rótulo do card**, não só no tooltip:
>
> | Situação | Rótulo |
> |---|---|
> | Todas as vendas informaram | "taxa informada pelo gateway" |
> | **Misto** | **"taxa real em 12 de 30 vendas"** |
> | Nenhuma informou | "após taxas e impostos" (como antes) |
>
> `Composicao.fontes` devolve `{ real, estimado, vendasComValorReal,
> vendasSemValorReal }` por desconto. **Não remova esse campo** — sem ele a tela
> volta a exibir um número de fonte mista sem procedência.

> ### ⛔ A base da taxa cadastrada ENCOLHE, senão desconta duas vezes
> Com 2 vendas de R$ 100, uma informando R$ 7,50 e a outra não, o desconto é
> `7,50 + 5% de 100 = 12,50`. Se a base continuasse sendo o faturamento inteiro
> daria `7,50 + 10,00 = 17,50` — cobrando taxa duas vezes da venda que já
> informou a própria.

> ### ⚠️ NULO ≠ ZERO, e é aqui que custa dinheiro
> `NULL` = o gateway não informou → usa a taxa cadastrada.
> `0` = ele informou que não cobrou → desconta nada.
> Colapsar os dois faz o líquido aparecer MAIOR que a realidade. É a REGRA 1 do
> contrato de gateways, agora no schema.

> ### ⚠️ A comissão do PRODUTOR fica de fora da coprodução
> Ela é o que sobra para o dono da conta, não um custo. Somá-la zeraria o lucro
> de toda venda. Só entram as entradas cujo tipo não é produtor.

> ### ⚠️ `faltando` para de cobrar cadastro do que já é medido
> Se TODAS as vendas do período informaram a taxa, o aviso âmbar some — cobrar
> cadastro de um número já medido treina o usuário a ignorar o aviso. Com
> mistura, ele **continua** aparecendo: metade das vendas depende do cadastro.

`npm run test:financeiro` — **54 asserções**, 12 delas cobrindo esta etapa,
inclusive o chamador antigo (sem lista de vendas) mantendo o comportamento
anterior.

### 💳 Dívida conhecida: order bump da Kirvano não aparece em "Vendas por produto"

O order bump dela vem dentro de `products[]` (com `is_order_bump: true`), na
MESMA venda — então a Traffik grava 1 linha com o nome do produto principal e o
`total_price` somado. O faturamento está certo; o **produto do bump é invisível**
no ranking de produtos e nos produtos descobertos por área.

**A saída é migração de DADOS, não mudança de parser.** Separar em linhas exige
que o `externalId` vire `<sale_id>:<offer_id>` — e mudar identificador já emitido
faz o upsert criar linhas NOVAS ao lado das existentes, duplicando as 26 vendas
de produção. Seria preciso: migrar as linhas antigas para a chave nova, e só
então trocar o parser, num único passo transacional.

**Decisão do usuário em 31/07/2026: não vale o risco agora.** Fica registrado
para ser reavaliado quando houver volume que justifique.

> ⚠️ A Cakto **não** tem esse problema: os itens dela já chegam como entradas
> separadas, com id próprio e `parent_order`.

### Etapa 5 — correspondência da CAPI e o backfill das taxas

**Migration `20260731010000`**: `Sale.fbc` e `Sale.fbp`.

#### Dois sinais perdidos em silêncio

| Sinal | O que acontecia | Agora |
|---|---|---|
| **`_fbp`** | **nunca era enviado** — o campo não existia no `user_data`, e a Kirvano manda em 45 de 46 eventos | vai para a CAPI |
| **`_fbc`** | fabricado com `Date.now()` | usa o cookie REAL do gateway; sem ele, reconstrói com o **instante do CLIQUE** |

> ### ⚠️ O terceiro segmento do `_fbc` é QUANDO O COOKIE FOI CRIADO
> `fb.<sub>.<criado_em>.<fbclid>` — é o momento do clique no anúncio. Havia
> `Date.now()`, que é o instante em que a VENDA foi processada. Num Pix pago
> dois dias depois, a string não batia com a do navegador do comprador.
>
> Nenhum dos dois fazia a chamada falhar. Degradam a correspondência, que
> alimenta a otimização das campanhas — dinheiro real, sem erro e sem log.

**Medido: apenas 1 venda foi afetada até hoje**, e com defasagem de 0,00 dia (a
venda foi processada no mesmo instante do clique). O estrago acumulado é
praticamente nulo; o que importa é daqui para frente, com PIX pago com atraso.

#### Match por `fbc` — a via principal da Cakto

| # | Via | O que prova |
|---|---|---|
| 1 | `click_id` público | o NOSSO script propagou o id. Identifica a SESSÃO, sem janela |
| 2 | **`fbc` → `fbclid`** | identifica o CLIQUE no anúncio |
| 3 | IP do payload | inferência frouxa, 12 h |

> ⚠️ O `click_id` continua vencendo: os dois identificam a mesma pessoa, mas o
> nosso id sobrevive a um visitante que voltou pelo anúncio duas vezes (mesmo
> `fbclid`, sessões diferentes). A força já estava em `fontes.ts`.
>
> 🔴 **Para a Cakto o `fbc` é a via PRINCIPAL** — ela não manda o IP do
> comprador, então sem esta via a venda dependeria só do `click_id`.

#### 🔒 `npm run backfill:taxas` — o primeiro teste REAL da restrição

Relê o `rawPayload` com o parser atual e grava **só** `taxaGateway`/`coproducao`.

Medido nas 26 vendas reais de produção (semeadas no dev):

| | |
|---|---|
| Ganham taxa real | **14** (R$ 46,61 recuperados) |
| Payload não traz o dado | 12 |
| Faturamento líquido | R$ 1.307,77 → **R$ 1.305,15** |
| Procedência | 2 vendas com taxa real, 10 pela cadastrada → **período MISTO** |

> ### 🔴 A restrição, MEDIDA em vez de prometida
> A simulação reporta o que aconteceria **se** o reprocessamento recalculasse o
> país com o payload já purgado (Fase A): **15 das 26 vendas PERDERIAM o país.**
>
> É exatamente isso que a regra impede — e agora está exercitado, não suposto.
> Depois do `--aplicar`, o script compara `country`/`countrySource` **linha a
> linha** e falha se qualquer um mudou. Saiu idêntico; a 2ª passada não mexe em
> nada.
>
> ⚠️ O `SET` toca só as duas colunas de taxa. País, fonte, clique, método de
> match e status ficam de fora — a restrição é **estrutural**, não uma promessa
> no comentário.

`npm run test:correspondencia` — 8 asserções, interceptando o `fetch` para ler o
`user_data` que iria à Meta. Sem rede e sem banco.

### Etapas 6 e 7 — Cakto e a tela montada do registro

**A Cakto custou exatamente:** um parser, uma entrada no registro, uma logo e um
arquivo de exemplos. Zero rota, zero mudança em `ingestSale`, métricas ou lógica
de venda. É o critério de aceite, verificado na prática.

| | Kirvano | Cakto |
|---|---|---|
| Order bump | dentro de `products[]`, uma venda só | **entradas separadas**, id próprio |
| `data` | objeto | **objeto OU array** (individual × agrupado) |
| IP do comprador | manda | 🔴 **não manda** |
| `fbc`/`fbp` | só `fbp` | **os dois** |
| Segredo | usuário cria lá e cola aqui | **nós geramos**, ele cola lá |
| Nomes de evento | inglês | **mistura idiomas** (`pix_gerado` × `purchase_approved`) |

A mistura de idiomas é a prova de que o mapa tem de ser **por plataforma**: não
existe regra geral que traduza `pix_gerado` e `purchase_approved` ao mesmo tempo.

> ### ⚠️ `initiate_checkout` e `checkout_abandonment` caem os dois em ABANDONADA
> A diferença entre "começou" e "desistiu" não muda o que a venda **é**: um
> carrinho sem pagamento. O que eles precisam fazer — alimentar o funil — vem de
> `gerouCheckout`, não do status. Distinguir os dois na tela depois é **estado
> novo**, não remendo.

> ### ⚠️ `subscription_created` lê o campo `status`, e isso é deliberado
> A documentação não diz se criar a assinatura implica cobrança aprovada. Mapear
> para APROVADA **inventaria faturamento**; para PENDENTE **esconderia venda
> paga**. Ele está numa lista de "conhecidos porém ambíguos" — o que evita o
> falso alarme de "evento desconhecido" sem fingir que sabemos a resposta.

> ### ⛔ `commissions[]`: só `producer` conhecido → `coproducao` fica NULL
> `0` afirmaria "não há coprodução" e o líquido apareceria MAIOR que a realidade.
> Um tipo diferente entra na lista **e vira aviso** — é assim que a estrutura
> real vai ser descoberta quando aparecer.

**A tela é montada do registro** (etapa 7): rótulos, campos, passos de instalação
e o subtítulo da gaveta. A `WebhooksView` tinha uma lista local que **já
divergia** — a Cakto existia no backend com parser e capacidades, e não aparecia
na tela porque ninguém lembrou de acrescentá-la em dois lugares.

> ### 🔑 Gateway cuja chave NÓS geramos precisa MOSTRÁ-LA
> `campos[].gerado: true` faz a gaveta gerar um uuid na hora e exibi-lo num campo
> copiável. Sem isso a chave era gerada, salva e nunca mostrada — e o webhook
> ficava **impossível de configurar do outro lado**, porque a Cakto exige o
> `secret` no corpo.

**Verificado na tela** (dev, `dev@exemplo.dev`): a gaveta abre com a Cakto
primeiro, chave gerada com botão Copiar, os 4 passos de instalação e os dois
passos de atenção em âmbar (disparo AGRUPADO e localização estimada). O testador
foi exercitado com os 4 exemplos, incluindo o evento desconhecido — o aviso
aparece — e com um payload adulterado, onde o âmbar pegou `buyer_ip_address` e
`cliente_fbc`.

## 🟩 OnyxPag — o terceiro gateway (31/07/2026)

Custou o que o critério de aceite exige: **um parser, uma entrada no registro,
uma logo e um arquivo de exemplos.** Zero rota, zero mudança em `ingestSale`,
métricas ou lógica de venda. (A única linha fora disso foi um texto da gaveta —
ver o fim desta seção.)

Documentação: https://doc.onyxpag.com

| | Kirvano | Cakto | **OnyxPag** |
|---|---|---|---|
| Segredo no webhook | header | corpo | 🔴 **nenhum** |
| IP do comprador | manda | não | não |
| `fbc`/`fbp` | só `fbp` | os dois | 🔴 **nenhum** |
| UTMs de volta | sim | sim | 🔴 não documentado |
| Taxa calculada | `fee` | `fees` | ✅ `fee_amount` |
| Valor | `"R$ 197,00"` | número | `"25.90"` (**ponto** decimal) |
| Order bump | em `products[]` | linhas separadas | `items[]` de 1 transação |

### 🔴 O primeiro gateway SEM segredo — e por que `exigir: false` aqui é certo

A doc é explícita: *"No additional HTTP headers (signatures, tokens, or secrets)
are specified for webhook validation"*. O webhook nem é cadastrado em painel —
o endereço vai no campo `postbackUrl` de **cada cobrança criada**.

Exigir segredo recusaria **100% das entregas dela**. Isso não é falhar fechado,
é não integrar. É o **segundo** caso de `exigir: false` (o primeiro é `CUSTOM`),
e a mitigação é a mesma: **a URL é a credencial**, então ela só aparece na
gaveta com botão de copiar, nunca na listagem — e um passo de instalação em
âmbar manda tratá-la como senha.

`onde` continua listando header e corpo: se a OnyxPag passar a assinar, ou se o
usuário puser um segredo, ele passa a ser **exigido**.

### 🔴 Primeiro gateway sem NENHUMA via de atribuição

Sem `click_id`, sem `fbc` e sem IP, não há o que casar com o clique: a venda
entra sem campanha, sem criativo e sem país. O `tracking` que a API aceita na
**criação** da cobrança (`utm_*`, `sck`, `client_reference_id`) **não aparece no
payload do webhook documentado**.

O parser procura esses campos **defensivamente** em `data.tracking` e
`data.metadata` — se a doc estiver incompleta, a atribuição funciona sozinha. As
capacidades foram declaradas conforme a documentação (`utms: false`), e quem
decide é um payload REAL no testador.

> ⚠️ **`transaction.expired` → `EXPIRADA`, não `CANCELADA`.** Terminal impediria
> o `transaction.paid` de um PIX gerado de novo de sobrescrever, e a venda paga
> sumiria do faturamento. Mesma razão do PIX vencido da Kirvano.

> ⚠️ **`"25.90"` tem PONTO decimal**, ao contrário do `"R$ 197,00"` da Kirvano.
> `toNumber` lê os dois; a armadilha seria um parser de vírgula caseiro, que
> leria isso como **2590**.

> ⚠️ **UMA venda por transação — não dividimos `items[]`.** Dividir seria
> possível (há `unit_price` e `quantity`), e não fazemos por duas razões: não há
> id por item, então o `externalId` viria do índice e uma reentrega em ordem
> diferente **duplicaria faturamento em silêncio**; e `amount` é o total
> autoritativo, que a soma dos itens pode não fechar. Mesma escolha da Kirvano,
> mesmo custo aceito: **order bump aparece no valor, não em "Vendas por
> produto"**.

**Testado:** `npm run test:onyxpag` — 38 asserções, **zero campos em âmbar** nos
5 exemplos. `npm run test:gateways` (45 asserções de paridade dos parsers
antigos) continua passando. **Conferido na tela**: a OnyxPag aparece na grade com
a logo, os 4 passos de instalação e o campo de chave como opcional.

> ⚠️ **Os exemplos são da DOCUMENTAÇÃO, e só o primeiro é literal** — a doc mostra
> um payload só. Passar no teste não substitui rodar um payload REAL no testador,
> e aqui há suspeita concreta de doc incompleta (o `tracking`).

### A logo precisou virar quadrada

`onyx-logo-light.png` é um wordmark **3,24:1 com fundo branco opaco**. O
`LogoGateway` renderiza num quadrado de 34px com `objectFit: contain` — contida,
ela viraria uma tarja de 10px de altura com o texto ilegível. Foi recomposta
numa tela **256×256 com o mesmo fundo branco** que a arte já traz, que é o que o
`overflow:hidden` arredonda (igual à da Kirvano).

> Regra para a próxima: **wordmark largo tem de ser quadrado antes de virar
> `.webp`**. Só logo já quadrada pode ir direto.

### 🐛 E um bug antigo que a OnyxPag revelou

O botão "Adicionar" da gaveta checava `!gatewaySecret.trim()`
**incondicionalmente** — escrito quando Kirvano e Cakto eram os únicos gateways
e os dois exigiam chave. Resultado: o campo dizia **"(opcional)"** e o botão
ficava desabilitado do mesmo jeito.

Atingia a OnyxPag e, **desde sempre e sem ninguém notar, o "Sistema próprio"**
(`CUSTOM`) — que também tem a chave como opcional. Ou seja: nunca foi possível
cadastrar um checkout próprio sem inventar uma chave.

Agora a trava sai do **registro** (`campos[].obrigatorio`), que é a mesma fonte
de onde vem o rótulo "(opcional)". Tirar os dois do mesmo lugar é o que impede
a tela de dizer uma coisa e o botão exigir outra.

> ⚠️ **Padrão que fica:** toda regra de formulário que dependa do gateway sai do
> `REGISTRO`. Se aparecer uma condição escrita à mão na `WebhooksView`, ela vai
> divergir do registro no gateway seguinte — foi exatamente o que aconteceu aqui.

### O único arquivo fora do roteiro

O subtítulo da gaveta tinha **dois** fluxos (`geradoPorNos` ou não) e a OnyxPag é
um **terceiro**: sem chave nenhuma. Ela caía no texto *"informe a chave de
segurança gerada no painel dele"* — mandando o usuário procurar uma chave que
não existe. Agora são três ramos, derivados de `auth.geradoPorNos` e
`auth.exigir`.

> Não é falha da arquitetura: é o registro ganhando uma combinação que a tela
> ainda não sabia descrever. Mas conta como arquivo tocado, e por isso está aqui.

### O que a etapa 1 **não** fez

Etapas 2 a 8, na ordem acordada: precedência de fonte (2) · `pedidoId`+`itemTipo`
e contagem por pedido (3) · `taxaGateway`+`coproducao` (4) · match por `fbc` e
DDI só com país medido (5) · parser da Cakto + testador (6) · tela montada do
registro (7) · esta documentação (8, feita agora).

A `WebhooksView` ainda tem o array `GATEWAYS` local, duplicando o registro — sai
na etapa 7. Enquanto isso, **o registro é a fonte de verdade do servidor** e o
array só decide o que aparece no modal.

## ✅ CAKTO VALIDADA EM PRODUÇÃO COM VENDA REAL (31/07/2026)

Não é mais "passa nos exemplos da documentação". O usuário configurou o webhook
na Cakto, ela disparou eventos de teste, e ele **gerou e PAGOU um PIX real** —
tudo contabilizado na ferramenta.

**A arquitetura universal de gateways está validada com um segundo gateway de
verdade**, ponta a ponta: receptor universal → estratégia de auth da plataforma →
parser dedicado → formato interno → ingestão → métricas.

E ela custou o que o critério de aceite exigia: **um parser, uma entrada no
registro, uma logo e um arquivo de exemplos.** Zero rota, zero mudança em
`ingestSale`, nas métricas ou na interface.

### 🔎 `npm run venda:inspecionar` — "a venda entrou COMPLETA?"

Faturamento certo **não** responde essa pergunta: um parser pode acertar o valor
e descartar a taxa, o país, o agrupador do pedido ou o casamento com o clique, e
a tela continua parecendo correta.

O inspetor mostra campo a campo **e o que significa cada vazio** — a mesma
distinção do testador de payload ("o gateway não manda" × "o parser não leu"),
aplicada ao que ficou GRAVADO. Ele lê as capacidades do registro para decidir se
um vazio é esperado ou é bug:

```bash
npm run venda:inspecionar -- --url '<conn>' --gateway CAKTO --n 2
```

**Somente leitura** — pode rodar em produção.

Exercitado contra linhas reais (exemplo agrupado enviado ao webhook de dev):
2 linhas · **1 pedido** (`cakto:12345`) · R$ 90 + R$ 27 · `principal`/`orderbump`
· taxas R$ 4,50 e R$ 1,35 · `fbc`/`fbp` gravados · log dizendo "2 itens no mesmo
pedido". Dados de teste removidos depois.

> ⚠️ **Vazios ESPERADOS numa venda da Cakto:** `country` e `countrySource` ficam
> nulos quando não há clique casado — ela **não manda o IP do comprador**, e essa
> é a capacidade declarada. `coproducao` fica nulo porque só conhecemos o tipo
> `producer`. Nenhum dos dois é bug.
>
> 🔴 **Vazio que É bug:** `taxaGateway` nulo (o registro diz que ela manda
> `fees`), ou `fbc`/`fbp` nulos num payload que os trouxe.
