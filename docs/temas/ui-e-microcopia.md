# UI, microcópia e design

> Leia ao escrever texto de tela, mexer em overlay/gaveta, gráfico, ícone ou
> layout do Dashboard.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## ✍️ Microcópia: benefício em vez de mecanismo (grupos 1 e 2)

**~30 textos reescritos.** A interface explicava COMO foi construída em vez de
O QUE faz.

> ### ⛔ Simplifique jargão de PROGRAMAÇÃO, nunca de TRÁFEGO
> **ROAS, ROI, CPA, CTR, CPM, criativo, CBO, ABO, conjunto, pixel, UTM, gateway,
> campanha** são o vocabulário NATIVO do usuário (gestor de tráfego /
> infoprodutor) — ele entende "ROAS" melhor que "retorno sobre investimento em
> anúncios". Trocar isso por linguagem "acessível" **piora** o produto.
>
> O que sai é o que só o programador conhece: **banco de dados, filtro (como
> definição), query, token, coluna, nullable, FK, catch-all, derivada**.

### `plural()` e `palavra()` em `lib/format.ts`

`43 evento(s) recebido(s)` → `43 vendas recebidas`. O parêntese é gambiarra de
código vazando na tela. O helper aceita a forma plural **completa**, porque
português não pluraliza só com "s" (`mês` → `meses`), e um terceiro argumento
opcional para o zero (`"nenhuma venda ainda"`).

Aplicado em 12 arquivos — Webhooks, Pixel, Anúncios, Testes, Áreas, Regras,
Gerenciador, AdsActionBar, AdsTable, ListaSelecionavel, CountryMap, Dashboard.

### Trocas de vocabulário

| Antes | Depois |
|---|---|
| "Um conjunto de filtros, salvo com um nome… não separa os dados **no banco**" | "Separe suas operações sem misturar os números" |
| "Área padrão: mostra tudo. Ao criar outras áreas, o que elas levarem sai daqui" | "Sua operação principal. O que você mover para outras áreas deixa de aparecer aqui." |
| "Só para você lembrar. **Não filtra nada.**" | "Uma nota para você. Não muda nada nos números." |
| "**Nada selecionado — este campo não filtra.**" | "Nada escolhido — vale para todos." |
| "Todo campo em branco significa '**não filtra por isto**'" | "Campo em branco vale para todos." |
| "**token protegido**" / "**token salvo**" | "conectado" |
| "**sem token**" | "falta conectar" |
| "Nenhum pixel com **token da CAPI**" | "Nenhum pixel conectado — os eventos não chegam ao Facebook." |
| "**Vínculo no banco**" (aba Testes) | "Onde este link foi reconhecido" |
| "Nada aqui. Sincronize as métricas ou ajuste os filtros." | "Nenhuma campanha neste período. Tente outro intervalo ou outro status." |
| Legenda: "Meta Ads · **Nosso rastreamento** · **Derivada**" | "Vem do Facebook · Medido pela Traffik · Calculado" |

> ⚠️ **"Filtro" sobreviveu onde é AÇÃO DE TELA** ("ajuste os filtros") e saiu onde
> era DEFINIÇÃO ("um conjunto de filtros"). Filtrar relatório é vocabulário de
> tráfego; explicar um produto como "conjunto de filtros" é falar de implementação.

> ⚠️ **"Token" ficou onde é o nome do que o usuário cola**: "Cole aqui o token
> gerado no painel da Kirvano" é instrução correta — é assim que a Kirvano chama.
> Saiu só onde era ESTADO interno ("token salvo", "· token").

### Grupos 3 e 4 — explicação virou tooltip

> ⚠️ **Meu levantamento estava errado: o grupo 4 já estava feito.**
> `lib/explicacoes.ts` já tinha as 12 métricas (`ROAS · ROI · CPA · CPM · CPC ·
> CTR · CPI · ARPU · Ticket · Margem · Lucro · Cliq. atr.`), as 5 etapas do funil
> e vários campos de configuração. **Confira `explicacoes.ts` antes de "adicionar
> tooltips"** — o catálogo é mais completo do que parece de fora.

A lacuna real eram os campos criados nas sessões recentes, onde eu mesmo pus
explicação em **texto corrido**. Seis entradas novas em `explicacoes.ts`:
`regraTeto`, `regraJanela`, `regraContas`, `despesaArea`, `contaUnicaPorArea`,
`utmPorArea`.

> ⚠️ **A explicação de métrica é da CONTA, não do termo.** O usuário sabe o que é
> ROAS; o que ele não sabe é **qual gasto a Traffik usou**. Por isso as entradas
> têm `formula` e `fonte` (Vem do Facebook / Medido pela Traffik / Calculado).

**O `Campo` de `RuleDrawer` e de `AreasView` ganhou `info`**, e o `dica` ficou
para a linha curta que muda com a escolha (ex.: a unidade selecionada).
Parágrafo de ajuda embaixo de cada campo empilha ruído numa gaveta de 10 campos.

Saiu daí o pior exemplo do projeto: `"Só nesta Área de Trabalho (desmarcado:
vale para todas as áreas)"` — um rótulo carregando o comportamento do próprio
checkbox entre parênteses. Virou rótulo limpo + ⓘ.

### ⚠️ Falta da padronização visual (Frente 2)

- **~22 `<select>` nativos em 8 arquivos** — o `ui/Select` (Bloco 3) já existe;
  é adoção, não construção. As telas novas (RuleDrawer, RulesView) já nasceram
  sem nenhum.
- **7 checkboxes nativos em 4 arquivos** — `ui/Checkbox` já existe (Bloco 8) e
  já foi adotado em Taxas e no diálogo de exclusão.
- **Ícones em dois sistemas**: `0 0 24 24` (14×) e `0 0 256 256` (11×).
  Unificar em 24×24.
- Preservar as exceções: selects de mês/ano do `DateRangePicker` (nativos de
  propósito) e a página `test-checkout`.

## 🎨 REDESIGN DO DESIGN SYSTEM — intenção futura, documento fora do repo

Registrado em 05/08/2026 a pedido do usuário. **Não começar sem o documento.**

Não é repaginação: é **refazer o design system do zero**, com outra
organização e outra navegação. Referências: Apple, Raycast, Linear, Framer,
Stripe e Arc.

> ⚠️ **Não confunda com a "padronização visual", que está CONCLUÍDA** (selects
> nativos, checkboxes e ícones 256×256 todos zerados). Isto é maior e substitui
> a organização atual, não a limpa.

O documento vive fora do repositório e o usuário traz quando for a hora.

## 🧱 Aproveitamento do espaço nas 4 telas (30/07/2026)

Quatro telas tinham um card pequeno no canto e o resto vazio. As quatro usavam
`grid auto-fit minmax(360px,1fr)`, que dá metade da tela a cada bloco
independentemente de quanto conteúdo cada um tem.

> ### ⚠️ O erro de projeto era supor MUITOS itens. O caso comum é UM.
> Cheguei a dar **1,5fr** aos gateways de Webhooks por serem "o caminho
> principal". Ficou pior: com **um** gateway — que é o normal, quem usa a
> ferramenta tem um checkout — o card de 290px ficava sozinho num track de
> 1350px. Era o mesmo "card no canto", só menor.
>
> **Dimensione a coluna pelo caso de 1–2 itens, não pelo de 10.** Colunas iguais
> de ~680px cabem exatamente 2 trilhas de card: 1 webhook + o tile de adicionar
> preenchem a fileira, e com 4 viram duas fileiras cheias.

| Tela | Antes | Agora |
|---|---|---|
| **Webhooks** | 2 colunas `auto-fit`, linhas de largura total, conteúdo em 200px de altura | 2 colunas iguais; gateways em **grade de cards**; estado vazio da chave explica **quando** ela serve |
| **Pixel** | `max-width:920px`, cada pixel numa linha de 35px | full width, **um card** com intro + grade de cards; chip âmbar de "não envia nada" |
| **UTMs** | card esquerdo = um título e um botão (tudo dentro do modal) | as **3 plataformas na tela**, com Copiar na linha; o código segue no modal |
| **Taxas** | coluna de 1050px, `Nome da despesa` com 1050px de largura | **3 cards de custo lado a lado** + sidebar; formulário que **embrulha** |

### O tile "+" dentro da grade é layout, não só ação

`+ Adicionar` como **tile tracejado no fim da grade** (padrão que Integrações ›
Anúncios já usava) é o que garante que a fileira nunca fique com um card solto.

> ⚠️ **Onde há tile, NÃO há botão no cabeçalho.** Os dois seriam a mesma ação em
> dois lugares — o erro do "Editar" duplicado no card de webhook. A regra que
> ficou: **galeria usa tile; lista usa botão no cabeçalho** (por isso Credenciais
> de API, que é lista numa coluna estreita, manteve o botão).

### Detalhes que não são óbvios

- **`minmax(0,1fr)` em vez de `1fr`** em todo grid de 2 colunas: com `fr` puro o
  mínimo do track é o conteúdo, e uma linha longa do `<pre>` do payload ou um nome
  de despesa comprido **estoura o track e cria rolagem horizontal na página**.
- **`item` da grade é `div` com borda, não `.card`** quando está dentro de um
  `.card`: o fundo seria o mesmo do pai e o cartão desapareceria.
- **`FormAdicionar` embrulha com `flex:1 1 140px` + `min-width:0`**, sem media
  query. Sem o `min-width:0` o conteúdo define o mínimo do item flex, o `wrap`
  nunca acontece e a linha estoura o card.
- **O modal de "Parâmetros de URL" foi MANTIDO** — a regra do Bloco 11 (dado
  verboso não aparece na listagem) continua valendo. O que entrou no card foi a
  **escolha** da plataforma, com "Copiar" na própria linha.

> ### ⛔ Espaço vazio NÃO se preenche com bloco de código
> Cheguei a abrir o "Como usar" das Credenciais de API por padrão (`<details open>`)
> quando não havia chave, com o argumento de que era o momento em que a pessoa
> precisava do payload — e de que enchia a coluna. **Reprovado pelo usuário em
> 30/07/2026, nas duas frentes:** um bloco de código escancarado e, pior, uma
> explicação que só um dev entenderia (*"envie um **POST** para o **endpoint** com
> a chave no **cabeçalho** `Authorization`; os nomes dos campos são
> **tolerantes**"*).
>
> **Quem lê esta tela é gestor de tráfego. Quem consome aquele bloco é a pessoa
> que fez o checkout dele.** Então:
> - o `<details>` volta a nascer **fechado**, e chama-se **"O que entregar para
>   quem cuida do seu site"** — o título já diz a quem interessa;
> - o texto de dentro começa com *"você não precisa entender o que aparece aqui"*
>   e manda gerar a chave e repassar dois blocos;
> - a URL e o exemplo ganharam rótulos em português (*"Endereço para enviar as
>   vendas"*, *"Exemplo de como enviar"*) em vez de nada;
> - **o vazio da coluna é preenchido pelo estado vazio da chave**, que explica em
>   linguagem normal *quando* uma chave é necessária (checkout sob medida, ou
>   plataforma fora da lista). Isso é conteúdo útil; o code dump não era.
>
> Vale a regra de microcópia que já existia, aplicada ao caso: **POST, endpoint,
> cabeçalho, payload e "campos tolerantes" são jargão de PROGRAMAÇÃO e saem.**
> `gateway` e `checkout` são vocabulário do usuário e ficam.

## 🎨 Convergência de ícones CONCLUÍDA (30/07/2026)

Os 11 SVGs em `viewBox="0 0 256 256"` (`strokeWidth` de 16 a 20) foram migrados
para `ui/Icone`, que é 24×24 com traço 1,75. **`Icon.tsx` (`NavIcon`) foi
deletado.** 27 nomes novos no `MAPA`, ~35 pontos de uso.

> ### ⛔ Banco de `path` em string é COMO a divergência volta
> Dois lugares guardavam `icon: "M40 40 h72…"` num array de configuração — o `NAV`
> da `Sidebar` (7 ícones) e as `ABAS` do `AdsManagerView` (4). Parecia dado,
> era desenho, e escapava de qualquer padronização de tamanho e traço.
>
> **Campo de ícone dirigido por dados guarda um `NomeIcone`, nunca um `path`.**

- **`Icone` ganhou `style?: CSSProperties`**, mesclado depois da base. É só para
  `transform`/`animation`/`opacity` — a seta do delta que gira 180° na queda, o
  caret do menu, o "Atualizar" que roda, a opacidade do estado vazio. **Não é
  porta para cor:** cor passa por `cor`, senão volta a haver hex solto na view.
- **`IconeEvento` do feed deixou de receber cor.** A pílula em volta já pinta
  `color:<cor do evento>` e o ícone herda por `currentColor`.
- **`pix` é `QrCode`**: no Brasil o Pix *é* o QR code. O losango genérico anterior
  não dizia nada.
- **Não passam por aqui, de propósito:** os `<svg>` de `Funnel`, `Donut`,
  `CountryMap`, `AreaChart` e o `Sparkline` do `chartKit` são telas de gráfico
  desenhadas por coordenada. `Select`, `Checkbox`, `InfoTip` e `WorkspaceSelect`
  têm um SVG cada, já em 24×24, que é o desenho interno do primitivo.

### Achados de quebra

- **`EditDashboardDrawer` é código MORTO e inalcançável.** Está montado em
  `DashboardShell`, mas **ninguém chama `openEditDash`** — quem edita o dashboard
  é o painel inline "Métricas disponíveis" do Bloco 2. Entra na faxina.
- **`AdsManagerView` mostrava `{contagem} item(ns)`**, que o `plural()` existe
  para eliminar. Corrigido para "2 itens" / "nada aqui".
- **A logo da Cartpanda ficou mais exposta.** Antes só aparecia nas abas do modal;
  agora está numa das 3 linhas de destino da aba UTMs. Segue sendo o caso ruim
  documentado (panda preto em fundo transparente, quase invisível no tema
  escuro) — resolver exige arte em versão clara.

## 📊 Gráficos: texto em escala 1:1 e rótulos que raleiam (30/07/2026)

**Sintoma relatado:** no bloco pequeno os rótulos do "Faturamento vs. gasto"
ficavam **achatados**; no bloco grande, **esticados e enormes**. E "Vendas por
dia" com 30 dias empilhava datas encostadas umas nas outras.

**Causa: `viewBox` fixo + `preserveAspectRatio="none"`.** O `AreaChart` usava
`viewBox="0 0 640 260"`, então a escala horizontal era `largura/640` e a vertical
`altura/260` — valores diferentes, que deformam o **texto** junto com a
geometria. O bloco é redimensionável, então a mesma tela tinha duas tipografias
erradas dependendo do arraste do usuário. (O `<pre>` do tooltip já havia sido
tirado do SVG por esse motivo; os eixos ficaram para trás.)

**`ui/useTamanho.ts`** mede o elemento com `ResizeObserver`. Com a largura em
estado, o `viewBox` passa a ser o tamanho real (**1 unidade = 1 pixel**, escala
1,000 medida em runtime) e o gráfico decide **quantos** rótulos cabem.

| | Antes | Agora |
|---|---|---|
| Escala do texto | variava com o bloco | sempre 1:1 |
| Rótulos do eixo X (área) | `ceil(n / 8)`, fixo | pela largura medida; primeiro e **último** garantidos |
| Rótulos das barras | **todos**, sempre | a cada `ceil(n / (largura/42))`, mais o último |

Medido: 30 barras em 615px → 11 rótulos; o mesmo bloco mais largo → 16. Os 30
dias do eixo do `AreaChart` couberam inteiros em 2.254px, sem deformar.

> ### ⛔ `useTamanho` usa CALLBACK REF e guarda o nó em ESTADO
> A primeira versão era `useRef` + `useEffect(…, [])`, e estava **silenciosamente
> quebrada**: o efeito roda uma vez, e nesse instante o elemento **não existe** —
> todo gráfico faz `return <ChartEmpty/>` antes do markup quando não há dado, e o
> Dashboard abre justamente sem dado. `ref.current` era `null`, o observer nunca
> era anexado, e com deps `[]` **não havia segunda tentativa**: a largura ficava 0
> para sempre e o raleamento nunca acontecia.
>
> Com o nó em estado, **montar o elemento é uma mudança de dependência**.
>
> ⚠️ Quem precisa do DOM (um `getBoundingClientRect()` em evento) usa o **`no`**
> devolvido pelo hook, não `algumRef.current`.
>
> ⚠️ **DESTRUTURE o retorno.** Guardar o objeto (`const caixa = useTamanho()`)
> faz o `react-hooks/refs` tratar todo `caixa.*` como leitura de ref no render e
> acusar erro até em `caixa.largura`, que é estado comum.

> ⚠️ **`Sparkline`, `Donut`, `Funnel` e `CountryMap` seguem com `viewBox` fixo, e
> está certo:** o `Sparkline` não tem texto nenhum, e nos outros o texto é HTML
> por fora do SVG. Esticar só é problema quando há `<text>` dentro.

## 🧭 Layout PADRÃO do Dashboard — transcrito do arranjo do usuário (30/07/2026)

**23 blocos**, e é o que toda **área nova** e **conta nova** vê. Vive em
`KPIS_PADRAO` + `GRAFICOS_PADRAO`, em `blocks.ts`.

> ### ⛔ É uma TABELA EXPLÍCITA de coordenadas. Não volte para o algoritmo.
> A primeira versão empacotava os blocos em fileiras que somavam 12. Estava
> correta e ficou **genérica**: pares lado a lado, tudo do mesmo tamanho. O
> usuário montou o arranjo dele arrastando na tela e pediu para virar o padrão —
> então o padrão é a transcrição, coordenada por coordenada. **Fluxo automático
> não reproduz uma composição feita a olho.**

```
 ┌ 12 KPIs, 6 por fileira (w=2) ──────────────────────────────────────┐
 │ Fat. │ Gasto │ ROAS │ Ticket │ CTR  │ Reemb.                       │
 │ Pend.│ Vendas│ ROI  │ CPA    │ ARPU │ Margem                       │
 ├──────────── ESQUERDA (w=7) ──────────┬──── DIREITA (w=5) ──────────┤
 │ Funil de conversão              h=7  │ Vendas por país         h=7 │
 │ Atividade recente               h=6  │ Taxa de aprovação       h=4 │
 │ Fat. vs gasto (4) │ Produto (3) h=5  │ Vendas por dia          h=4 │
 │ Fonte (3) │ Pagamento (4)       h=5  │ Lucro por horário       h=4 │
 │                                      │ Vendas por horário      h=4 │
 └──────────────────────────────────────┴─────────────────────────────┘
```

**Duas colunas de larguras DIFERENTES (7 e 5)**, e é isso que dá o aproveitamento
de espaço: o funil e o feed pedem largura, os cinco blocos da direita são
compactos e empilham.

> ⚠️ **As colunas terminam na MESMA linha, e isso é o que elimina o buraco.**
> Esquerda `7+6+5+5 = 23`; direita `7+4+4+4+4 = 23`. Ao mexer numa altura,
> reequilibre a outra coluna — o `react-grid-layout` compacta na vertical, então
> um desequilíbrio não dá erro: aparece como vazio no pé de uma coluna.
>
> ⚠️ **Verificado com um mapa de ocupação**: 0 colisões, 0 células vazias nas 23
> linhas, e os KPIs terminando exatamente na borda direita do grid.
>
> ⚠️ **`kpi:chargeback` fica FORA** de propósito — são 12 KPIs, não 13. Continua
> em "Métricas disponíveis".
>
> ⚠️ **No mobile (4 colunas) tudo vira largura total**, empilhado na ordem visual
> do desktop (`y`, depois `x`) — duas colunas de gráfico em 4 unidades deixariam
> as duas ilegíveis.
>
> ⚠️ **Layout já salvo NÃO é mexido.** Quem tem `DashboardLayout` no banco
> continua com o arranjo dele; reorganizar o dashboard de alguém sem pedir seria
> pior que o problema. Para adotar o padrão: "Redefinir configurações".

### 🔴 Bug real achado no caminho: "Redefinir" apagava o layout da área ERRADA

`useDashboardLayout` tinha `redefinir` com deps **`[]`** e `salvar` com
`[layouts]`, os dois usando `workspaceId` por dentro. `useCallback` congela o
valor do render em que foi criado, então o callback carregava a área ativa **na
montagem do Dashboard**: trocar de área e clicar apagava/gravava o layout de
outra área. No `redefinir` era certeza (nunca recriado); no `salvar` era uma
corrida que `[layouts]` mascarava.

Agrava porque `redefinir` é destrutivo, imediato e **"Cancelar" não desfaz**.

> ⚠️ **Aviso de `exhaustive-deps` sobre `workspaceId` neste projeto é sinal de
> bug, não ruído.** Todo o isolamento por área depende desse id chegar certo.

## ✅ Lint zerado — e o que NÃO se conserta obedecendo (30/07/2026)

De **36 problemas (21 erros) para 0**. A distribuição importa mais que o número:

| Regra | Qtd | Desfecho |
|---|---|---|
| `no-unused-vars` | 13 | removidos de verdade (ver abaixo) |
| `react-hooks/refs` | 10 | **consertados**: viraram largura medida |
| `set-state-in-effect` | 10 | suprimidos **um a um, com o motivo na linha** |
| `exhaustive-deps` | 2 | 1 bug real (acima) + 1 dep de nó |
| `immutability` | 1 | `Donut` pré-calcula os ângulos |

**O que era código morto de verdade** (não só "variável sem uso"): o componente
`Barras` inteiro no `BlockContent` (substituído pelo `Donut`), `NOME_FONTE` no
`AdsTable` (a legenda virou "Vem do Facebook / Medido pela Traffik / Calculado"),
as props `onSincronizar`/`sincronizando` do `AdsActionBar` — restos do botão
"Sincronizar métricas", que o `AdsManagerView` ainda passava — e o `semVenda` da
`AreasView`, do chip de produto sem venda que saiu na Sessão 3.

> ### ⛔ `set-state-in-effect` NÃO se conserta obedecendo
> Dois dos 10 são a **regra #4 das "cinco que custaram caro"**: o
> `useTraffikState` sincroniza as props do servidor por efeito porque o
> inicializador do `useState` só roda na montagem — sem isso, trocar de área
> mostra os dados da área ANTERIOR. Outro é o `useOverlay`, cuja correção de foco
> a regra #3 protege. Os demais são carga de dado e sincronia com sistema externo
> (`localStorage`, `prefers-color-scheme`), que a própria doc do React permite.
>
> **Obedecer à regra aqui reintroduz bugs já pagos.** Cada `eslint-disable` leva
> o motivo na própria linha.

> ### ⚠️ Ao inserir um `eslint-disable` acima de uma linha, CONFIRA que você não
> ### substituiu a linha
> Fazendo isso em lote eu **apaguei três linhas de comportamento** —
> `setBusca("")` (o campo de busca do `Select` parava de limpar ao reabrir),
> `setDados(null)` (`BannerPendencias` perdia o estado de carregando) e
> `setCarregando(true)` (a `RulesView` parava de mostrar que estava carregando).
> Nenhuma quebrava tipo ou build; o que denunciou foi o lint reclamando de
> **"Unused eslint-disable directive"** — o comentário tinha ocupado o lugar do
> `setState` que ele deveria justificar. Restauradas.

> ⚠️ **`public/*.js` saiu do lint** (`eslint.config.mjs`). São os runtimes
> instaláveis, ES5 por exigência de compatibilidade e **gerados** — lintar com as
> regras do app só produzia ruído em código que não é da aplicação.

### 🐛 De quebra: o cursor "grabbing" do globo nunca aparecia

`CountryMap` lia `arrasto.current` no `style` durante o render. Mudar um ref não
redispara render, então o cursor **nunca** trocava ao arrastar. Virou estado.

## ✅ RESOLVIDO: rodapé do funil invisível — e a causa é GENÉRICA

**Medido e corrigido em 30/07/2026.** O resumo do gargalo existia há semanas e
**nunca tinha sido visto por ninguém**. Junto com ele estavam invisíveis a
pílula de perda entre etapas (`−5 · 100,0%`) e os valores absolutos sob cada
etapa.

### A causa: item de flex nasce com `min-height:auto`

Um item de flex **não encolhe abaixo do próprio conteúdo** a menos que se diga
`min-height:0`. O div que envolve rótulos+gráfico no `Funnel` tinha `flex:1` e
nada mais, então media **422px dentro de um espaço de 338px** e empurrava o
resumo 122px para fora do card — que tem `overflow:hidden` de propósito.

```
card (376px, overflow:hidden)
└─ raiz do Funnel (338px)
   ├─ div rótulos+gráfico   flex:1  min-height:auto  →  422px  ⛔ não cede
   └─ resumo do gargalo     36px    →  empurrado para fora
```

**A correção é uma linha:** `min-height:0` nesse div. Mais `min-height:200px`
(era 230) na raiz, porque no menor tamanho que o grid permite (`minH: 5` = card
de 264px) sobram 226px e 230 estourava por 4px.

> ### ⛔ NÃO era problema de altura do bloco
> A saída óbvia — aumentar o `minH` do funil — teria sido **errada duas vezes**:
> empurraria layouts já salvos, e o bloco tinha espaço de sobra (376px para
> ~370px de conteúdo). O conteúdo é que se recusava a caber.
>
> **Meça antes de redimensionar.** Foi a medição no navegador que mostrou os
> 422px; a aritmética sozinha dizia que cabia.

### Auditoria: os outros 22 blocos estão limpos

Verificado empiricamente — cada card medido por `scrollHeight > clientHeight`
e por descendente com base além da base do card:

| Tamanho | Blocos com conteúdo cortado |
|---|---|
| Tamanho real do layout padrão | **0 de 23** |
| Menor tamanho que o grid permite (264px) | **0 de 23** |
| 208px (abaixo do mínimo, inalcançável pelo usuário) | 2 — Funil e Vendas por país |

> ⚠️ **O limite desta auditoria:** bloco em estado vazio renderiza pouco e não
> tem como transbordar. O defeito do funil só apareceu **com dado que produzisse
> gargalo**. Então "0 de 23" significa *"nenhum bloco transborda com os dados
> que existiam no banco de dev"*, não *"nenhum bloco jamais transborda"*.
>
> **Elemento condicional é onde este defeito mora**: resumo, aviso, estado de
> erro, rodapé — coisas que só aparecem em certas combinações de dados. `tsc`,
> `lint` e `build` passam com eles invisíveis, e o `find` do navegador os
> encontra no DOM. **Só ver na tela prova.**

### ⚠️ Limitação conhecida desta auditoria — está na FILA

O "0 de 23" prova que **não há transbordo naquele estado de dados**, não que não
haja em nenhum. O defeito do funil só apareceu **com dado suficiente para gerar
gargalo**, e o banco de dev tem 8 vendas.

**Sessão de varredura de verdade (na fila, junto do Prompt J):** semear dados que
ativem **cada caminho condicional** — estados de erro, avisos, rodapés, badges,
chips — e conferir **cada um na tela**. É a única forma de fechar esta classe.

Onde procurar: qualquer coisa que só renderize sob condição. `tsc`, `lint` e
`build` passam com o elemento invisível, e o `find` do navegador o encontra no
DOM. **Só ver na tela prova.**

### O que fica para o Prompt J

O bloco de 208px mostra que Funil e Vendas por país estourariam **se** o mínimo
do grid baixasse. Se o Prompt J permitir blocos menores, estes dois são os
primeiros a revisar — e a regra a aplicar é a mesma: **todo item de flex que
precise ceder espaço leva `min-height:0`**.

## 🎨 Marca e logos

Arquivos em `public/logos/` (webp, vindos do designer):

| Arquivo | Onde |
|---|---|
| `traffik-claro.webp` | Wordmark de letras **brancas** — sidebar (o tema é escuro) |
| `traffik-escuro.webp` | Wordmark de letras pretas — reservado para fundo claro, **ainda sem uso** |
| `kirvano/hotmart/cartpanda/kiwify/facebook.webp` | Gateways e plataformas |
| `favicon.webp` | Origem do favicon |

- **`ui/LogoGateway.tsx`** é o único ponto que resolve logo de gateway. Recebe o id
  (`KIRVANO`, `HOTMART`, …) e **cai no monograma quando não há arquivo** — hoje nenhum
  gateway está nessa situação, mas o fallback fica para o próximo que entrar na lista
  antes de a arte chegar.
- **Sem fundo atrás das logos**, por pedido do usuário: só `border-radius` +
  `overflow:hidden`, que arredonda o fundo **já embutido** em artes como a da Kirvano
  em vez de deixar quina viva. Luminância média dos pixels opacos (medida com o sharp):
  Kirvano 63, Cartpanda 87, Hotmart 112, Facebook 134, Kiwify 148 — sobre `/255`.
  A Kirvano tem 94% de área opaca (traz o próprio fundo escuro), então continua legível.
  ⚠️ **A Cartpanda é o caso ruim**: panda preto com detalhes brancos em fundo
  transparente, então no tema escuro sobram quase só os olhos. Só aparece nas abas do
  modal de UTMs. Resolver exige um arquivo em versão clara ou um fundo sutil só nela.
- **Favicon**: `src/app/icon.png` (512) e `apple-icon.png` (180), gerados do `.webp` por
  `scripts/gen-favicon.mjs` com o `sharp` (que já vinha com o Next). A convenção de
  arquivo do Next **não aceita webp**, e nem todo navegador desenha favicon nesse
  formato — por isso a conversão. O `src/app/favicon.ico` antigo foi removido, senão
  teria precedência.
- **Tamanhos**: o wordmark é preso pela **largura** (`max-width:184px`, altura livre),
  não pela altura — assim ocupa a coluna da sidebar como na referência da Utmify, e a
  proporção 904×230 nunca estica. Renderiza 184×47. O mesmo wordmark, a 168px, substituiu
  o monograma "T" no **login/cadastro** (`(auth)/AuthShell.tsx`). Gateways a 34px no card
  e 38px na grade da gaveta; 22px nas abas do modal de UTMs.
- O subtítulo "Analytics de tráfego" saiu da sidebar — a marca agora fala sozinha.

## 🗄️ Padrão de revelação: gavetas laterais

**Regra da ferramenta:** dado sensível ou verboso (URL de webhook, token, script, id)
**nunca aparece na listagem**. A listagem mostra nome, status e uma métrica de uso; o
detalhe vive numa gaveta que desliza da direita, com botão de copiar.

`ui/Drawer.tsx` — `Drawer` + `CampoCopiavel`. Fecha no Esc, trava o scroll do fundo,
devolve o foco a quem abriu e prende o Tab dentro dela.

> ⚠️ **A gaveta é renderizada via `createPortal` no `<body>`, e isso é obrigatório.**
> Ela é `position:fixed`, e qualquer ancestral com `transform` vira o bloco de contenção
> — a animação `.page-enter` do shell fazia exatamente isso, e a gaveta abria com a
> **altura colapsada** (só o cabeçalho e o rodapé). Se um dia aparecer um painel fixo
> "achatado", é esse o motivo.

Aplicado em:
- **Webhooks**: "Adicionar Webhook" abre gaveta com **grade de gateways + busca**
  (preparada para muitos; só Kirvano ativa). A listagem mostra logo, nome, status e
  nº de eventos — **sem a URL**. "Editar" abre a gaveta e só ali a URL é revelada.
- **Pixel**: card compacto (nome, status, nº de pixels Meta, nº de eventos ativos).
  "Editar / ver" abre a gaveta com toda a configuração **e o script gerado**, que
  deixou de ter modal próprio. Ao salvar um pixel novo a gaveta continua aberta nele,
  porque é onde o script aparece.
- **Anúncios**: clicar no perfil abre gaveta com as contas e seus toggles, em vez de
  expandir inline empurrando a vitrine. O tile "+" segue sempre visível.
- **UTMs**: já estava no padrão desde o Bloco 11 ("Ver opções" → modal com Hotmart /
  Cartpanda / Outros e botão copiar). Nada a mudar.

### Bug do zoom do globo (corrigido)

O `scale` da projeção crescia com o zoom mas o `translate` ficava preso no centro do
`viewBox`: a esfera transbordava e aparecia cortada/deslocada. Agora há
`clampZoom` (1–4) e **`clampPan`**, que limita o deslocamento do centro a
`raio − SIZE/2`. O efeito: em zoom 1 o globo aparece inteiro e centrado; com zoom, o
quadro fica sempre **dentro** da esfera, então nunca se vê o fundo. O wheel faz
zoom-to-cursor e o Reset volta a zoom 1, pan zero e rotação inicial.
Verificado: esfera 288px dentro da moldura de 300 em zoom 1 → 1097px cobrindo
integralmente a moldura após 6 passos de zoom.

---

### 3ª rodada de polimento + bug dos gráficos de barra

**BUG CRÍTICO corrigido:** "Vendas por Horário", "Lucro por Horário" e "Vendas por Dia"
renderizavam só a alça roxa e o corpo vazio. **Não era altura zerada** — os três ids
estavam registrados em `blocks.ts` mas **sem `case` correspondente no `BlockContent`**:
uma edição minha anterior, ao remover casos duplicados, apagou os novos junto. O
`switch` caía no `default: return null`. Lição: `blocks.ts` e o `switch` do
`BlockContent` são duas listas que precisam andar juntas — **um bloco registrado sem
case vira um card vazio silencioso**, sem erro de tipo nem de runtime.

Demais melhorias desta rodada:
- **Barras**: 24 posições sempre presentes (horário) e **todos os dias da janela**
  (`byDay` agora preenche as lacunas no backend, antes só trazia dias COM venda).
  Barras-fantasma nas posições sem valor, grade, eixo Y, subida escalonada e tooltip
  com faixa de hora (`14h00 – 15h00`) ou data por extenso.
- **Donuts**: micro-interação no centro (troca o total pelo valor+% da fatia sob o
  mouse), mini-barra de proporção na legenda, glow quando há **uma fatia só**.
- **Funil**: percentual sobre "pílula" semi-transparente com blur (o número branco
  sumia nos trechos claros do gradiente), fio mínimo de 4,5% para o estrangulamento
  não desaparecer, e tooltip com **as duas taxas** (vs. etapa anterior e vs. topo).
- **Taxa de aprovação**: ícone por método, cor reagindo ao valor (verde ≥80%,
  amarelo ≥50%, vermelho abaixo), glow na ponta, animação escalonada e **os 3 métodos
  sempre visíveis** — um método sem dado mostra "N/A" em vez de sumir da lista, que era
  justamente o que escondia o método que parou de vender.
- **Atividade recente**: virou **feed unificado**. Antes todo evento saía como "Venda"
  porque o tipo era fixo por origem de tabela. Agora são 6 tipos com badge, ícone e cor
  próprios — clique (azul), checkout (roxo), venda pendente (âmbar), venda aprovada
  (verde), reembolso e chargeback (vermelho) — com **filtro por tipo** no topo e entrada
  escalonada. Os `PixelEvent` passaram a ser lidos como linhas (antes só `count()`).

**Ainda pendente:**
- O filtro do feed é **local** (filtra o que já veio); não recarrega do servidor.
- O feed traz no máximo 40 eventos por janela, sem paginação.
- Sparklines seguem cobrindo 7 métricas; ROI, margem e CTR continuam sem série.

---

### Polimento premium dos gráficos (2ª revisão de design)

Reformulação completa do acabamento, pedida com referências (Apple/Linear/Vercel):

- **`ui/chartKit.tsx` — peças compartilhadas.** `ChartTooltip` (fundo translúcido com
  `backdrop-filter`, borda sutil, sombra), `ChartEmpty` (ícone + frase útil),
  `Sparkline`, `Delta` (seta + verde/vermelho, com flag `invertido` para métricas de
  custo onde subir é ruim) e a paleta análoga. Antes cada gráfico inventava o seu.
- **Globo** (`CountryMap`): `d3.geoOrthographic` — esfera girável de verdade, com
  gradiente radial de iluminação, oceano azul-marinho, continentes com borda luminosa,
  marcadores pulsantes proporcionais, **rotação automática que pausa ao interagir**,
  arraste/scroll/reset e tooltip com bandeira. Estado vazio = globo girando com legenda
  discreta sobreposta.
  **WebGL/three.js foi descartado de propósito:** seria um canvas com contexto próprio
  dentro de um bloco redimensionável, com risco em máquina sem aceleração. O d3 desenha
  SVG comum, participa do layout e não tem contexto para perder.
- **Funil**: gradiente contínuo azul→roxo→magenta, animação de preenchimento da esquerda
  para a direita (`clipPath` animado), taxa no centro, valor absoluto embaixo, tooltip
  por etapa.
- **Donuts**: espessura generosa, gap entre fatias, fatia ativa cresce e as outras
  esmaecem, total no centro, legenda em **colunas alinhadas** (cor · nome · R$ · %).
- **Barras**: barras-fantasma nas posições sem valor (dá contexto de série temporal em
  vez de uma barra solitária no vazio), grade, eixo Y, animação de subida escalonada e
  **tooltip detalhado** — "14h00 – 15h00" com vendas e faturamento; no diário, a data
  por extenso.
- **Cards de KPI**: hierarquia (label → número grande → comparação), **sparkline** da
  métrica no período e delta colorido com seta. As séries vêm de `chart.sparklines`,
  derivadas dos mesmos buckets do gráfico grande.

**Dois erros meus corrigidos no caminho:**
1. Tentei forçar o funil a estreitar sempre (clamp monotônico no mínimo acumulado). Isso
   **colapsava o funil inteiro numa linha** quando o 1º estágio era 0 — que é o caso
   comum, com o Facebook não sincronizado. Voltou a ser proporção direta: com dados
   encadeados a forma afunila sozinha, e quando um estágio posterior é maior isso é
   informação real (ICs vêm do pixel, vendas vêm do gateway — fontes independentes).
2. O gradiente do funil saía **listrado**: `linearGradient` usa `objectBoundingBox` por
   padrão, então cada segmento aplicava a escala inteira à própria caixa. Corrigido com
   `gradientUnits="userSpaceOnUse"`.

> **Dados do globo**: `scripts/gen-world-paths.mjs` agora gera `src/lib/worldGeo.ts` com
> **coordenadas lng/lat** (não paths SVG), porque a projeção ortográfica reprojeta a
> cada frame. Continua pré-computado e commitado — sem TopoJSON no navegador e sem
> `world-atlas`/`topojson-client` no package.json. A única dependência nova é `d3-geo`.

**Ainda pendente do polimento:**
- O globo cobre os **~32 países** da tabela `lib/countries.ts`; fora dela, o país aparece
  só no Ranking.
- Os continentes são **contorno de terra**, sem fronteiras por país — os países são
  identificados pelos marcadores.
- Sparklines existem para faturamento, gasto, vendas, ROAS, ticket, ARPU e CPA. **ROI,
  margem, CTR e as métricas de contagem não têm série** e ficam sem mini-gráfico.
- `deltas` do backend não cobrem todas as métricas; as sem delta mostram o texto neutro.

---

### Revisão de design do Bloco 5 (feedback do usuário)

Os gráficos foram reprovados na primeira entrega e refeitos:
- **Funil**: os trapézios com quinas viraram **bulbos com curvas de Bézier**, gradiente
  azul→roxo→rosa, nome da etapa no topo, % sobre o eixo e valor absoluto embaixo.
  A meia-altura de cada etapa é proporcional ao valor, e o estrangulamento entre elas
  sai das curvas — não de barras justapostas.
- **Mapa**: agora é o **modo padrão** (antes abria em Ranking, e o usuário nunca via o
  mapa) e desenha os continentes de verdade.
- **Donuts**: eram um disco fixo de 140 px perdido num card alto ("raso e vazio").
  Passaram a **escalar com o bloco** (`flex` no SVG + legenda centralizada).
- **Barras** (por horário / lucro / por dia): eram tracinhos de 2 px espalhados.
  Ganharam grade de fundo, eixo Y, gradiente, brilho e topo arredondado — com
  `max-width` por barra para 2 ou 3 pontos não virarem blocos gigantes.

**Incompleto / TODO no Bloco 5:**
- O mapa desenha **contorno de terra**, não fronteiras por país — os países são
  identificados pelos marcadores, não por preenchimento.
- **`lib/countries.ts` cobre ~32 países.** Um país fora da lista aparece no Ranking com
  o código cru, mas **não ganha ponto no mapa**. Ampliar é acrescentar uma linha.
- **O funil mistura fontes com granularidades diferentes**: "cliques no anúncio" vem de
  métricas **diárias** do Facebook, enquanto os outros estágios são eventos com hora.
  Num período de horas os números não são comparáveis.
- **"Vendas iniciadas" conta todos os eventos de venda** (inclusive reembolsadas e
  chargebacks), porque é o que existe hoje na tabela.
- Os rótulos dos eixos ficam dentro de um SVG com `preserveAspectRatio="none"`; em
  blocos muito largos e baixos o texto estica. O tooltip já é HTML por isso.
- A **animação do funil** depende do browser interpolar `points`; o suporte é bom mas
  não é garantido em todos.

---

### Bloco 4 — Métricas do Dashboard

Feito:
- **ROI virou multiplicador.** Era `(profit / totalCost) * 100` exibido como `1331%`;
  agora é a razão pura, formatada com **`multFmt`** (2 casas: `13,31x`). Os `deltas`
  não foram afetados — são variação percentual entre períodos, e a escala se cancela.
- **ARPU** = faturamento ÷ compradores únicos. O comprador é identificado pelo e-mail;
  **vendas sem e-mail contam como compradores distintos**, porque não há como agrupá-las
  — melhor superestimar o denominador (ARPU conservador) do que fundir pessoas.
- **CPA já existia** (`spend / salesCount`) desde a v1 — só não estava evidente. Nada a
  fazer além de confirmar que está no `blocks.ts`.
- **Três séries novas**: vendas por horário, lucro por horário (24 posições) e vendas
  por dia (até 30). Renderizadas por um `BarrasVerticais` reutilizável, com tooltip por
  barra e rótulo de hora a cada 3h para não virar sopa de números.
- Os 4 blocos novos entram **desativados**, aparecendo em "Métricas disponíveis" —
  quem já tinha layout salvo não vê o dashboard mudar sozinho.

> **Decisão sobre "respeitar os filtros".** O roteiro pede "24h do dia atual" e
> "últimos 30 dias" mas também exige que toda métrica respeite os filtros do topo.
> Resolvido bucketizando a **janela já filtrada**: com o período em "Hoje" o gráfico por
> horário É as 24h de hoje; com "Últimos 30 dias" o por-dia É o mês. Fica coerente com
> qualquer filtro em vez de ignorar o de cima.

> **Lucro por hora é rateado.** Não há como atribuir gasto de anúncio (que vem de
> métricas *diárias*) nem despesas de gateway/imposto a uma hora específica. O lucro
> horário aplica `custoSobreReceita = (gasto + despesas) / faturamento` proporcional ao
> faturamento da hora. É aproximação, não custo real por hora.

**Testado com dados reais:** 4 vendas semeadas (duas do mesmo e-mail, uma sem e-mail)
→ `revenue=1238,70`, `buyers=5`, `arpu=247,74` — confirmando que o mesmo comprador com
2 compras conta uma vez. `byHour` com 24 posições e vendas nas horas certas; ROI saiu
`13,31x` na tela (era `1331%`). Os 4 blocos apareceram em "Métricas disponíveis" e
foram adicionados ao grid. Dados de teste removidos depois.

**Incompleto / TODO no Bloco 4:**
- **`roasFmt` continua com 1 casa** (`0,0x`) enquanto o ROI usa 2 (`13,31x`). O roteiro
  dizia "igual ao ROAS" mas deu exemplos de 2 casas (`1,87x`); segui os exemplos e não
  mexi no ROAS, que não estava no escopo. **Alinhar os dois se você preferir.**
- **Sem delta para o ARPU**: `trendOf("arpu")` procura uma chave que o backend não
  calcula, então cai no texto neutro "vs. período anterior" em vez de uma variação.
- Os gráficos de barras são **CSS puro, sem eixo Y nem grade** — o valor só aparece no
  tooltip. Eixos e tooltips ricos são o Bloco 5.
- "Vendas por dia" corta em 30 pontos; um período personalizado mais longo mostra só os
  30 últimos dias, silenciosamente.

---

### Bloco 3 — Filtros e container do topo

Feito:
- **Container único** (`.tk-filtros`) com os 4 filtros + o botão "Editar dashboard",
  usando fundo/borda/raio dos cards. Para o botão morar aqui, o estado do grid saiu do
  `DashboardGrid` para o hook **`useDashboardLayout`**, chamado na `DashboardView` — o
  grid virou puro renderizador. Em modo de edição o container troca o botão por
  Salvar / Cancelar / Redefinir.
- **`ui/Select.tsx`** — select próprio (o nativo não aceita dropdown escuro nem busca).
  Mantém o que o nativo dava de graça em acessibilidade: `combobox`/`listbox`, setas,
  Enter/Esc/Home/End e foco de volta no gatilho ao fechar. **Busca interna aparece só
  quando a lista tem ≥ 8 itens** (`searchThreshold`) — é o caso das contas de anúncio.
- **`ui/DateRangePicker.tsx`** — calendário de intervalo: seleção de duas pontas com
  pré-visualização no hover, setas de mês, dropdowns de mês e ano, os 6 atalhos
  (Hoje / Ontem / Últimos 7 / Últimos 30 / Este mês / Mês passado), Aplicar e Cancelar,
  e dias futuros desabilitados.
- **`lib/dateRange.ts`** — a lógica de data ficou fora do componente, como função pura
  e testável.

> ⚠️ **Nunca usar `Date.toISOString()` para pegar "o dia".** Ele converte para UTC e no
> Brasil (UTC-3) **a partir das 21h local já devolve o dia seguinte** — o filtro "Hoje"
> apontaria para amanhã toda noite. Use `toISO()` do `lib/dateRange.ts`, que monta a
> data a partir dos componentes locais. Verificado: 21:00 de 24/07 → `toISOString()`
> dá `2026-07-25`.

O backend **já suportava** `period=custom` com `from`/`to` (em `metrics.ts` desde a v1);
faltava só o front mandar. `useTraffikState` ganhou `dashFrom`/`dashTo` e setters por
valor (`setDashPeriod`, `setDashRange`, …) no lugar dos antigos `onDashX` que recebiam
um `ChangeEvent` de `<select>` nativo.

**Testado:** 17 casos da lógica de data passando, incluindo ano bissexto, "Mês passado"
a partir de janeiro (cai em dez/2025), grade de julho (3 vazios + 31 dias) e a
divergência de fuso demonstrada às 21h. No navegador: dropdown escuro com hover roxo e
✓ no selecionado; calendário abre **dentro da tela** com os 6 atalhos e 7 dias futuros
desabilitados; aplicar "Este mês" fechou o popup, mudou o rótulo do filtro para
`01/07 – 24/07` e disparou
`GET /api/dashboard?period=custom&…&from=2026-07-01&to=2026-07-24` → 200.
Também confirmei aqui o que faltava do Bloco 2: **o layout salvo é restaurado** ao
recarregar.

**Incompleto / TODO no Bloco 3:**
- O calendário é **um mês só** (o padrão do mercado para intervalo mostra dois lado a
  lado). Escolher um intervalo longo exige navegar de mês em mês.
- **Ancoragem fixa** (`left: 0`): o popup abre sempre alinhado à esquerda do gatilho,
  com `max-width` para não sair da tela. Não há reposicionamento automático — se o
  filtro de período for para o lado direito da barra um dia, vai precisar de ajuste.
- Os `<select>` de mês/ano **dentro** do calendário ainda são nativos. São listas
  curtas e dentro de um popup já customizado; trocar traria pouco.
- O `Select` não faz *type-ahead* (digitar "c" para pular para "Cartão") quando a busca
  está escondida.
- Sem `<Portal>`: o popup é `position:absolute` dentro do container. Funciona porque o
  container não tem `overflow:hidden`, mas é uma dependência frágil.

---

### Bloco 2 — Grid arrastável do Dashboard

**Escolha da lib: `react-grid-layout` 2.2.3.** O `dnd-kit` é melhor para listas
ordenáveis, mas **não tem redimensionamento** — teria que construir resize,
colisão e compactação na mão. O RGL foi feito exatamente para grid de dashboard,
o layout dele é um array serializável (`{i,x,y,w,h}`) que vai direto para o Json
do Prisma, e o `Responsive` já resolve breakpoints — que é o requisito de
"layouts separados para desktop e mobile". Aceita React 19 (peer `>= 16.3`).

> ⚠️ A **v2 mudou a API** em relação aos exemplos da v1 que circulam por aí:
> `dragConfig={{enabled, handle}}` e `resizeConfig={{enabled, handles}}` no lugar
> de `isDraggable`/`isResizable`, e **não existe mais o HOC `WidthProvider`** — usa-se
> o hook `useContainerWidth()`, que devolve `{ width, containerRef }`.

Feito:
- **`blocks.ts` — registro único** do que existe no dashboard: 18 blocos (12 KPIs +
  6 gráficos/tabelas), cada um com tamanho padrão e mínimo. O layout padrão, o painel
  de "Métricas Disponíveis" e o saneamento derivam **todos** daqui, então adicionar
  uma métrica no Bloco 4 é acrescentar uma entrada nessa lista.
- **`sanitizeLayout`** roda na leitura **e** na escrita: descarta bloco que não existe
  mais no código, força os tamanhos mínimos e ignora entrada inválida. É o que impede
  um layout salvo de quebrar o dashboard depois de um deploy que removeu um bloco.
- **`DashboardGrid.tsx`**: modo de edição com alças de arraste (o cabeçalho roxo do
  bloco), redimensionamento pelo canto, botão ✕ para remover, painel lateral com os
  blocos ainda não usados, e **Salvar / Cancelar / Redefinir configurações**.
  "Cancelar" volta para um snapshot tirado ao entrar em edição.
- **Tabela `DashboardLayout`** (migration `20260724210000`): `@@unique([userId, viewport])`,
  uma linha por usuário × viewport. Actions em `lib/actions/dashboardLayout.ts`.
- `DashboardView` ficou só com a barra de filtros + `<DashboardGrid />`; todo o
  conteúdo virou `BlockContent.tsx`, que mapeia id do bloco → JSX.
- `useTraffikState` passou a expor `metricCards` (o registro por chave) — o grid
  precisa buscar a métrica pelo id, não pela ordem.

**Testado:** modo de edição abre com alças e painel; arrastar um KPI reflui os
vizinhos; adicionar bloco pelo painel funciona (ele some da lista de disponíveis);
"Salvar" grava as duas viewports (14 blocos cada) e o desktop reflete a ordem
arrastada enquanto o mobile mantém o padrão — provando que os layouts são mesmo
independentes. Round-trip do `sanitizeLayout` verificado contra o banco real, mais
os casos de bloco removido (15→14), tamanho abaixo do mínimo (corrigido para 4/5) e
entrada inválida (`null`). `tsc` e `next build` limpos.

**Incompleto / TODO no Bloco 2:**
- **A restauração ao recarregar não foi confirmada visualmente** — a extensão do Chrome
  caiu no fim. Está verificada no banco e pelo round-trip do `sanitizeLayout`, e o
  caminho de leitura é direto (`loadDashboardLayouts` → `setLayouts`), mas convém abrir
  o dashboard e conferir a olho.
- O painel "Métricas Disponíveis" adiciona **por clique, não por arraste**. O roteiro
  pedia arrastar de dentro do painel para a grade; o RGL suporta (`dropConfig` +
  `droppingItem` + HTML5 drag), mas o clique é mais previsível e acessível. Trocar se
  fizer falta.
- **`Cancelar` não desfaz o `Redefinir configurações`** — o reset já apaga no banco na
  hora. É destrutivo e sem confirmação.
- Os gráficos ainda são os SVGs antigos, só que dentro de blocos redimensionáveis.
  Quem os refaz de verdade (área, funil trapezoidal, mapa, donuts) é o **Bloco 5**.
- Sem `rowHeight` responsivo: em telas muito baixas os blocos altos forçam scroll.

---
