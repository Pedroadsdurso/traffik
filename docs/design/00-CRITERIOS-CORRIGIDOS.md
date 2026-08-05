# Redesign TrackHub — decisões e critérios corrigidos

> O **prompt master** e o **roteiro de 8 fases** são do usuário e vivem fora do
> repositório. Este arquivo registra **só o que foi decidido ou corrigido** em
> cima deles, para ninguém "terminar o trabalho" depois seguindo a letra de um
> critério que não se sustenta contra este código.
>
> Decidido em 05/08/2026, antes da Fase 1.

---

## 1. ⛔ O critério "zero Traffik" está CORRIGIDO

O roteiro pede, no aceite da Fase 0: *"`grep -ri traffik` retorna vazio fora de
dados históricos"*.

> ### 🔴 Esse alvo NÃO é alcançável sem quebrar produção
> Dos 136 "Traffik" do `src/`, **27 são identificador já emitido**: o cookie
> `traffik_track`, os globais `window.traffikPixel` / `window.traffik`, o
> `traffik_click_id`. **Eles estão no HTML dos sites dos clientes**, dentro de
> snippets já colados.
>
> Renomeá-los quebra todo rastreamento instalado **em silêncio**: o site continua
> no ar, o script continua rodando, e o dado simplesmente para de chegar. É a
> regra permanente deste projeto — *nenhum identificador já emitido muda de
> significado*.

**O alvo correto, e é este que vale:**

| Onde | Meta |
|---|---|
| Texto de interface, metadado, Open Graph, título de aba | **zero** |
| Nome de pacote, nome de componente, nome de arquivo | **zero** |
| Tipo/hook interno (`useTraffik`, `TraffikContext`, `TraffikView`) | **zero** — é código nosso, sem contrato externo |
| Comentário | **zero** |
| 🔴 Cookie, global do navegador, chave de querystring | **INTOCADO** |
| Coluna de banco, dado histórico, migration aplicada | **INTOCADO** |

⚠️ O padrão `\bTraffik\b` **sensível a maiúscula** é o que protege isso:
`traffikPixel` e `traffik_track` ficam fora por construção (minúsculas, sem
fronteira de palavra). **Não troque por um `-i`.**

---

## 2. Fundação: `sx()` SAI, com a fronteira no ARQUIVO

Tailwind nos componentes novos. `sx()` só no que ainda não foi migrado. **A
fronteira é o arquivo inteiro, nunca o elemento.**

> ### ⛔ Por que a fronteira não pode ser o elemento
> `sx()` produz `style` inline, que **vence classe utilitária na cascata**. Um
> componente com as duas coisas tem estilo decidido por precedência, não por
> intenção — e o sintoma é visual, intermitente e não aparece em `tsc`, `lint`
> nem teste. É a categoria de bug que este projeto já coleciona.

---

## 3. Gráficos: Recharts na série temporal, SVG próprio no resto

| Componente | Vira |
|---|---|
| `AreaChart`, `BarChart`, `Sparkline`, `BreakEvenChart` | **Recharts**, sob o tema único da Fase 4 |
| `Donut`, `Funnel` | **SVG próprio**, retematizado por token |
| `CountryMap` | **SVG próprio — só a COR muda** |

> ⚠️ O `CountryMap` não é gráfico cartesiano: é globo ortográfico com `d3-geo` e
> uma base de paths pré-computada. `react-simple-maps` foi descartado porque só
> suporta React ≤18 (aqui é 19). Reescrever seria risco sem ganho.

---

## 4. Primitivos: reescrever do zero é permitido; trocar a fundação por Radix, não

O master descreve shadcn/ui + Radix. **Este projeto não tem nenhum dos dois** —
são 20 primitivos próprios em `src/components/dashboard/ui/`.

Decisão do usuário: **o que importa é o resultado visual, não a biblioteca.**
Reescrever primitivo do zero é permitido — nova estrutura, novo comportamento
visual, novas animações. O que não se faz é adotar Radix como decisão geral só
para seguir a letra do documento.

⚠️ **Radix caso a caso**, com justificativa por componente: se algum primitivo
precisar de algo que o nosso não resolve, isso é dito e decidido na hora — nunca
como troca de fundação.

> ### 🔴 O que `useOverlay` resolveu é COMPORTAMENTO, e é preservado
> - `onClose` vive numa **ref**, deps `[aberta]`. Devolvê-lo às dependências fazia
>   **toda gaveta e modal perder o foco a cada tecla**.
> - Portal no `<body>`. Overlay é `position:fixed`, e qualquer ancestral com
>   `transform` (o `.page-enter`) vira o bloco de contenção — a gaveta abria
>   achatada.
> - `width: min(Npx, 100%)`, provado em 430/390/360/320px.
>
> Ver a §10 de `docs/auditoria.md` para a lista completa do que preservar.

---

## 5. Filtros globais: vão para a URL; o PERÍODO não persiste entre sessões

O roteiro pede filtro global na URL via `useGlobalFilters`. Aprovado — hoje não
há **nenhum** `useSearchParams` no projeto, e URL compartilhável é ganho puro.

⚠️ **Mas o período continua não sendo persistido entre sessões.** Era decisão
deliberada ("filtro de sessão, não preferência"), e o motivo se mantém: abrir a
ferramenta e cair num recorte do mês passado é pior que recomeçar em "Hoje".

> Na prática: o período **vive na URL** (compartilhável, sobrevive a recarregar e
> a trocar de tela) e **não vai para `localStorage` nem para o banco**. Abrir a
> ferramenta sem query param começa em "Hoje".

⚠️ E o contrato da ÁREA não muda: ela viaja como **id** (`?ws=`) e o servidor
resolve com validação de posse. **Nunca** as listas de filtro pela URL — isso
deixaria o cliente forjar o escopo.

---

## 6. `useTraffikState` NÃO é quebrado antes da Fase 5 — e o dado explica

O hook tem 1.953 linhas, mas a pergunta certa não é o tamanho: é **quantas telas
dependem dele**.

Medido: **8 arquivos recebem `v`** — `DashboardView`, `AdsManagerView`,
`CreativesView`, `FeesView`, `NotificationsView`, `integracoes/AnunciosView`,
`integracoes/WebhooksView` e `ads/NovaCampanhaModal`.

E **10 views já são autocontidas**: `AreasView`, `RulesView`, `PixelView`,
`TestesView`, `UtmsView`, `ExcluirAreaDialog`, `RuleDrawer`, `AdsTable`,
`AdsActionBar`, `TestadorPayloadCard`.

> ### ⛔ Decompor tudo antes da Fase 5 seria o oposto de "uma fase por PR"
> Um refactor do hook toca as 8 telas **de uma vez** — exatamente o acoplamento
> que a fase por PR existe para evitar. E o risco não é de layout: é de **número**.
> Esse hook deriva KPI, gráfico e feed, e este projeto documenta quatro vezes que
> o modo de falha caro é *número plausível e errado*.
>
> **O caminho é incremental, e o padrão já existe e está provado em 10 views:**
> 1. a **Fase 3** extrai só o que o shell precisa — `useGlobalFilters` (→ URL),
>    área ativa, live/sync. Isso a Fase 3 faria de todo jeito;
> 2. cada tela da **Fase 5** se torna autocontida **no próprio PR**, buscando o
>    que precisa pelas server actions que já existem;
> 3. o hook **encolhe sozinho** conforme as telas saem. A última tela a migrar
>    apaga o que restou.
>
> Assim a decomposição acontece com o teste da tela ao lado, em vez de num commit
> grande que mexe em tudo.

---

## 7. Marca — o que existe e o que falta

`npm run marca:gerar` deriva tudo dos 3 PNGs de origem. **A saída é commitada.**

| Gerado | Para quê |
|---|---|
| `public/marca/simbolo-{claro,escuro}-{512,256,128,64}.png` + `.webp` | rail colapsado de 56px |
| `public/marca/wordmark-{claro,escuro}-{96,48}.png` + `.webp` | rail expandido, login, e-mail |
| `src/app/icon.png` (512), `src/app/apple-icon.png` (180) | favicon e ícone de app |

> ### 🔴 O símbolo é DIFERENTE nos dois arquivos de origem
> No `logo tema claro.png` a aresta inferior é azul-**marinho** (quase preto);
> sobre o `#090D14` do tema escuro ela **desaparece**. No `logo tema escuro.png` a
> mesma aresta é azul.
>
> Recortar de um só arquivo produz um traço invisível no tema principal. Foi
> descoberto **olhando o PNG gerado** — o recorte "funcionou" nas duas vezes e o
> script reportou êxito.

> ### ⚠️ Os wordmarks de origem têm 57% de padding vertical
> Conteúdo real 3,95:1 dentro de arquivo 2:1. Renderizar o arquivo cru por
> `max-width` deixa a marca com 43% da altura da caixa — a armadilha que a logo da
> OnyxPag já custou aqui. **Use sempre a saída aparada.**

**Falta, e não é derivável daqui:**

1. **SVG do símbolo e do wordmark.** A 56px o PNG fica mole, e em SVG o gradiente
   pode vir do token `--gradient-brand` em vez de pixel fixo.
2. **"track" branco sem bevel/sombra.** O `logo tema escuro.png` tem relevo e
   borda cinza assados, que sobre `#090D14` liso leem como sujeira.

---

## 8. Números de partida (Fase 0) — para medir o progresso

| Métrica | Fase 0 | Meta |
|---|---|---|
| Cores hardcoded | **310** (216 fora do `globals.css`) | **0** fora de token |
| Tamanhos de fonte distintos | **19** | 8 níveis da escala |
| Altura até o primeiro dado | ~150px | **~48px** |
| Views dependentes do monolito | 8 | 0, ao fim da Fase 5 |

Detalhe completo em **`docs/auditoria.md`**.
