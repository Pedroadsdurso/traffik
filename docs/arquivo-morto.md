# Arquivo-morto — o que saiu do fluxo, e por quê

> ### ⛔ NADA foi apagado. Isto está aqui para ser encontrado, não esquecido.
> Vários "obsoletos" desta base voltaram a importar. O que entra aqui é o que
> **descreve comportamento que MUDOU** — a categoria mais perigosa de
> documentação, porque é útil, bem escrita, e instrui a reintroduzir o bug que
> a mudança consertou (ver o caso `NOTA_DO_EVENTO` no PROCEDIMENTO).
> O motivo de cada entrada vem antes dela.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 1. Loader + runtime hospedado (REVERTIDO em 28/07/2026)

> ### Por que está aqui
> **Descreve, no presente do indicativo, uma arquitetura que foi REVERTIDA.** O
> texto afirma "o que o cliente cola no site é um loader de 3–5 linhas" e lista
> `public/t.js`/`px.js` como servidos — e nada disso é verdade hoje: os scripts
> voltaram a ser INLINE e autocontidos, porque o loader **quebrou instalações em
> produção**.
>
> É a categoria mais perigosa de documentação, a mesma do `NOTA_DO_EVENTO`
> (7º caso do PROCEDIMENTO): útil, bem escrita, e instrui a reintroduzir
> exatamente o que a reversão consertou.
>
> **A decisão viva está em `docs/temas/pixel-e-scripts.md`** → "Scripts
> instaláveis: INLINE, e por que voltamos atrás".
>
> ⚠️ **Não foi apagado porque a EVIDÊNCIA vale:** os números medidos aqui
> (5.800 → 743 bytes, o custo de dependência de rede, o `Cache-Control` que
> escondeu um bug real durante o diagnóstico) são o que sustenta a decisão de não
> tentar de novo. Se alguém propuser loader outra vez, a resposta está aqui.

---

### O conteúdo original, íntegro

**O que o cliente cola no site é um loader de 3–5 linhas**, não a lógica. A lógica é
servida por nós, minificada com **terser** no build.

| Camada | Arquivo |
|---|---|
| Fonte (legível, ES5, comentada) | `src/scripts/traffik-utm.src.js` · `src/scripts/traffik-pixel.src.js` |
| Build (terser) | `scripts/build-scripts.mjs` — roda no `npm run build`; `--check` falha se o commitado estiver defasado |
| Servido | `public/t.js` (UTMs) · `public/px.js` (pixel) · `public/pixel.js` (**alias legado** do `t.js`) |
| Gerador do snippet | `utmLoaderSnippet()` em `src/lib/utm/scripts.ts` · `pixelLoaderSnippet()` em `src/lib/pixel/script.ts` (um por pixel cadastrado) |
| Tela | `ui/SnippetBox.tsx` — um bloco, um botão, **sem alternativa** |

> ### 🎯 InitiateCheckout: por que NÃO dá para detectar por URL do checkout
> **O checkout da Kirvano é hospedado pelo gateway (`pay.kirvano.com`) e o cliente
> não tem acesso ao código daquela página.** A regra `contem_url` compara a URL da
> página onde o script está rodando — se o script não roda lá, o evento nunca
> dispara. Foi exatamente essa a configuração que ficou sem gerar eventos.
> Existem duas vias, e as duas funcionam **sem script no checkout**:
>
> 1. **Clique no link de checkout** (`clique_checkout`, o padrão): o `px.js` na
>    página de vendas escuta cliques e sobe do alvo até o `<a>` — o clique quase
>    sempre cai num `<span>`/`<img>` dentro do link. Se o `href` casa com um
>    domínio de gateway (lista padrão: `pay.kirvano.com`, `hotmart`, `cartpanda`,
>    `kiwify`, `monetizze`, `pay.`, `checkout`, ou a lista do usuário), dispara.
> 2. **Webhook do gateway** (`src/lib/webhook/checkoutEvent.ts`): toda venda que
>    chega **PENDENTE** vira um InitiateCheckout — cobre `PIX_GENERATED`,
>    `BANK_SLIP_GENERATED`, `SALE_PENDING` e `ABANDONED_CART`. Venda que já chega
>    APROVADA **não** gera checkout (ela já conta como venda no funil).
>
> **Dedup em duas camadas:** `eventId = "gw:<externalId>"` mata a reentrega do
> gateway (a Kirvano reenvia o mesmo `PIX_GENERATED` — visto em produção), e o
> `fbclid` do clique casado mata a contagem dupla clique+webhook dentro de 6h.
>
> ⚠️ Os modos `contem_texto`/`contem_css`/`contem_url` continuam disponíveis, mas
> `contem_url` só serve para checkout **no seu próprio domínio**. A UI avisa isso.

> ### 🐛 Regressão: Lead e AddToCart nunca apareciam no feed (corrigido)
> `computeDashboard` filtrava `where: { event: "InitiateCheckout" }` ao buscar os
> `PixelEvent` do feed de Atividade Recente. Os eventos eram gravados normalmente,
> mas **só o InitiateCheckout chegava à tela** — Lead e AddToCart existiam no banco
> e sumiam na consulta. Agora a consulta traz todos, e o feed tem badge próprio
> para `lead` e `add_to_cart`. O funil continua contando só InitiateCheckout, mas
> por um `count()` separado: antes usava o tamanho da lista, que é truncada em 200
> e agora inclui outros eventos — usar o mesmo dado subcontaria o funil.
>
> ⚠️ **PageView nunca existiu** neste projeto: não está no script antigo, não é
> enviado, não é gravado e não é um tipo do feed. Se for pedido, é feature nova —
> e vale lembrar que o "Clique" do `t.js` já registra a visita uma vez por sessão.

> ### ⚠️ UMA opção de instalação, sem ramificação — decisão do usuário (28/07/2026)
> **A tela mostra UM snippet e UM botão "Copiar script". Não existe formato
> alternativo, nem "colei e não funcionou?", nem seletor.** Os dois já existiram
> aqui e foram removidos: transformavam um detalhe de bastidor em decisão de quem
> só quer copiar, colar e rastrear.
>
> O snippet é um **IIFE em JavaScript puro** (`utmLoaderSnippet` / `pixelLoaderSnippet`),
> sem tags `<script>` próprias, porque é o formato que funciona nos dois campos
> onde ele é colado: o de "código do cabeçalho" do site e o de script de
> gateway/checkout, que aceita só JavaScript. Um snippet que trouxesse as próprias
> tags viraria `<script><script>…</script></script>` num campo que embrulha, e não
> executaria — foi assim que a instalação no checkout quebrou em silêncio.
>
> ⚠️ **Limite conhecido e aceito:** JavaScript puro **não executa** se for colado
> num campo que insere o texto como HTML cru sem embrulhar em `<script>`. Na
> prática os campos de "cabeçalho" embrulham, e o ganho de ter uma opção só
> compensa. Se um caso desses aparecer, a saída **não** é reintroduzir escolha na
> tela — é ajustar o texto de instrução ou detectar o caso, nunca devolver a
> decisão ao cliente.
>
> Pelo mesmo motivo o loader **não tem mais JavaScript inline**: além do problema
> acima, CSP com `script-src` restrito bloqueia inline no site do cliente. A config
> viaja em `data-cfg` / `data-lead` / `data-atc` / `data-ic-t` / `data-ic-v`, e o
> runtime registra **todas** as tags do `px.js` na página (um pixel por tag).
>
> **Regra de IC por URL (`contem_url`) exige o script NO CHECKOUT**, não no site de
> vendas — é a URL do checkout que precisa casar. A gaveta do Pixel agora avisa
> isso em amarelo quando detecta esse tipo de regra, porque é um erro de instalação
> invisível: tudo parece configurado e nenhum evento chega.

**Tamanho no `<head>` do cliente: 5.800 → 743 bytes (−87%).** UTM 3.145 → 275 B; pixel
2.655 → 468 B. Os runtimes servidos ficam em 3.471 B e 3.011 B (1,77 e 1,56 KB gzip),
baixados **uma vez** e cacheados.

Pontos que não são óbvios:

- **A saída é COMMITADA** (mesma escolha do `gen-world-paths.mjs`): `npm run dev` serve
  os arquivos sem passo extra e nenhum deploy sobe sem eles.
- **`public/pixel.js` deixou de ser fonte** — hoje é gerado, byte a byte igual ao
  `t.js`. O runtime aceita **os dois formatos de configuração** (`data-account` do
  script antigo e o loader novo) e ainda expõe `window.getTrackingData`, então quem
  instalou a versão da v1 continua funcionando sem reinstalar. `test-checkout` usa
  exatamente esse caminho.
- **O loader não bloqueia**: cria a tag com `async=1` e injeta no `<head>`. Medido no
  teste — DOM interativo em 46 ms, os dois scripts só terminaram em 51 ms.
- **`next.config.ts` define `Cache-Control: max-age=3600, stale-while-revalidate`** para
  os três arquivos. O padrão do Next para `public/` é `max-age=0`, o que faria cada
  pageview do site do cliente revalidar antes de rastrear.
- **O loader do pixel deixa um stub com fila** (`window.traffikPixel.track` enfileira em
  `q`), drenada quando o runtime chega — um `track()` manual no HTML do cliente não se
  perde mais por corrida.
- **Configuração de vários pixels na mesma página**: o loader empurra para `window._tkpx`
  e o runtime **troca o array por um objeto com `push`** que inicializa na hora. Assim
  um loader que rode depois do runtime também é atendido, e instalar o mesmo snippet
  duas vezes não duplica evento (guardas `__tkpxL` / `registrados`).
- **`jsonInline()` escapa `<`** na config embutida: um valor de regra contendo
  `</script>` fecharia a tag e quebraria a página do cliente.
- O **back redirect continua inline** (~460 B): o destino muda por instalação e um
  loader para ele seria maior que o próprio código.

**Testado ponta a ponta** com um site falso em `localhost:4321` (origem diferente,
snippets gerados pelos geradores reais): runtime e pixel carregados, UTMs + fbclid no
cookie, `click_id` devolvido pelo `/api/track/click` (CORS ok), link de checkout
decorado e link comum intacto, `Lead`/`AddToCart`/`InitiateCheckout` gravados em
`PixelEvent`, fila drenada, clique registrado **uma vez por sessão** mesmo após reload.
`tsc --noEmit` e `next build` limpos. Dados de teste removidos depois.

> ⚠️ **Ao mexer nos `.src.js`, rode `npm run scripts:build` e commite a saída.** O
> `npm run build` regenera, mas um commit sem isso deixa `public/*.js` divergente da
> fonte — `npm run scripts:check` existe para pegar isso.

---

## 2. Item (d) — escopo de 01/08/2026

> ### Por que está aqui
> **Contém uma afirmação MEDIDA como falsa em 05/08/2026.** Ele diz que o
> `Drawer` tem "largura FIXA em px — 520 padrão, 560 nas gavetas" e que "abaixo
> de ~600px de viewport ele não cabe". A leitura do código mostrou
> `width: min(<largura>px, 100%)` nos dois overlays portados — eles já se
> resolvem sozinhos no estreito.
>
> Também fala em "4 tipos de overlay `position:fixed`", e só **dois** são fixed e
> portados; os outros dois (`.tk-pop`, `DateRangePicker`) são `absolute` dentro
> do próprio container — o que muda o problema de LARGURA para ANCORAGEM.
>
> Seguir este escopo faria alguém "consertar" um clamp que já existe e passar ao
> lado do defeito real.
>
> **O escopo vivo está em `docs/FILA.md`** → "ITEM (d) — MEDIDO em 05/08/2026".
>
> ⚠️ **Mantido porque o MÉTODO continua valendo:** a regra do `resize_window` que
> mente com a janela maximizada, os três contornos e a exigência de ler
> `innerWidth` depois de qualquer resize saíram daqui e seguem verdadeiros.

---

### O conteúdo original, íntegro

**Deixou de ser "varrer 23 blocos em N larguras".** A descoberta de que **não
existe uma única `@media` de largura na base** (só `prefers-reduced-motion` e
`prefers-color-scheme`) muda o cálculo: toda responsividade é `auto-fit`/`minmax`
mais o `react-grid-layout` com `useContainerWidth()`, ou seja, **tudo responde à
largura do CONTAINER**. Constringir o container é equivalente a estreitar a
janela, e o **"0 de 23" da sessão anterior vale** — não precisa ser refeito.

### O que sobra, e é o alvo real: os `position:fixed`

São os únicos que dimensionam pelo **viewport**, que o método do container não
estreita. Todos passam por `ui/useOverlay` e são portados para o `<body>`:

| # | Overlay | Suspeita |
|---|---|---|
| 1 | **`ui/Drawer`** | 🔴 **largura FIXA em px** — 520 padrão, **560** nas gavetas de Regra e Pixel. Abaixo de ~600px de viewport não cabe |
| 2 | `ui/Modal` | centrado; conferir `max-width` e as margens |
| 3 | Dropdown do `ui/Select` | ancorado ao gatilho, `minWidth` por chamada (até 290px) |
| 4 | Popup do `ui/DateRangePicker` | ancoragem **fixa** (`left: 0`), sem reposicionamento — dívida já registrada |

> ⚠️ **O `Drawer` é o alvo óbvio e o mais barato de consertar**: `largura` vira
> um teto (`min(largura, 100vw - margem)`) em vez de um valor absoluto. Mas
> **meça antes de mudar** — foi medir que evitou aumentar o `minH` do funil
> quando o problema era `min-height:auto`.

### E a varredura de condicionais, que continua no item

Semear dados que ativem **cada caminho condicional** — estados de erro, avisos
âmbar, rodapés, badges, chips — e conferir **cada um na tela**. O "0 de 23" só
prova que não há transbordo **naquele estado de dados**; o rodapé do funil ficou
invisível por semanas justamente por ser condicional.

### 📏 A regra do resize, que vale para qualquer sessão

> ### ⛔ NUNCA confie na mensagem de sucesso do `resize_window`
> Com a janela **maximizada** ele devolve *"Successfully resized window … to
> 900x850 pixels"* e **nada acontece** — o gerenciador de janelas ignora o
> `chrome.windows.update({width,height})` nesse estado, e nada no retorno confere
> o resultado. Chamar de novo não adianta. Reproduzido em 01/08/2026.
>
> **Depois de qualquer resize, leia `innerWidth`/`innerHeight` e compare.**
> `innerWidth === screen.availWidth` é o indício de janela maximizada.

**O método do (d) é janela restaurada ou CDP — NÃO o container:**

| | Como | Custo |
|---|---|---|
| 1 | **Restaurar a janela** (Win+Down ou duplo clique na barra de título) antes da sessão | precisa do usuário: a extensão manda tecla para a PÁGINA, não para o gerenciador de janelas |
| 2 | `chrome-devtools-mcp` → `resize_page` (CDP `Emulation.setDeviceMetricsOverride`) | **imune ao estado da janela**. Exige fechar o Chrome do perfil `~/.cache/chrome-devtools-mcp/chrome-profile` (ou `--isolated`), e é sessão separada → novo login |
| ❌ | Constringir o container | **não serve aqui**: overlay é `position:fixed` e não enxerga o container |

---

## 3. "Próximo passo recomendado" (rodapé da era dos Blocos v2)

> ### Por que está aqui
> **Os quatro passos que ele recomenda já foram feitos**, alguns há semanas: o
> deploy da Vercel foi resolvido em 29/07, os Blocos 6 e 7 em 25/07, o Bloco 8 em
> 29/07, e a faxina do nav morto (a "dívida técnica #2" que ele cita) em 05/08.
>
> Ficou no rodapé do arquivo desde a v1 e nunca foi atualizado — então qualquer
> sessão que o lesse como "o que fazer agora" trabalharia no passado.
> **A fila viva está no CLAUDE.md e em `docs/FILA.md`.**
>
> ⚠️ Mantido como registro de qual era a ordem planejada do roteiro v2: é o único
> lugar que ainda a descreve.

---

### O conteúdo original, íntegro

1. **Resolver o deploy da Vercel** — os 4 passos manuais na seção acima. É a única
   pendência que depende do painel e trava ver qualquer coisa em produção.
2. **Bloco 6** (Gerenciador de Anúncios: layout e colunas estilo Facebook) — abas viram
   cards, tabela com 14 colunas de métricas, colunas fixas ao rolar, toggle de
   pausar/ativar na primeira coluna chamando a Marketing API, e checkboxes de seleção.
3. Depois **Bloco 7** (ações em massa, CBO/ABO) e **Bloco 8** (Regras).
4. Faxina pendente: a dívida técnica #2 (nav morto no `useTraffikState`).

---

## 4. As 6 linhas CORRIGIDAS na reorganização de 05/08/2026

> ### Por que estão aqui
> A reorganização foi verificada linha a linha contra o CLAUDE.md original, e
> **6 linhas não sobreviveram verbatim**. Todas por edição deliberada, e ficam
> registradas aqui para a contabilidade fechar — "nada apagado" tem de ser
> auditável, não uma promessa.

### 4a. Quatro títulos de seção que deixaram de existir

As entradas 1, 2 e 3 deste arquivo receberam um cabeçalho novo com a
justificativa. Os títulos originais eram, textualmente:

```
## 📦 (histórico) Loader + runtime hospedado — REVERTIDO
## 🎯 (histórico) ITEM (d) — escopo de 01/08/2026
## Próximo passo recomendado
```

E um quarto foi **absorvido**, não arquivado:

```
## 🚦 COMECE AQUI — sessão de 05/08/2026
```

Ele duplicava a tabela de migrations pendentes e a fila, que agora vivem em
"ESTADO ATUAL E FILA" no CLAUDE.md. **Duas fontes para o mesmo fato divergem
sempre** — é a regra da própria base, e deixá-las lado a lado no arquivo que
existe para ser lido em toda sessão seria o pior lugar possível. A única coisa
exclusiva dele (a tabela "O que foi entregue") foi movida para lá, íntegra.

### 4b. Uma linha da seção "Stack" — descrevia config que MUDOU

Original:

```
  usamos **Vercel Cron** no lugar (ver `vercel.json`)
```

Estava **errada desde 29/07/2026**: os crons saíram do `vercel.json` porque o
plano Hobby só aceita cron diário e **rejeitava o deploy inteiro** com `*/15`. O
texto novo diz onde o agendamento vive de verdade (dois agendadores externos) e
por que o `vercel.json` não os declara.

### 4c. Três linhas da "Estrutura de pastas" — apontavam para arquivos DELETADOS

Originais:

```
    EditDashboardDrawer.tsx  Icon.tsx  ImageSlot.tsx
    types.ts                        # só TabKey e MetricKey
                                    #   NotificationsView, FeesView, UtmView
```

`EditDashboardDrawer.tsx` foi deletado em 05/08 (era inalcançável), `Icon.tsx` em
30/07 (convergência de ícones), `TabKey` em 05/08 (faxina do nav morto) e
`UtmView` no Bloco 11 (virou `UtmsView`, autocontida). Um mapa de pastas que
lista arquivo inexistente manda procurar o que não existe.

> ⚠️ Nenhuma outra linha do CLAUDE.md original mudou. As **86** seções restantes
> estão verbatim, e a seção "ACHADO: o navegador embutido" está dividida em duas
> (os blocos operacionais — Comandos, ordem de deploy, pendências — foram para o
> CLAUDE.md, e as 243 linhas dela foram confirmadas presentes).
