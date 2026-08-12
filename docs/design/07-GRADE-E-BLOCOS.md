# 07 — Grade, blocos e escala de conteúdo (Dashboard)

Documento de decisão. Substitui as regras de layout do modo de edição (entregas A/B/C).
Precedência: este documento vence o `06-LINGUAGEM-VISUAL.md` em **geometria e comportamento**;
o `06` continua valendo em **acabamento** (raio, cor, pílula, hachura, sombra, tipografia).

---

## 1. Por que existe

Queixas medidas na tela em 12/08, na versão que está em produção:

1. só 4 blocos em Principais e 8 em Resumo — 11 métricas disputam 8 vagas, o resto some
2. não dá para diminuir bloco; os tamanhos não são livres
3. blocos não são responsivos: o conteúdo se reposiciona, não escala
4. "Vendas por país" muda de tamanho ao alternar Ranking ↔ Globo
5. sobra vazio dentro dos cards e buraco entre eles
6. os gráficos parecem amadores

As seis têm **duas** causas, não seis.

---

## 2. Diagnóstico

### Causa A — a altura vem do conteúdo

Foi uma decisão anterior ("altura vinda do conteúdo") e é a raiz de 3, 4 e 5.

Se a altura do card é função do que está dentro, então:

- trocar a variante muda o card (queixa 4 é consequência direta, não bug isolado);
- o conteúdo nunca precisa se adaptar, porque o card sempre cede — daí 3;
- o usuário não tem o que redimensionar no eixo vertical — daí 2;
- e como cada card tem uma altura própria, a linha da grade fica com o tamanho do maior e os outros ganham vazio — daí 5.

**Inversão:** a altura é propriedade do **layout**. O bloco declara `w × h` em células. O conteúdo preenche 100% do slot ou declara que não cabe.

> ### ⚠️ ISTO REVERTE UMA DECISÃO DELIBERADA DE 07/08/2026 — e o registro dela vai aqui
>
> `DashboardScreen.tsx:108` documenta o oposto, com o sintoma que a motivou:
>
> > *"`linhas` vira `minHeight`, **NÃO** `grid-row: span`. `span` é uma altura FIXA
> > e o conteúdo maior vaza ou é cortado; `minHeight` é um PISO."*
>
> E `DashboardScreen.tsx:82` registra o print que a produziu: com linha fixa e
> `span`, um bloco **vazio** reservava as 6 linhas que teria com dado só para
> escrever *"Sem dado neste período"*, ao lado de outro de 3. **Estado vazio é o
> que os testadores mais veem.**
>
> ⛔ **O sintoma estava certo; a conclusão, não.** O `minHeight` não resolveu o
> vazamento — trocou-o por três problemas:
>
> | | |
> |---|---|
> | 1 | sem controle vertical: não há o que redimensionar |
> | 2 | o conteúdo nunca aprende a caber, porque o card sempre cede |
> | 3 | `alignItems: stretch` faz o menor da linha herdar a altura do maior — **terceira mecânica** decidindo altura, e ela some sozinha com o `span` |
>
> A solução do vazamento não é o piso: **é o conteúdo caber**, que é a F3.
>
> 🔴 **Por isso a F1 só entra com DUAS condições**, e as duas são precondição, não
> item posterior:
>
> 1. **o colapso do bloco vazio** (era §8, virou F0 — ver §9);
> 2. **a F3 nos blocos que hoje excedem o piso** — e a F1 não fecha sozinha:
>    fecha com a LISTA dos blocos que passam do slot depois da migração.

### Causa B — zonas com teto fixo

`Principais — sempre 4` e `Resumo — até 8` são tetos arbitrários que existem só porque os três grupos são três componentes diferentes. Não há razão de produto para que um KPI não possa ocupar 6 colunas nem para que existam exatamente 8 vagas de métrica compacta.

**Colapso:** uma grade só. KPI, métrica compacta e painel viram o mesmo objeto, com mínimos diferentes.

> **Decisão que depende do usuário:** isto revoga "4 KPIs hero fixos em slots" e o teto de 8.
> Se ele quiser manter o hero fixo, o resto deste documento continua válido — muda só que os 4 primeiros blocos nascem travados na primeira linha.

### Causa C — os gráficos (independente de A e B)

Defeitos visíveis nos prints, um a um:

| # | onde | o que está errado |
|---|---|---|
| C1 | card ROAS | a série vira **fragmentos soltos**: buracos na série desenhados como segmentos órfãos de ~8px. Observação isolada deve virar **ponto**, não traço |
| C2 | Vendas por dia | rótulos do eixo x cortados (`07-1`, `08-`) — o eixo não reduz a densidade de ticks quando falta largura |
| C3 | Lucro por horário | barras sem eixo Y, sem rótulo de valor e sem linha de zero declarada; lê como erro de renderização |
| C4 | Vendas por posicionamento e Formas de pagamento | a barra atrás do texto não está ancorada no maior valor da lista e sobra retângulo fora da coluna |
| C5 | Taxa de aprovação | três medidores radiais em tamanho fixo, um deles com `0 de 1`, ocupando 400px de altura |
| C6 | Produtos, Vendas por país, Alertas | 180–400px de vazio contínuo dentro do card |
| C7 | modo de edição | títulos truncados (`Vendas ...`, `Faturam...`, `Ticket ...`) porque o chip tem largura fixa |
| C8 | Vendas por horário | barras de largura fixa: com 24 buckets viram fios; com 6, tarjas |

Nenhum deles é questão de gosto. São todos "o desenho não sabe o tamanho que tem".

---

## 3. Decisão 1 — grade de células

```
colunas:      12
gap:          var(--tk-gap-grid)   /* 16px */
unidade linha: var(--tk-row)       /* 80px */
```

Altura resultante: `h × 80 + (h − 1) × 16` → h=1: 80 · h=2: 176 · h=3: 272 · h=4: 368 · h=5: 464.

Bloco no layout:

```ts
type Slot = { id: string; col: number; row: number; w: number; h: number }
```

CSS:

```css
.tk-grade      { display: grid; grid-template-columns: repeat(12, 1fr);
                 grid-auto-rows: var(--tk-row); gap: var(--tk-gap-grid); }
.tk-slot       { grid-column: span var(--w); grid-row: span var(--h);
                 min-width: 0; min-height: 0; }        /* os dois são obrigatórios */
.tk-slot > .tk-card { height: 100%; container-type: size; }
```

**Proibido dentro de qualquer card:** `min-height` em px, `height: auto` no wrapper de gráfico, e altura de SVG em px fixo. Vira asserção (§7.8).

### Mínimos e padrões do catálogo

| bloco | wMin | hMin | padrão |
|---|---|---|---|
| KPI hero (Faturamento, Gasto, ROAS, Lucro) | 2 | 1 | 3×2 |
| Métrica compacta (ROI, CTR, CPA, ARPU, Ticket, …) | 1 | 1 | 2×1 |
| Receita × Gasto | 4 | 3 | 6×4 |
| Funil | 5 | 3 | 6×4 |
| Vendas por país — ranking | 3 | 2 | 6×3 |
| Vendas por país — globo | 3 | 3 | 6×4 |
| Taxa de aprovação | 3 | 2 | 6×3 |
| Atividade recente | 3 | 3 | 6×4 |
| Lucro / Vendas por horário | 4 | 2 | 6×3 |
| Vendas por dia | 4 | 2 | 6×3 |
| Produtos / Formas de pagamento / Posicionamento | 3 | 2 | 4×3 |
| Alertas | 3 | 1 | 12×1 |
| Estado do sistema | 4 | 1 | 12×1 |

`wMin` de 5 no funil vem do achado antigo: abaixo de ~360px a container query esconde a fita.
Nenhum bloco tem `wMax`. Nenhum bloco tem `hMax`.

> ### ⛔ DOIS NÚMEROS DIFERENTES, e confundi-los é o erro
>
> | | O que é | De onde vem |
> |---|---|---|
> | **migração** | o `h` de um layout que **já existe** | **medição** — ninguém vê a tela mudar |
> | **padrão do catálogo** | o `h` de um bloco **novo**, arrastado agora | **decisão** |
>
> **A regra que separa é a natureza do conteúdo:**
>
> | Conteúdo | `padrão` | Por quê |
> |---|---|---|
> | **altura natural** — tabela, lista, feed, rodapé | = a medição | o conteúdo tem um tamanho próprio, e medi-lo mede a necessidade |
> | **elástico** — série, medidor, rosca, funil, mapa | **decidido** | medir um gráfico mede o tamanho que ele ACEITOU, não o que precisa |
>
> ⚠️ Por isso `Receita × Gasto` fica **3 na migração** e **6×4 no catálogo**, e
> **isso não é contradição**: o layout salvo de quem já tem o bloco não muda; quem
> arrastar um novo recebe o tamanho em que ele se lê.
>
> ### 🔴 OS `padrão` DA TABELA ACIMA SÃO ESTIMATIVA — substituídos conforme a regra
>
> Decisão do dono, 12/08/2026. O valor de cada `padrão` passa a ser
> **`ceil(altura realmente renderizada do bloco hoje, no layout padrão a 12
> colunas)`**, em células de `80 + 16`.
>
> ⚠️ **E essa medição só existe ANTES da F1.** Ela depende da grade estar em
> `grid-auto-rows: auto`, que é justamente o que a F1 remove. Colher o número
> depois é impossível — ele tem de ser dado de ENTRADA da migração, não saída.

Os quatro estruturais (Alertas, Receita × Gasto, Vendas por país, Rodapé) continuam **não removíveis** — e entram na grade com alça, como todos os outros.

---

## 4. Decisão 2 — escala do conteúdo por container query

Faixas, iguais para todos os blocos:

```
largura:  xs < 300 · sm 300–459 · md 460–679 · lg 680–959 · xl ≥ 960
altura:   baixo < 180 · médio 180–320 · alto > 320
```

O que muda, por família:

**KPI** — número: 22 / 28 / 34 / 40 / 48px por faixa de largura. Sparkline aparece a partir de `sm` e ocupa `ch − linha do número − rodapé`. Pílula de variação a partir de `md`. Linha de base declarada (`DadosKpi.base`) a partir de `lg`.

**Série temporal** — ticks em x = `floor(cw / 110)`, mínimo 2, com rótulo curto (`dd/MM`) até `md` e completo em `xl`. Ticks em y = `floor(ch / 56)`, mínimo 2 quando `ch ≥ 160`. Legenda em linha a partir de `md`.

**Barras** — largura da barra = `clamp(4, (cw − eixo) / n − 6, 28)`. Isto resolve C8. Linha de zero sempre desenhada quando há valor negativo (C3).

**Tabela** — linhas visíveis = `floor((ch − cabeçalho − rodapé) / 44)`; o excedente vira `+N` no rodapé, não rolagem interna. Colunas secundárias somem em `sm`. Barra de fundo ancorada em `max(valores da lista)` (C4).

**Medidor radial / rosca** — diâmetro = `min((cw − gaps) / n, ch − rótulo)`. Em `sm` e abaixo, os três medidores viram três barras horizontais com o denominador ao lado (C5).

**Funil** — altura da fita = `ch − faixa de cobertura − linha de rótulos`. Pílulas compactas abaixo de `md`.

**Regra de vazio:** nenhuma região vazia contígua maior que **32px** entre o conteúdo e a borda interna do card, em nenhuma combinação de faixa. Vira asserção (§7.2). É o que mata C6.

---

## 5. Decisão 3 — responsividade de viewport

Um layout salvo, quatro derivações determinísticas:

```
≥ 1280px → 12 colunas   (o layout salvo, sem transformação)
960–1279 →  8 colunas
640–959  →  4 colunas
< 640    →  1 coluna
```

Derivação:

```ts
const w2 = clamp(Math.ceil(w * C / 12), Math.min(wMin, C), C)
```

`h` é preservado; a container query cuida da densidade. A ordem vem da leitura em Z do layout de 12 (`row` asc, depois `col` asc). **Não** se salvam quatro layouts — só o de 12.

---

## 6. Decisão 4 — manipulação direta

- arrastar **pelo cabeçalho** move; o corpo do card continua interativo
- alça no canto inferior direito redimensiona nos dois eixos; alças nas bordas direita e inferior, um eixo cada
- encaixe por célula, com contorno tracejado marcando o slot de destino
- ao soltar: compactação **vertical para cima**; sem `auto-flow: dense`
- ao encolher um bloco, a linha reflui e o aviso "N colunas livres" continua no fim da linha
- teclado: setas movem, `Shift`+setas redimensionam, com o slot anunciado por `aria-live`
- chips do painel lateral com largura mínima de 140px e título completo (C7)

---

## 7. Critérios de aceite (asserções)

1. `alturaDoCard(id)` é idêntica antes e depois de alternar Ranking ↔ Globo em "Vendas por país"
2. para cada bloco × 5 faixas de largura × 3 de altura: nenhuma região vazia contígua > 32px
3. para cada bloco renderizado em `wMin × hMin`: `scrollWidth ≤ clientWidth` e `scrollHeight ≤ clientHeight`
4. `derivar(salvo, 12) === salvo` (a derivação é identidade em 12 colunas)
5. para cada `C ∈ {8,4,1}`: nenhum bloco derivado tem `w > C`, e a ordem de leitura é preservada
6. depois de soltar um bloco não existe célula vazia acima de bloco ocupado na mesma coluna
7. todo bloco do catálogo tem `wMin ≤ 4` — ou está declarado como largo, com variante compacta registrada
8. nenhum arquivo em `tk/blocos/` contém `min-height:` em px, nem `height=` numérico em `<svg>`
9. série com buraco: observação isolada renderiza `<circle>`, nunca `<path>` de menos de 12px (C1)
10. barra de fundo de tabela: `width` do maior valor da lista = 100%, e nenhum `rect` excede o `clientWidth` da coluna (C4)

Asserção 2 é a mais cara e a que mais paga. Medida por bounding box do conteúdo contra o retângulo interno do card, não por inspeção visual.

---

## 8. Conteúdo que falta (depois da geometria)

- **comparação com período anterior**: quatro cards dizem hoje "sem período anterior para comparar". Medir primeiro se é falta de dado no servidor ou chamada que nunca é feita — a resposta muda o tamanho do trabalho
- **catálogo pequeno**: 3 painéis disponíveis para 11 posições. Os 7 blocos do `blocks.ts` antigo que a reescrita não recriou voltam por aqui, com o dado de cada um conferido antes de ser oferecido
- **"Fontes de tráfego" e "Canais"** viram um bloco só
> ⚠️ **"Bloco sem dado colapsa" SAIU desta lista** e virou **F0**, precondição da
> F1 — ver §9. Sem ele, a F1 restaura o defeito de 07/08 descrito na §2.

---

## 9. Ordem de execução

| fase | o quê | destrava |
|---|---|---|
| **F0b** | **MEDIR** a altura renderizada de cada bloco no layout padrão a 12 colunas | a migração e a tabela da §3. ⚠️ **só é possível com a grade ainda em `auto`** |
| **F0** | **bloco sem dado COLAPSA para `h = 1` fixo** | 🔴 **precondição da F1** — sem isto ela restaura o defeito de 07/08 |
| F1 | grade de células: `--tk-row`, `span w/h`, `min-width/min-height: 0`, altura fora do conteúdo | queixas 2, 4, 5 |
| F2 | mínimos no catálogo + derivação por viewport | queixa 1 (parcial) e responsividade |
| F3 | container queries por família, na ordem KPI → série → tabela → medidor → funil → mapa | queixa 3 |
| F4 | acabamento dos gráficos: C1–C8 | queixa 6 |
| F5 | fim das zonas: um catálogo só, sem teto | queixa 1 |
| F6 | asserções §7 e varredura de vazio | — |

> ### ⛔ F0 NÃO DEPENDE DE F0b — são grandezas diferentes
>
> Decisão do dono, 12/08/2026. `hMin` é **limite de arrasto de bloco COM dado**;
> a altura do estado vazio é outra coisa. Amarrar as duas faria a F0 esperar uma
> medição que ela não usa.
>
> **Bloco sem dado colapsa para `h = 1`, fixo** — medido pelo que o estado vazio
> precisa: **título e uma linha**. Nada mais.
>
> ⚠️ Por isso `hMin` **saiu da F0 e foi para a F2**, que é onde ele é usado pela
> primeira vez (limite de arrasto).
>
> ### 🔴 O COLAPSO É OVERRIDE DE RENDERIZAÇÃO, NUNCA ESCRITA
>
> O `h` salvo **permanece intacto** enquanto o bloco está vazio. A grade desenha
> 1 linha; o layout continua guardando o que o usuário escolheu.
>
> **Asserção:** com o bloco colapsado, recarregar a página e conferir que o `h`
> salvo continua o ORIGINAL.
>
> ⛔ Sem isso, **um período sem dado reescreve o layout do usuário em silêncio** —
> e quando o dado volta, o bloco não recupera o tamanho que ele tinha escolhido.
> É a distinção central deste projeto (ausência de observação ≠ observação de
> zero) na camada de persistência de layout.

F1 sem F3 piora a tela: os blocos passam a ter slot e o conteúdo ainda não sabe preenchê-lo. As duas fases andam juntas ou a verificação intermediária é feita com um bloco só.

## 🔎 O INVENTÁRIO — medido em 12/08/2026, e ele MUDOU a ordem

A F4 era esperada como pré-requisito da F1. **Não é.** Contagem por padrão:

| Padrão | Pontos | Onde concentra |
|---|---|---|
| `min-height` em px | **17** | `LineChart` 3 · `FitaFunil` 2 · `DonutChart` 2 · `Card` 2 · 5 arquivos com 1 · 3 fora do Dashboard |
| `<svg height>` numérico | 7, **e 6 são ÍCONE** | sobram `DonutChart`, `MedidorRadial`, `LineChart` (num `<rect>`) |
| wrapper com altura implícita | 4 | `DonutChart:123` e `MedidorRadial:138` (`aspectRatio` sobre largura), `Heatmap:175`, `TabelaAds:597` |

### 🔑 Seis dos oito gráficos JÁ são `height: 100%`

| Gráfico | Altura hoje |
|---|---|
| `Heatmap` · `Sparkline` | `100%` — **pronto** |
| `LineChart` · `FitaFunil` | `100%` **+ `min-height` em px** — o piso é o que atrapalha |
| `SerieTemporal` | `100%` + `cqh` — **já usa container query de altura** |
| `GlobeView` · `CountryPanel` | `altura` por **prop** — já vem do layout |
| `DonutChart` · `MedidorRadial` | 🔴 `aspectRatio` sobre largura — **os dois únicos que ignoram a altura do slot** |

Uma única constante de altura cravada em toda a base: `ALTURA_PILULA = 22`
(`FitaFunil`), e ela é de pílula, não de gráfico.

> ## Conclusão: **F1 e F4 andam SEPARADAS.**
>
> A F1 é ~12 pontos de REMOÇÃO de `min-height` + 2 componentes que precisam
> parar de derivar altura da largura. Os seis gráficos `100%` passam a funcionar
> de graça, porque finalmente terão pai com altura definida.
>
> Dos oito defeitos C1–C8, só o **C5** depende do modelo de altura — e é o mesmo
> `aspectRatio` dos dois componentes acima. Os outros sete são acabamento
> independente.

⚠️ **O que o inventário NÃO cobre:** ele conta pontos por padrão sintático. Um
bloco cuja altura é decidida por composição (flex que cresce, texto que quebra)
não aparece — e é justamente esse que a asserção §7.3 pega depois da migração.

---

## 10. Prompt para a F1

> Leia `docs/design/07-GRADE-E-BLOCOS.md`, seções 2, 3 e 9.
>
> Implemente a F1 e **só** a F1: trocar o modelo de altura do modo de edição do Dashboard.
>
> Hoje a altura do card vem do conteúdo. Passa a vir do layout: a grade tem `grid-auto-rows: var(--tk-row)` com `--tk-row: 80px`, cada bloco declara `w` e `h` em células, e o card ocupa exatamente `h` linhas.
>
> Antes de escrever código, me diga **onde** a altura é decidida hoje — arquivo e linha de cada ponto que estabelece altura de card ou de conteúdo de card (incluindo `min-height`, `height` de SVG e wrapper de gráfico com `auto`). Quero a lista antes do diff, porque ela é a medida do trabalho e eu quero conferir se está completa.
>
> Regras:
> - `min-width: 0; min-height: 0` no slot — os dois, senão o conteúdo empurra a célula e nada disto funciona
> - 🔴 **`h` entra no envelope, e a MIGRAÇÃO NÃO LÊ O CAMPO GRAVADO.** O campo
>   `linhas` **já existe** em `actions/dashboardLayout.ts:95`, opcional — mas hoje
>   ele é **PISO**, não altura. Depois da F1 vira altura EXATA, e quem passou do
>   piso seria **cortado em silêncio**. Há testadores com layout salvo em
>   produção. A migração mede:
>
>   ```
>   h = max( ceil((linhas * 44 + 16) / 96),
>            ceil((altura renderizada  + 16) / 96) )
>   ```
>
>   🔴 **A CONVERSÃO É A PARTE QUE IMPORTA, e a razão mais que a fórmula.**
>   `linhas` está em unidade de **44px** (`catalogo.ts:61`, `ALTURA_LINHA`); a
>   grade nova é de **96px** (80 + 16). Comparar os dois números crus **dobra a
>   altura**: `linhas: 8` significa 352px hoje, e 8 células significariam 752px.
>
>   ⚠️ Sem a razão escrita, a próxima mudança de `ALTURA_LINHA` repete o erro —
>   a fórmula continuaria "certa" e o resultado, errado.
>
> - 🔴 **LEIA `linhas` DO ENVELOPE PERSISTIDO, NUNCA DO `minHeight` RENDERIZADO.**
>   `celulaDaGrade` (linha 133) só aplica `minHeight` **com dado**, então um bloco
>   sem dado no período aparece como "sem valor" tendo valor gravado.
>
>   Medido em 12/08/2026, no layout de dev: **4 blocos** pela leitura renderizada
>   × **10 blocos** pelo envelope. A migração pela tela teria perdido a altura
>   escolhida em **6 de 10** — incluindo `receita-gasto` e `paises`.
>
> - **MEÇA EM 1280 E EM 2260, e tome o `max` por bloco.** Para quase todos, 1280
>   é o piso (a largura mais estreita em que o layout de 12 colunas existe). Mas
>   `DonutChart` e `MedidorRadial` derivam altura da LARGURA, então a
>   monotonicidade **se inverte neles**: são mais altos no monitor grande.
>
>   Medido: só **dois** blocos mudam — `alertas` 346→262 (mais alto no estreito) e
>   `heatmap` 352→375 (mais alto no largo, a inversão). Slot pequeno demais corta
>   em silêncio; grande demais deixa vazio, e vazio é o que a F3 remove.
>
>   ⚠️ E a medição só existe ANTES da F1 — ela depende de a grade estar em
>   `grid-auto-rows: auto`. É dado de ENTRADA (F0b), não saída.
>
> - 🔴 **A TABELA DE `padrão` E `hMin` DA §3 É SUBSTITUÍDA PELA SAÍDA DA F0b.**
>   Os valores que estão lá são estimativa do dono e não devem ser usados como
>   entrada de nada. A F0b devolve, por bloco: altura em px, `ceil` em células,
>   `linhas` gravado hoje, e o `max` dos dois — e é esse `max` que vira o
>   `padrão`.
> - a alça passa a redimensionar nos dois eixos; os mínimos da tabela da §3 entram no catálogo agora, mesmo que só o `hMin` seja usado nesta fase
> - não mexa em nenhum conteúdo de bloco nesta fase — a F3 faz isso
>
> Verificação, nesta ordem: `alturaDoCard("vendas-por-pais")` idêntica em Ranking e em Globo (asserção §7.1); nenhum bloco com `scrollHeight > clientHeight` no `h` migrado (§7.3); e o print da tela com os dois estados lado a lado. Não me diga "está pronto" — me mostre a tela.
>
> ⛔ **E a F1 não fecha sozinha.** Ela fecha com **a lista dos blocos que passam
> do slot depois da migração** — essa lista é o escopo da F3, e sem ela a F1
> entregou slot sem entregar conteúdo que caiba.
---

## 11. F0b — a medição, executada em 12/08/2026

Grade em `grid-auto-rows: auto`, 12 colunas, gap 16, densidade padrão.
`linhas` lido do **envelope persistido** (`DashboardLayout.layout.paineis[].linhas`).

`células(px) = ceil((px + 16) / 96)` · `células(linhas) = ceil((linhas × 44 + 16) / 96)`

| bloco | span | `linhas` | → células | h@1280 | h@2260 | → células | **h migrado** |
|---|---|---|---|---|---|---|---|
| `funil` | 6 | 5 | 3 | 382 | 382 | 5 | **5** |
| `heatmap` | 6 | 8 | 4 | 352 | **375** | 5 | **5** |
| `atividade` | 4 | 8 | 4 | 256 | 256 | 3 | **4** |
| `paises` | 6 | 8 | 4 | 256 | 256 | 3 | **4** |
| `alertas` | 4 | 4 | 2 | **346** | 262 | 4 | **4** |
| `top-campanhas` | 4 | 4 | 2 | 321 | 321 | 4 | **4** |
| `aprovacao` | 6 | — | — | 256 | 256 | 3 | **3** |
| `posicionamento` | 4 | — | — | 256 | 256 | 3 | **3** |
| `lucro-por-hora` | 4 | 4 | 2 | 256 | 256 | 3 | **3** |
| `vendas-por-dia` | 4 | 4 | 2 | 238 | 238 | 3 | **3** |
| `vendas-por-hora` | 4 | 4 | 2 | 238 | 238 | 3 | **3** |
| `receita-gasto` | 8 | 5 | 3 | 238 | 238 | 3 | **3** |
| `fontes` | 4 | — | — | 238 | 238 | 3 | **3** |
| `produtos` | 4 | — | — | 238 | 238 | 3 | **3** |
| `pagamentos` | 4 | — | — | 238 | 238 | 3 | **3** |
| `rodape` | 12 | — | — | 192 | 192 | 3 | **3** |

**10 de 16** têm `linhas` gravado. Em **4 deles o `linhas` vence** a medição
(`atividade`, `paises`, e o empate de `alertas`/`top-campanhas`) — são as
alturas que o usuário escolheu e que a leitura pela tela teria perdido.

### ⚠️ O que esta medição NÃO é

- **Não é o padrão do catálogo** para conteúdo elástico — ver a regra da §3.
  `receita-gasto` mede 3 e o catálogo decide 6×4.
- **Não é responsividade.** Só `alertas` e `heatmap` mudam entre 1280 e 2260;
  os outros 14 têm altura dominada por conteúdo que não reflui nessa faixa.
  Isso é sintoma da queixa 3, não prova de que está bom.
- **Não vale para outra densidade.** O gap é 16 no padrão e 20/24 nas outras
  (`globals.css:1310-1330`). A conversão assume 16.

### 🔴 `rodape` mede 192 e cabe em 3 células — mas a §3 pede `12×1`

`h = 1` são **80px**. O rodapé de estado mede **192**. Ou seja: **o `hMin: 1` da
§3 corta esse bloco em silêncio**, e ele é estrutural.

⛔ Isto é entrada para a F2, não defeito da medição: ou o `hMin` dele sobe para
3, ou o conteúdo do rodapé encolhe na F3. **A F1 não pode migrá-lo para 1.**
