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

> ### ✅ AS SEIS ESTÃO ZERADAS — 13/08/2026, com a F4 fechada
>
> | # | queixa | quem fechou | conferido |
> |---|---|---|---|
> | 1 | 11 métricas para 8 vagas | **F5** — um catálogo só, sem teto (31 blocos) | 12 métricas na tela, nenhuma vaga reservada |
> | 2 | não dá para diminuir bloco | **F1** — `w × h` em células, alça nos dois eixos | slot de 176px medido, alça em 12 colunas |
> | 3 | conteúdo reposiciona, não escala | **F3** + **F2** | 0 vazamentos a 1280 e 2260; deriva 12→8→4→1 |
> | 4 | Vendas por país muda ao alternar | **F1** — a altura é do slot, não do conteúdo | §7.1 |
> | 5 | vazio dentro do card e buraco entre eles | **F3** + **C6** | vão com `+N` = 0; vão sem `+N` é altura escolhida |
> | 6 | os gráficos parecem amadores | **F4** (C1–C8) | eixo Y nos quatro gráficos, rótulos inteiros, número que não trunca |
>
> ⚠️ **O que NÃO está fechado:** a §7.2 (varredura de vazio em 5×3 faixas) e a
> §7.6 continuam na **F6**. E o shell em viewport estreito é frente própria.

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

> ### 🔴🔴 ESTA LISTA É INFERÊNCIA LIDA DE SCREENSHOT — E 4 DOS 8 NÃO REPRODUZEM
>
> **Medido bloco a bloco em 13/08/2026, na tela, antes de consertar qualquer um.**
> A coluna *"o que está errado"* abaixo foi escrita em 12/08 olhando prints, sem
> medir o componente. O resultado:
>
> | | |
> |---|---|
> | descreviam conserto **que já existia** | C1 (desde `db98cf2`, 06/08) |
> | **RISCADOS** — consertados por outra fase, com o commit citado | C4 · C8 |
> | **parcialmente** certos | C3 (o eixo Y faltava; a linha de zero EXISTIA) · C7 |
> | certos, com o NÚMERO errado | C6 (121px, não "180–400") |
>
> ⛔ **Nenhuma prescrição desta lista entra em código sem reprodução na tela
> antes.** Foi por isso que o C1 quase virou um conserto do que já estava
> consertado — a segunda vez nesta fase que uma prescrição descreveu o passado.
>
> ### 🔴🔴 E EU RISQUEI O C2 ERRADO — a lição é sobre o INSTRUMENTO, não sobre a lista
>
> Na primeira passada eu dei o C2 como *"não reproduz"* e quase o apaguei. **Ele
> era real.** A medição tinha pegado o `LineChart` (o `receita-gasto`), que usa
> `dd/MM` e reduz ticks corretamente — e o C2 vive no `SerieTemporal`, cujos
> rótulos `07-15`/`08-04` são **literalmente** o `07-1`/`08-` que a lista
> descreve.
>
> ⚠️ **Riscar é tão perigoso quanto acumular.** A lista que só cresce vira a
> família das 17 linhas; a lista riscada por medição do elemento errado APAGA um
> defeito real e o deixa em produção com atestado de saúde. As duas falham pela
> mesma porta: **medir sem confirmar QUAL elemento se mediu.**
>
> 🔎 O sinal barato, e ele custa uma linha: antes de concluir, imprima o que a
> medição pegou — largura, classe, texto. Foi `larguraCard: 1432` num bloco que
> mede 369 que deveria ter me parado, e não parou.

| # | onde | o que estava escrito | 🔬 medido em 13/08 |
|---|---|---|---|
| C1 | card ROAS | série vira fragmentos órfãos de ~8px; isolado deve virar ponto | 🔴 **prescrição errada.** O `<circle>` existe desde `db98cf2` (06/08) e a série do ROAS tem **zero buracos**. O defeito real era outro — sparkline a 0,1px pintando um sublinhado. ✅ **corrigido** |
| C2 | Vendas por dia | eixo x cortado (`07-1`, `08-`); não reduz densidade de ticks | ✅ **REAL, e corrigido** (`36bccdc`). ⚠️ Eu o dei como "não reproduz" medindo o `LineChart`; ele vive no `SerieTemporal`. A causa não era densidade: o rótulo mora numa célula de `1/n` com `overflow: hidden`, e 36px não cabem em 7px por menos rótulos que se desenhe |
| C3 | Lucro por horário | sem eixo Y, sem rótulo de valor, **sem linha de zero** | ✅ **corrigido** (`36bccdc`) — mas só a **metade certa**: a linha de zero já EXISTIA. O que faltava era o eixo Y, e ele veio unificado com o `LineChart` em `lib/grafico/eixo.ts` |
| ~~C4~~ | ~~Posicionamento e Formas de pagamento~~ | ~~barra não ancorada no maior valor~~ | 🗑️ **RISCADO.** Consertado em **`1d8be69`** (23/07), que é onde `barWidth` passou a ser `total / prodMax`. Medido em 13/08 para confirmar: maior barra = **exatamente 100%**, **0** fora do pai e **0** fora do card |
| ~~C5~~ | ~~Taxa de aprovação~~ | ~~medidores em tamanho fixo, 400px~~ | 🗑️ **RISCADO.** Consertado pela **F3** (`c0f5254`) |
| C6 | Produtos, Vendas por país, Alertas | **180–400px** de vazio contínuo | ✅ **corrigido no que era defeito.** Medido: `produtos` 121 · `alertas` 81 · `top-campanhas` 56 — e **nenhum deles esconde nada**. Só `atividade` tinha `+32`, e o rodapé dele agora ancora no fim: vão **0** |
| C7 | modo de edição | títulos de chip truncados por largura fixa | ✅ **corrigido**, e o achado maior foi ao lado: o **número** do KPI era truncado em 34px. Hoje ele encolhe até caber, com piso, e a moldura devolveu 37px ao slot |
| ~~C8~~ | ~~Vendas por horário~~ | ~~largura fixa: 24 buckets viram fios~~ | 🗑️ **RISCADO.** Consertado pela **F3** (`c0f5254`), que removeu `--tk-b-barras`. Medido em 13/08: a barra é sempre **50% do passo** — 35,8 / 21,6 / 13,6 / 9,1 / 6,6px conforme o card vai de 900 a 200 |

> ### 🔴 O ACHADO QUE NÃO ESTAVA NA LISTA: no MODO DE EDIÇÃO o NÚMERO é truncado
>
> Medido junto do C7: na moldura de edição os cards de KPI ficam com **132px**, e
> `R$ 7.058,65` sai cortado — `scrollWidth` excede `clientWidth` em **34px**;
> `R$ -2.441,54` em **49px**.
>
> ⛔ **Isto viola a ordem de sacrifício** que o dono fixou em 13/08 (número →
> rótulo → variação → sparkline → base): o número é o que NUNCA pode ser cortado,
> e é justamente ele que está sendo. O `06` já registra a mesma família — *"o que
> encolhe primeiro tem de ser o APOIO, nunca a resposta"* — e ali ela foi
> resolvida para o rótulo, não para o número.
>
> 🔜 **Não consertado nesta sessão.** É trabalho do C7, e entra com o chip.

⚠️ **O que a lista acertou como diagnóstico geral continua valendo:** o que
sobrou (C3, C6, C7) é sempre *"o desenho não sabe o tamanho que tem"*. O que ela
errou foi supor que os oito ainda estavam lá — **a F1, a F3 e a F5 consertaram
quatro deles de passagem, e ninguém voltou para riscar a lista.**

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

> ### 🔴 A §7.3 NÃO É ASSERÇÃO DO `npm test` — jsdom não tem motor de layout
>
> **Registrado em 12/08/2026, ao fechar a F3.** A §7.3 pergunta
> `scrollHeight ≤ clientHeight`, que é uma pergunta de LAYOUT. O `jsdom` — o que
> roda em `renderToStaticMarkup` e em toda suíte desta base — **não calcula
> posição nem tamanho**: ele devolve `0` para as duas medidas, e `0 ≤ 0` passa.
>
> ⛔ **Teste verde de vazamento em jsdom não é evidência de nada.** É a forma
> mais convincente da *asserção que não pode falhar*, porque o número que ela
> imprime tem cara de medição — os dois desfechos possíveis produzem o mesmo
> valor observado, que é exatamente o que esta base define como asserção que não
> mede.
>
> A §7.3 é, portanto, um **procedimento de navegador**: `scripts/vazamento-na-tela.js`,
> colado no console com o Dashboard aberto e um período COM DADO.
>
> ```js
> await naTela(1280)
> await naTela(2260)
> ```
>
> ⚠️ Ele encolhe o **contêiner**, não a janela — o `resize_window` do MCP mentiu
> cinco vezes até aqui. E o `teste-grade.mjs` diz isto no lugar em que a asserção
> caberia, para o verde de lá não ser lido como "não há vazamento".
>
> ⚠️ **Período vazio não exercita nada**: bloco sem dado colapsa (condição F0), e
> um vazamento medido sobre o estado vazio é medição do estado errado.

---

## 7b. Dívidas registradas aqui para não voltarem a interromper a fase

Três linhas, escritas em 12/08/2026 por ordem do dono. **Não são F1** e não
devem ser mencionadas de novo até a fase fechar.

- **`loadDashboardPrefs`** roda no `Promise.all` do `(app)/layout.tsx` em todo
  pageview e alimenta `order`/`visible` do `useTraffikState`; `saveDashboardPrefs`
  tem **zero chamadores** — a preferência é lida e o usuário não tem como
  escrevê-la. Medir os dois lados antes de decidir: é o mesmo par leitor/escritor
  do `Sale.apiCredentialId`.
- **O move do `listRules`** — ele volta ao layout em todo pageview para um único
  consumidor (o rodapé de estado do Dashboard). O lugar dele é onde é consumido,
  não no caminho crítico de todas as 22 rotas.
- **Os três registros do `CLAUDE.md`** desta fase (F0b como dado de ENTRADA, F0
  como condição de renderização por bloco, e o limiar fixado antes de medir)
  vivem só neste documento; só o terceiro chegou ao `CLAUDE.md`. Consolidar
  quando a F1 fechar.

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
| ~~F0~~ | **deixou de ser fase — virou CONDIÇÃO de renderização.** Ver abaixo | — |
| F1 | ✅ grade de células: `--tk-row`, `span w/h`, `min-width/min-height: 0`, altura fora do conteúdo | queixas 2, 4, 5 |
| F2 | ✅ mínimos no catálogo + derivação por viewport | queixa 1 (parcial) e responsividade |
| F3 | ✅ container queries por família, na ordem KPI → série → tabela → medidor → funil → mapa | queixa 3 |
| F4 | acabamento dos gráficos: C1–C8 | queixa 6 |
| F5 | ✅ fim das zonas: um catálogo só, sem teto | queixa 1 |
| F6 | asserções §7 e varredura de vazio | — |

> ### ⚠️ A F5 RODOU ANTES DA F4, e a ordem da tabela deixou de descrever o que
> ### aconteceu — ela ficou porque descreve o que DESTRAVA o quê
>
> A execução real foi **F0b → F1 → F3 → F5 → F2**. A F5 não dependia da F4 (o
> acabamento dos gráficos é independente do modelo de layout, como o inventário
> já tinha medido), e a F2 veio depois dela porque derivar uma grade com três
> zonas exigiria derivar três vezes.
>
> ⛔ Sobra a **F4** (C1–C8, menos o C5 que a F3 já resolveu) e a **F6**.

> ### ⛔ F0 NÃO É FASE — é condição, e o colapso é POR BLOCO
>
> Decisão do dono, 12/08/2026, depois de a medição reprovar dois limiares fixos
> (`h = 1` dele, `2 células` meu):
>
> ```
> hVazio = min( h salvo , ceil((altura do estado vazio DAQUELE bloco + 16) / 96) )
> ```
>
> **Nenhum número fixo.** `funil` dá `min(5, 5) = 5` e **não colapsa** — e está
> correto: o defeito ali é o CONTEÚDO do vazio dele, que entra na fila da F3
> como item nomeado.
>
> ⚠️ **E o escopo dela é menor do que parecia.** Com a guarda `temDado`, bloco
> sem dado **nunca ganha `h`** e continua em `auto`, igual a hoje. A F0 só atende
> o bloco que **ganhou `h` com dado e depois ficou sem** — um período vazio
> depois de já ter sido medido.
>
> ### ⛔ A F3 do `EmptyState` vem DEPOIS da F1, não antes
>
> A versão compacta do estado vazio só pode ser calibrada **contra um slot**, e
> slot não existe até a grade existir. Encolher o vazio agora seria mirar um
> alvo que ainda não tem tamanho.
>
> ### 📉 O `minHeight: 120` do `EmptyState` NÃO era vinculante
>
> Medido em 12/08: removê-lo dos 11 elementos **não mudou nenhuma altura**. O
> conteúdo do vazio já passa dele. A afirmação anterior deste documento — de que
> os 238/256 vinham dessa constante — **estava errada**, e o erro foi de método:
> constante encontrada na cadeia, tomada como vinculante sem testar qual mínimo
> estava ativo.
>
> Decisão do dono, 12/08/2026. `hMin` é **limite de arrasto de bloco COM dado**;
> a altura do estado vazio é outra coisa. Amarrar as duas faria a F0 esperar uma
> medição que ela não usa.
>
> ⚠️ Por isso `hMin` **saiu da F0 e foi para a F2**, que é onde ele é usado pela
> primeira vez (limite de arrasto).
>
> ⛔ **Havia aqui um "bloco sem dado colapsa para `h = 1`, fixo".** Ele era o
> terceiro limiar reprovado pela medição (ver a seção do `CLAUDE.md`) e foi
> APAGADO, não anotado ao lado: número fixo escrito em ⛔ é exatamente o que faz
> a próxima pessoa reverter o `min()` acima achando que está consertando.
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

## ✅ F3 — executada em 12/08/2026, e a tabela de vazamento está ZERADA

Sete blocos, na ordem do estouro medido. `npm run test:grade` verde (30),
`npm test` sai 0, e a medição de tela (`naTela`) dá **0 estouros nos dois eixos**
a 1280 e a 2260, com 16 blocos examinados e `rolagemDaPagina: 0`.

| bloco | antes (2260 / 1280) | a causa |
|---|---|---|
| `receita-gasto` | **+186 / +126** | `--tk-b-plot`: a altura da plotagem vinha de `cqw`. O `viewBox` passou a valer a caixa MEDIDA, e os ticks derivam de `cw`/`ch` |
| `produtos` | +49 / +25 | caiu junto — era a mesma cadeia de altura de linha |
| `atividade` | +36 / +36 | `limite = 12` fixo → `floor(ch / altura da linha)`, com `+N` no rodapé |
| `aprovacao` | — / +89 | o diâmetro do medidor não conhecia `n`: quatro arcos não cabiam e o `flex-wrap` dobrava a altura |
| `fontes` | — / +80 | `minHeight: 132` na rosca, com a legenda descendo por baixo dela |
| `alertas` | — / +24 | `limite = 3` fixo, com título quebrando em duas linhas |
| `vendas-por-dia` · `vendas-por-hora` · `lucro-por-hora` | +9 cada / — | `--tk-b-barras`: a altura das barras vinha de `cqw` |

### 🔴 O PADRÃO ÚNICO POR TRÁS DE 5 DOS 7: altura decidida pela LARGURA

`--tk-b-plot`, `--tk-b-barras`, `--tk-b-donut` e `--tk-b-radial` são todos
`clamp`/degrau sobre `cqw`. Enquanto a altura vinha do conteúdo, isso funcionava
— o card cedia. Com o slot mandando (F1), **um monitor mais largo passou a pedir
mais altura**, que é a inversão de monotonicidade que a F0b já tinha medido no
`heatmap` e que ninguém tinha generalizado.

⛔ **`--tk-b-plot` e `--tk-b-barras` foram REMOVIDOS do `globals.css`.** Os dois de
geometria (`donut`, `radial`) viraram conta em JS, porque a fórmula do §4 precisa
de `n` — e `n` é um número que CSS não conhece.

> ### ⛔ A PERGUNTA QUE FICA, antes de criar qualquer token `--tk-b-*`
> **"Este token decide ALTURA a partir de `cqw`?"** Se decide, ele é a família
> inteira desta fase. Altura sai de `cqh` ou de medição; largura sai de `cqw`.

### ⚠️ Dois falsos positivos, e os dois ensinaram sobre o INSTRUMENTO

1. O `<rect>` invisível de captura do `LineChart` passava 12px do eixo. Clipado
   pelo `viewBox`, invisível — e contado como fuga. Grampeado.
2. A varredura horizontal por `getBoundingClientRect()` deu **13 fugas no Funil**
   que o print desmentia: o retângulo de um elemento clipado por um ancestral
   reporta a geometria NÃO clipada. O instrumento virou
   `scrollWidth − clientWidth`, que respeita o clip como o `scrollHeight` já
   respeitava — os dois eixos passaram a medir a mesma coisa.

⚠️ O segundo é o caro: ele mediu "defeito" por duas leituras seguidas, então a
regra das duas leituras **não o teria pego**. O que o pegou foi o print
contradizendo o número.

## ✅ F5 — executada em 12/08/2026: as três zonas viraram uma grade

`hero` (sempre 4), `faixa` (até 8) e `paineis` eram **três estruturas separadas
com três regras**, e os dois tetos eram a queixa 1: onze métricas disputando oito
vagas. Nenhum dos dois números tinha razão de produto — eles existiam porque os
três grupos eram três componentes.

| | |
|---|---|
| catálogo | **31 blocos** — 16 painéis + 15 métricas, sem vaga reservada |
| `KpiHero` + `MetricStrip` | viraram **`BlocoMetrica`**; o segundo foi deletado |
| envelope | **v5**, com `blocos` numa lista só |
| padrões | KPI de destaque **3×2**, métrica comum **3×1**, painel mantém a F0b |
| `useArrasto` | uma carga, um destino — `zonaAceita` e o tipo `Zona` **apagados** |
| operações do hook | `moverBloco` · `inserirBloco` · `removerBloco` · `redimensionar`. Saíram `trocarHero`, `moverMetrica`, `inserirFaixa`, `removerFaixa`, `faixaCheia` |

### 🔑 A hierarquia NÃO morreu — ela mudou de dono

O argumento que sustentava os quatro heros continua inteiro: *doze números do
mesmo tamanho não respondem pergunta nenhuma*. O que decide o peso agora é a
**altura do slot** — o padrão dá 2 células aos quatro principais e 1 ao resto, e
uma container query de ALTURA (`.tk-kpi`, `max-height: 130px`) troca a leitura.

⛔ **Não há prop `variante`, e não deve haver.** Uma prop seria uma segunda
verdade sobre o mesmo retângulo, e divergiria do slot no primeiro arrasto.

### 🔴 A MIGRAÇÃO: "ninguém muda de lugar", e a única exceção declarada

A conversão zonas → grade tem **um ponto único** (`deZonasParaGrade`), por onde
passam v1, v2, v3 e v4 — duas rotas até a mesma grade divergiriam em silêncio.

A promessa é dura: *quem já tem layout salvo encontra os cards onde deixou*. O
que a garante é as fileiras de métrica **fecharem 12**:

| métricas | fileiras | larguras |
|---|---|---|
| 4 (o hero) | 1 | 3 3 3 3 |
| 8 (o teto da faixa) | 2 | 3 3 3 3 · 3 3 3 3 |
| 7 (a faixa padrão) | 2 | 3 3 3 3 · 4 4 4 |
| 1 | 1 | 12 — que é o que a faixa de um item já era |

⚠️ **A EXCEÇÃO DECLARADA é essa segunda linha**: a faixa de oito passa de UMA
fileira para DUAS, porque em 12 colunas não existe largura inteira que mantenha
oito lado a lado. Qualquer outro deslocamento é defeito — e é por isso que a
fileira precisa FECHAR: uma que deixasse sobra permitiria um painel estreito
SUBIR para o grupo de métricas, movendo um card sem que ninguém notasse.

⛔ **A altura vem da ZONA, não do catálogo.** Uma métrica de destaque que o
usuário tinha arrastado para o Resumo volta com `h = 1`, onde ela estava. O
catálogo decide o tamanho de quem NASCE agora; a migração mede o que já existia.

### 🕸️ A SEGUNDA REDE — `hero`/`faixa` atravessam o envelope v5

`{hero, faixa, paineis} → blocos` é **irreversível**, pelo mesmo motivo do
`linhas → h` da F1: da lista única não se recupera qual métrica era hero. A
altura diz isso no instante da conversão e deixa de dizer no primeiro arrasto — e
a conversão roda sozinha, em produção, sobre um arranjo que o usuário montou.

Então o v5 grava `hero` e `faixa` como legado. **Nada os lê para desenhar**, e há
asserção sobre as duas metades: que eles sobrevivem, e que não reinjetam métrica
na grade.

## ✅ F2 — executada em 12/08/2026: a derivação por viewport

`layout/derivar.ts`, puro. `derivar(salvo, 12) === salvo` (§7.4), e em 8/4/1
nenhum bloco passa da grade, a ordem é preservada e `h` também (§7.5).

> ### 🔴 O INSTRUMENTO É O VIEWPORT, E NÃO O CONTÊINER — contra o hábito da base
>
> Esta base prefere medir o contêiner, com razão. **Aqui é o contrário, e o
> motivo é o catálogo.** Os `colMin` foram calculados contra uma referência
> declarada: *"uma janela de 1440px com o rail aberto: coluna ≈ 82px"*. Nessa
> janela o contêiner mede ~1160px — que cairia na faixa de 8. A tela de
> referência do catálogo inteiro passaria a ser derivada, e todo `colMin` do
> arquivo estaria descrevendo uma largura que a grade não usa mais.
>
> ⚠️ Limiar e instrumento vêm em par. Trocar um sem o outro é o erro do
> `getBoundingClientRect` clipado: o número continua saindo, medindo outra coisa.

⛔ **A EDIÇÃO É SEMPRE 12 COLUNAS.** Ela opera sobre o layout SALVO; a derivação
é leitura. Numa grade derivada, a alça mediria contra 4 colunas e o
`redimensionar` gravaria "4" num campo que significa doze avos — o arranjo do
usuário corrompido pelo tamanho da janela dele. Há guarda sobre isso.

### 👁️ O que foi VISTO e o que foi MEDIDO

| | |
|---|---|
| 12 colunas | ✅ **visto** (modo de edição) |
| 8 colunas | ✅ **visto** — a janela do dev tem `innerWidth` 1132, e a tela derivou sozinha |
| ⛔ 4 e 1 coluna | **não vistos** — só as asserções puras. Exigiria janela mais estreita, e o `resize_window` mente |
| vazamento | ✅ **0 fugas em 55 células**, `rolagem: 0`, nos dois temas |
| contraste | ✅ **medido**: rótulo 6,49/6,58 · número 17,85/16,11 · legenda e base 4,97/5,20 |

### 🐛 Os quatro defeitos que só a tela mostrou

Nenhum deles aparece em `tsc`, `lint`, `build` ou nas 46 asserções da grade.

| | |
|---|---|
| 🔴 **a container query media a caixa ERRADA** | a célula é `container-type: size`, mas na edição a moldura come ~37px. Célula **176**, corpo **139**, e o KPI ficou com **99** pedindo **119** — o rótulo cortado inteiro (`altura 0`) em todos os cards. O corpo do `ItemEdicao` virou contêiner |
| **o rótulo encolhia a 4px** | numa coluna flex sob pressão todo filho cede, e quem cedia era o texto que diz QUAL métrica é. `flex: none` no rótulo, no número e na legenda — o que cede é o sparkline |
| **o sparkline era cortado** | ele encolhia a caixa e mantinha `height={38}`: a §7.8 acontecendo dentro do componente. Passou a `100%` |
| **a base da razão reprovava no contraste** | `opacity: 0.85` levava a **3,70:1** no claro e **4,15** no escuro. ⚠️ O `test:contraste` mede PARES DE TOKEN e nunca pegaria isto — a opacidade é aplicada no componente, em cima do par |

## Estado em 13/08/2026

> **Medido, não inferido.** Os três comandos do topo do `CLAUDE.md` foram
> rodados; o que segue é a saída deles, e não uma cópia do estado anterior.

### Fases

| fase | estado |
|---|---|
| **F0b** · **F1** · **F3** | ✅ verdes, e **em produção** |
| **F5** · **F2** | ✅ verdes, **só locais** |
| **F4** | ✅ **FECHADA em 13/08.** C1 C2 C3 C6 C7 corrigidos · C4 C5 C8 riscados, com o commit que os consertou |
| **F6** | ⛔ aberta |
| 🚧 **shell estreito** | frente PRÓPRIA, fora da F4 — ver a seção acima |

### Onde cada coisa está

| | Medido em **13/08/2026**, ao abrir a sessão da F4 |
|---|---|
| branch | `redesign/dashboard` |
| HEAD | **`f2b03e8`** — o commit de doc que criou esta seção |
| `origin/redesign/dashboard` | **`f107392`** — a branch está **2 commits à frente** (`0ff5e97`, `f2b03e8`) |
| `origin/main` | **`36b52a1`**, empurrada em **12/08/2026 23:27** — *"merge: F1 + F3"* |
| a branch × a `main` | **4 à frente e 1 ATRÁS** |

> ### ⚠️ ESTA TABELA NASCEU ERRADA EM TRÊS LINHAS — e o motivo vale mais que a correção
>
> A versão anterior dizia HEAD `0ff5e97`, **1** commit à frente do remoto e **3**
> à frente da `main`. Os três estavam errados **no instante em que foram
> commitados**: a seção foi escrita antes do `git commit` que a contém, então o
> commit que a grava já a desmente. Estado fotografado envelhece **antes de
> chegar ao disco**.
>
> ⛔ E o **"1 ATRÁS"** nunca esteve escrito: é o merge `36b52a1` da `main`, que a
> branch não tem. Contar só um lado de `A...B` transforma "divergiram" em
> "estou à frente" — e é a diferença entre um push e um push que perde trabalho.
>
> ### 🔎 A MEDIÇÃO, e ela custa 10 segundos
> ```bash
> git rev-list --left-right --count HEAD...origin/main   # os DOIS lados
> git rev-list --left-right --count HEAD...origin/redesign/dashboard
> ```
> ⛔ **Nunca leia os números acima como estado atual.** Rode as duas linhas.

🔴 **F1 e F3 estão no ar para os testadores** — a `main` as levou em 12/08 23:27,
e a produção segue a `main` (conferido: `curl` em `/login` devolve `tk-auth`).
**F5 e F2 não.** As doze telas do redesign veem hoje a grade de células com o
conteúdo cabendo no slot, e **ainda com as três zonas**.

⛔ **Não afirme o estado do remoto a partir deste arquivo.** Ele envelhece
sozinho — rode os três comandos.

### ✅ AS DERIVAÇÕES DE 4 E 1 COLUNA FORAM VISTAS — 13/08/2026, e o instrumento existe

**Esta seção dizia que elas nunca tinham sido vistas, e que o motivo era falta de
instrumento.** A segunda metade estava errada: o instrumento existe, é o CDP, e
ninguém tinha tentado.

| coluna | como foi verificada |
|---|---|
| 12 | ✅ **vista** — modo de edição |
| 8 | ✅ **vista** — a janela do dev tem `innerWidth` 1132 e a tela derivou sozinha |
| **4** | ✅ **VISTA a 900px** — 4 colunas, `grid-auto-rows: 80px`, 28 blocos |
| **1** | ✅ **VISTA a 600px** — 1 coluna, `rolagemDaPagina: 0` |

> ### 🔑 O INSTRUMENTO DE LARGURA — CDP, e ele funciona com a janela MAXIMIZADA
>
> ```
> emulate      viewport: "1440x1000x1"   ← ESTE. Sobrevive a reload. Preferir sempre.
> resize_page  width/height               ← perde a emulação em SILÊNCIO num reload,
>                                            e depois falha com "Restore window to
>                                            normal state before setting content size"
> ```
>
> Os dois são CDP e os dois fazem **override de métricas**, não redimensionam a
> janela: medido, `innerWidth` foi a **900** e a **1440** com `screen.availWidth`
> em **2560** o tempo todo.
>
> 🔴 **A INSTRUÇÃO DE DESMAXIMIZAR A JANELA FOI APAGADA DESTE PROJETO.** Ela
> nasceu de uma causa que nunca foi isolada (`a23844e`, 31/07, dizia só *"não
> pegam com a janela do Chrome…"*), endureceu por cópia até virar requisito, e
> custou **duas sessões** ao dono fazendo a parte dele corretamente. Estas
> medições são o contraexemplo: **a maximização nunca foi o problema — a
> ferramenta era outra.**
>
> ⛔ **Reconfira `innerWidth` depois de qualquer navegação**, com `emulate`
> também. Um print tirado depois de um reload pode ser um print de 2560, e isso
> quase creditou a esta fase um conserto que era só a janela ter voltado a ser
> larga.

### 🚧 FRENTE PRÓPRIA — o SHELL não responde a viewport estreito

> **Decisão do dono, 13/08/2026: isto NÃO é F4 e não entra na fase.** Fica
> registrado como frente separada, com o medido, para não voltar a ser descoberto.

A grade deriva certo; a moldura em volta dela, não.

| medido a 600px | |
|---|---|
| rail | **236px abertos** — 39% da tela, e a grade fica com **292px** |
| saudação | *"Boa tarde, [DEV]"* colide com a busca do header — o "B" fica atrás dela |
| subtítulo | quebra **uma palavra por linha** |
| fugas horizontais dentro da grade | **14** — ⚠️ das quais **3 são falso positivo**: são rótulos `sr-only` com `clientWidth: 1` |

⛔ **Isto não é F4 e não foi consertado.** É achado de SHELL, e o rail recolhível
já existe — falta ele recolher sozinho abaixo de um limiar, que é decisão do
dono. Registrado aqui para não voltar a ser descoberto.

### ✅ C1 — executado em 13/08/2026, e o defeito NÃO era o que estava escrito

**F4 — acabamento dos gráficos (C1–C8, menos o C5, que a F3 já resolveu).**
Falta **C2, C3, C4, C6, C7, C8**.

> ### 🔴 A PRESCRIÇÃO DO C1 DESCREVIA UM CONSERTO QUE JÁ EXISTIA HÁ SEIS DIAS
>
> Este bloco dizia: *"primeiro passo: no `Sparkline`, fazer observação isolada
> renderizar `<circle>` em vez de um `<path>`"*. Medido:
>
> ```bash
> git log -S "isolados" --format='%h %ad' --date=short -- src/components/tk/Sparkline.tsx | tail -1
> # db98cf2  2026-08-06
> ```
>
> O `<circle>` para trecho isolado entrou em **06/08**, e o C1 foi escrito em
> **12/08** — a prescrição nasceu descrevendo o passado. Ela veio da leitura de um
> print, não do componente.
>
> ⚠️ **E os "fragmentos soltos" não são reproduzíveis no dado de hoje:** medido
> na tela, a série do ROAS a 30 dias tem `trechos: 1, circulos: 0` — **não há
> buraco nenhum nela**. A hipótese não tinha como ser exercida.

### 🐛 O que estava REALMENTE na tela: o sparkline do ROAS pintando um SUBLINHADO

Medido a 1440px, no card de ROAS, com `Últimos 30 dias`:

| | ROAS | Faturamento (controle) |
|---|---|---|
| caixa de conteúdo do card | 126px | 126px |
| filhos rígidos + gaps | **121,9px** | 83,5px |
| sobra para o sparkline (`flex: 0 1 32px`) | **4,1px** | 42,5px |
| caixa pintada do SVG | **0,1px** | 32px |

O `.tk-spark` é o **único filho encolhível** — rótulo, número, legenda e base são
`flex: none`, e isso é deliberado (*"o que cede é o sparkline"*, F5). Ninguém
escreveu **até onde** ele pode ceder. O ROAS tem uma linha a mais (a base
`receita de todos os canais ÷ gasto da Meta`), ela quebra em **duas** linhas a
231px de card, e o sparkline vai a zero — onde o traço de 1,5px, que é
`non-scaling-stroke`, **continua sendo pintado**.

> ## Sparkline esmagado não fica pequeno. Ele vira uma RETA — e uma reta sob um número lê como sublinhado: decoração se passando por dado, que é o defeito que esta base recusou no arco do globo.

✅ **Provado pelo lado negativo, na tela:** escondendo o SVG, a linha sob "1,94x"
**some**. Ela era o sparkline.

⚠️ E o comentário do `Kpi.tsx:301` dizia que o ROAS *"pedia **5px** além do que
tinha"* — verdade quando a base ocupava UMA linha. O número descrevia uma
medição, não um contrato, e envelheceu sem que nada avisasse.

### 🔬 O limiar é 4px, e ele foi MEDIDO no próprio componente

Oscilação vertical pintada da linha, descontada a espessura do traço, na série
real de Faturamento — que usa a banda inteira do `viewBox`, ou seja o **melhor
caso possível**:

| caixa | 2px | 3px | **4px** | 8px | 32px |
|---|---|---|---|---|---|
| oscilação | 0,13 | 0,94 | **1,75** | 5,00 | 24,50 |
| ÷ espessura do traço | 0,1× | 0,6× | **1,2×** | 3,3× | 16,3× |

Abaixo de 4px a linha oscila **menos que a própria espessura** — está inteira
dentro do próprio traço, que é a definição mensurável de *"é uma reta"*. Como a
medição usou o melhor caso, série mais achatada vira reta antes: **4px é piso, não
estimativa.**

E a conta fecha com a geometria: `banda útil = (A − 2·PY)/A = 26/32`, e o piso é
o menor `h` em que a oscilação passa de **dois** traços →
`ceil(2 × 1,5 ÷ (26/32)) = 4`.

> ### ⛔ A GUARDA RECALCULA O LIMIAR, NUNCA O REPETE
> `test:grade` lê `A`, `PY` e `strokeWidth` do próprio `Sparkline.tsx` e exige que
> o número do CSS seja igual ao que a geometria produz. Mudar qualquer uma das
> três derruba a asserção e cobra a remedição.
>
> ✅ **Provado pelo lado negativo:** trocando o piso para 6px, a suíte falha
> dizendo *"o piso do CSS (6) divergiu da geometria do traço (4)"*.
>
> ⚠️ A primeira versão da âncora **não casou** e a linha de base a denunciou pelo
> nome — a regra de sempre, agora paga também aqui.

`.tk-spark` ganhou `container-type: size` e `@container (height < 4px)` esconde o
conteúdo por `visibility` (não `display`), para o espaço seguir **reservado**.

### 🔴 O QUE FICA ABERTO, e é decisão do dono

O piso impede a tela de **afirmar** uma tendência que não desenhou. Ele **não
conserta a origem** — o ROAS continua sem sparkline abaixo de ~231px de card. As
duas saídas são de produto:

| saída | custo |
|---|---|
| truncar a linha de base com reticências | ela existe para ser lida inteira — foi decisão de 07/08 |
| dar `h: 3` ao bloco de ROAS no catálogo | ele fica mais alto que os outros três heros |

⚠️ **Efeito colateral medido, e ele não é neutro:** `container-type: size` implica
`contain: size`, e a caixa do sparkline nos outros KPIs foi de **32px para
36,3px**. Nenhum defeito visível apareceu por isso, mas está registrado — quem
mexer aqui de novo parte deste número, não de 32.

### 🔬 O LIMITE DO `test:contraste` — ele não vê OPACIDADE

> **Registrado como limite do INSTRUMENTO, não como defeito de um bloco.** Vale
> para qualquer texto do projeto que carregue `opacity`.

O `test:contraste` lê o `globals.css` e mede **pares de token**: uma cor de texto
contra uma cor de fundo, as duas declaradas como variáveis. **Ele não vê o que o
componente faz por cima do par** — e `opacity` é aplicada no componente.

O caso que revelou: a linha de base da razão no `BlocoMetrica` tinha
`opacity: 0.85` sobre `--tk-text-muted`. O PAR passa com folga; o pintado dava
**3,70:1** no tema claro e **4,15:1** no escuro, abaixo do piso de 4,5. O teste
estava verde o tempo todo, e estava certo — ele mediu o que sabe medir.

| o instrumento | responde |
|---|---|
| `test:contraste` | *"os tokens da paleta formam pares legíveis?"* |
| ⛔ **não responde** | *"a cor que chegou à tela é legível?"* |

🔎 **O `grep` que acha os candidatos**, e ele é barato:

```bash
grep -rnE "opacity: 0?\.[0-9]" src/components/ --include=*.tsx
```

A pergunta por ocorrência é binária: *isto é TEXTO?* Opacidade em traço, hachura,
sombra, ícone decorativo ou estado desabilitado não entra — o piso de 4,5 é sobre
texto que alguém precisa ler.

⛔ **Não "conserte" o teste para varrer opacidade.** Ele lê CSS, e a opacidade
está no JSX; ensiná-lo a ler os dois seria a segunda implementação do mesmo
cálculo em dois vocabulários. Quem responde a segunda pergunta é a medição da cor
PINTADA (canvas 1×1, com o `globalAlpha` da opacidade, sobre o fundo REAL) — e
ela é cara pelo mesmo motivo de sempre: exige navegador, servidor e sessão.

⚠️ E é o mesmo buraco que o `06` já documenta para o CSS sem camada, agora com um
caso medido em vez de uma suspeita.

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

**10 de 16** têm `linhas` gravado.

> ### ⛔ ESTA LINHA DIZIA QUE O `linhas` VENCIA EM 4 BLOCOS. **Ele não vence em
> ### nenhum** — corrigido em 12/08/2026, pela asserção da F1.
>
> Conferido bloco a bloco em `npm run test:grade`: os `linhas` gravados no dev
> dão 2, 3 ou 4 células, e a medição dá o mesmo ou mais nos 16. Há **empate** em
> três (`atividade`, `paises`, `receita-gasto`) e a medição domina no resto.
>
> ⚠️ **Isso não torna o `linhas` dispensável, e a distinção importa:** um
> `linhas` MAIOR que a medição — que qualquer testador pode ter — passa a
> mandar, e é aí que a leitura pela TELA perderia a escolha do usuário. O
> fixture do dev não exercita esse caso; a asserção exercita.
>
> A frase antiga foi apagada, não anotada ao lado: um número errado sobre a
> própria migração é o tipo de registro que a próxima pessoa usa para "conferir"
> o resultado e conclui que o código está errado.

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

---

# ## Estado em 14/08/2026 — o redesign entrou na `main`

> **Escrito DEPOIS do commit de merge, e é ele que esta seção descreve.**
>
> | | |
> |---|---|
> | commit | **`7990913`** |
> | horário | **14/08/2026, 15:08:11 −03** |
> | `origin/main` | `36b52a1` → `7990913` (conferido por `git ls-remote`, não pelo que o `push` disse) |
> | conteúdo | 19 commits de `redesign/dashboard` · árvore **idêntica** à de `7a8e823`, que rodou a suíte |

## 🔴🔴 O QUE FOI PARA PRODUÇÃO SEM VERIFICAÇÃO DE TELA

**Esta é a razão de esta seção existir.** Não é ressalva de rodapé: são quatro
coisas que ninguém olhou numa tela, e elas estão no ar.

| # | O que | Estado da medição |
|---|---|---|
| 1 | **bandas de 8, 4 e 1 coluna** (`960–1279`, `640–959`, `<640`) | ⛔ **NÃO MEDIDAS.** Só **2260** foi medida — 1 de 5 larguras |
| 2 | **origem A da §7.2** — vão entre conteúdos | ⛔ **NÃO MEDIDA** |
| 3 | **origem B da §7.2** — vão até a borda | ⛔ **NÃO MEDIDA** |
| 4 | **`h` derivado de medição de estado VAZIO** | ⛔ **NÃO MEDIDO** |

### O que FOI medido, com denominador — para a lista acima ser auditável

A 2260, com dado real (`Últimos 30 dias`, R$ 7.058,65), **28 de 28 blocos
examinados**, `semGancho: []`, `svgSemTinta: 0`, `rolagemDaPagina: 0`:

```
estouro na vertical .... 1 de 28   → `Produtos`, 21px, h: 4
estouro na horizontal .. 0 de 28
```

⚠️ **Duas leituras contaram** (base e 2260 — a mesma largura efetiva, porque
`innerWidth 2560 − cromo 300 = 2260`). Uma terceira, a 1280, **mediu `0` estouros
e foi DESCARTADA**: 1 amostra oculta durante a leitura. ⛔ Ela não vale como
"1280 está limpa" — vale como não medida.

### 🔴 O `Produtos` é um defeito CONHECIDO e NÃO CORRIGIDO

Ele saiu de **vão de 121px** (o C6, no estado vazio) para **estouro de 21px**
depois da migração de altura. A suspeita registrada é que o `h` migrado veio de
medição do estado VAZIO e o conteúdo com dado real não cabe nele.

⛔ **Nada de `h` foi tocado neste merge**, por decisão do dono: `git diff --stat`
em `migrar`/`catalogo` devolve **0 linhas**, e `migrarAlturaDoLayout` segue byte
a byte o que já roda em produção desde 13/08. **Não há dado irreversível novo.**

⚠️ E há um indício forte de que a procedência é mesmo o vazio, mas **indício não
é medição**: a faixa da tabela F0b (§11) é **192–382px**, que é exatamente a
faixa do estado vazio registrada no `CLAUDE.md`. Onze dos 16 painéis medem
valores idênticos entre si (`238` em seis, `256` em cinco) — conteúdos
completamente diferentes com a mesma altura é assinatura de PISO, não de
conteúdo. **Confirmar exige medir cada um com dado real.**

## ⛔ POR QUE A MEDIÇÃO NÃO FOI POSSÍVEL — e não é "faltou tentar"

`requestAnimationFrame` **não dispara em aba oculta**, e a janela do Chrome
esteve `document.visibilityState === "hidden"` em **~20 sondagens** ao longo da
sessão inteira. Testado e descartado, nesta ordem:

| tentativa | resultado |
|---|---|
| esperar visibilidade (4s, 6s, 8s) | oculta o tempo todo |
| clique sintético do CDP em ponto inerte | **não levanta janela no nível do SO** |
| screenshot (hipótese: ele ativa a aba) | hipótese **refutada**; depois passou a dar timeout |
| aba **nova** no grupo existente | nasce `hidden` |
| fechar o grupo e forçar **janela nova** | nasce `hidden` |

✅ **O instrumento RECUSA nomeando, em vez de pendurar.** `naTela` lança quando
`document.hidden`, porque a versão anterior devolvia uma promessa que **jamais
assentava, sem exceção** — e isso é indistinguível de "está demorando".

⛔ **A espera de dupla passagem de quadro NÃO foi enfraquecida** para contornar.
`setTimeout` puro devolveria o valor ANTERIOR com cara de medição — foi o que
produziu os "13 descendentes vazando" desta base, que na releitura eram 0.

### 🔎 Onde a medição está armada, para a próxima sessão não remontar nada

Aba **`299375711`**, já no estado certo: período `Últimos 30 dias`,
`modoEdicao: false`, **28/28 com gancho**, grade 2260, instrumento completo
injetado, varredura armada em `visibilitychange` + poll de 1,2s.

Ela mede **as três coisas de uma vez** (`scrollH`/`clientH`/`hQueCabe` por
bloco, origem A, origem B, `soB`) nas cinco larguras, e **descarta qualquer
leitura com amostra oculta**. Basta a janela ficar visível ~10s; ou, no DevTools
daquela aba, `await window.__varrer()`.

## ✅ O que este merge ENTREGOU, e foi verificado por asserção

| | |
|---|---|
| **§7.2 com as duas origens** | A (entre-conteúdos) e B (até-a-borda) da MESMA varredura de bandas. `B \ A` é o conjunto cujo buraco encosta numa borda — a família do C6. Invariante em runtime lança se A > B |
| **partição da fita sob asserção** | `444ce75` entrou sem nenhuma; `teste-desenho.mjs` importava `calcularFluxo`/`segmentosDaFita` **sem chamar** |
| **o nó do observer em ESTADO** | 5 de 6 consumidores de `ResizeObserver` violavam a regra do cabeçalho de `useTamanho.ts` |
| **`etapasDaFita` removido** | resto — o filtro `naFita` migrou para dentro de `segmentosDaFita`. A fita **não perdeu comportamento** |

`tsc` 0 erros · `lint` 0 erros · **52 scripts, 1.427 asserções, 0 falhas.**

> ### 🔓 A TRAVA DE PUSH DA `main` TEM UM BURACO — agora MEDIDO
>
> O `CLAUDE.md` listava `git push origin main:main` como *"refspec completo na
> linha de comando; **não testado**"*. Testado em 14/08/2026, por `--dry-run`:
>
> ```
> git push --dry-run origin main       →  main -> __bloqueado__     (a trava pega)
> git push --dry-run origin main:main  →  36b52a1..7990913 main -> main   (PASSA)
> ```
>
> ⛔ **O refspec completo atravessa as duas configs locais.** Foi por ele que
> este merge subiu — com autorização explícita do dono —, mas a linha do
> `CLAUDE.md` deixa de ser hipótese: a trava local **não** protege a `main` de
> quem digitar o refspec inteiro, e nunca protegeu de outra máquina, de outro
> clone, nem do botão de merge do GitHub.
>
> **A trava que vale continua sendo `branch protection` no GitHub**, e ela segue
> não existindo.

---

## 🧾 Decisões de 14/08/2026 (sessão sem janela) — e a regra que decidiu cada uma

> Tomadas sozinho, pela regra de desempate do dono: **(1)** o que não corta
> informação do usuário vence · **(2)** o que não muda posição do que ele já tem
> vence · **(3)** o reversível vence o irreversível · **(4)** na dúvida, o mais
> conservador, registrado como provisório.

### 1 · O `h` derivado de vazio — ⏸️ NÃO corrigido, e a regra é a (3) e a (4)

**O levantamento estático fechou, e ele é forte.** Cruzando a tabela da §11 com
o `catalogo.ts`:

| | |
|---|---|
| painéis na F0b | **16** (os outros 12 dos 28 são KPIs, e não têm entrada na tabela) |
| catálogo × F0b | **16 de 16 batem** — `hMin === h migrado` em todos, zero divergências |
| **altura medida IDÊNTICA a outro bloco** | 🔴 **11 de 16** |
| faixa das medições F0b | **192–382px** |
| faixa do estado vazio (registrada no `CLAUDE.md`) | **192–382px** — a mesma |

```
256px × 5   atividade, paises, aprovacao, posicionamento, lucro-por-hora
238px × 6   vendas-por-dia, vendas-por-hora, receita-gasto, fontes, produtos, pagamentos
```

> ## Uma rosca, um mapa com ranking, um gráfico de barras por hora e uma tabela de produtos NÃO coincidem ao pixel por conteúdo. Isso é PISO.

⚠️ E os dois clusters distam **18px** — uma linha de `text-caption`, que é
exatamente o que separa um estado vazio cuja frase de causa quebra em uma ou em
duas linhas.

⛔ **Mesmo assim, nenhum `h` foi alterado.** Pela regra **(3)**: `h` alimenta
`migrarAlturaDoLayout`, que é **irreversível** (`h = max(...)`) e roda sozinha ao
abrir o Dashboard. E pela **(4)**: o que existe é indício convergente, não
medição — a tabela da §11 **não registra qual período estava ativo**, e
procedência não se deduz do artefato, só se remede.

🔎 **A medição que fecha o assunto**, para a sessão em que a janela colaborar:
para cada bloco, `scrollHeight` do card com dado real contra o slot. Já está
armada — `window.__bom[w].naoCabem` traz `scrollH`, `clientH`, `estouro` e
`hQueCabe` por bloco, nas cinco larguras.

⚠️ **O único caso conhecido segue sendo o `Produtos`**: 21px de estouro a 2260,
com `h: 4`. ⛔ E a aritmética que apareceu antes (`238 → 293`) **estava errada**:
ela assumia `h: 3`, e o layout vivo tem 4. O `h` correto sai da medição, não de
conta sobre a F0b.

### 2 · A divergência catálogo × §11 virou ASSERÇÃO — `test:catalogo-f0b`

Os dois lados batiam **por disciplina, e nada garantia isso**. Agora são 8
asserções, com plantio (mexer no `h` de um lado só é detectado, nomeando o
bloco) e linha de base nos dois lados (a tabela lida do `07`, o catálogo lido do
`.ts`).

⚠️ Ela **não** valida que a medição da §11 está certa — valida que as duas
cópias do resultado concordam. A procedência continua aberta, acima.

✅ E ela **publica o agrupamento a cada execução**, para a evidência do piso não
depender de ninguém lembrar de recalcular.

### 3 · Origem A e B — coberto o que é puro, e o limite está escrito

`test:vazio-origens` foi de 16 para **21 asserções**. Entraram:

- `soB === B \ A`, e ele só contém `topo`/`fim` — é o **discriminador do C6**, e
  se quebrar a lista volta a misturar defeito de distribuição com defeito de
  altura de slot;
- a fronteira do limiar é **estrita**: 32px não reprova, 33px reprova. Um `>=`
  ali inflaria a lista, e lista inflada é lista desacreditada.

⛔ O que continua fora do alcance de asserção: `__pintadoNoCard`,
`__cardDoBloco` e `__internoDoCard` **precisam de motor de layout**. A
confirmação de tela segue pendente, e é só ela.

### 4 · O lint chegou a ZERO WARNINGS — e isso é o achado, não a arrumação

Estava em `0 erros, 8 warnings`, e **um `0 erros, 12 warnings` escondeu um
defeito real nesta mesma sessão**: os imports órfãos que faziam a partição da
fita parecer testada.

⛔ Três dos oito eram a mesma família, num arquivo de teste de fluxo
**IRREVERSÍVEL**: `teste-areas-tela.mjs` importava `React`,
`renderToStaticMarkup` e **`GavetaExcluir`** sem chamar nenhum. Quem abrisse o
arquivo concluiria que o diálogo de exclusão estava coberto por render — e ele
**porta para o `<body>`**, então `renderToStaticMarkup` devolveria string vazia
e toda asserção de negação passaria afirmando o contrário do verdadeiro.

Os outros: dois literais de REPL viraram atribuição (o valor de retorno
continua, o warning some) e três `.map((x, i) =>` perderam o índice não usado.

> ## Com zero warnings, o próximo warning é sinal. Com oito, nenhum é.

### 5 · `cronAutorizado` ganhou teste — a varredura das famílias achou isto

A varredura por *função de produção que nenhum teste cita* devolveu **203 de
395**, e **114** fora de server action e rede. O de maior consequência:
`cronAutorizado`, a regra *"ausência de configuração nunca vira permissão"*.

O `CLAUDE.md` registra que ela foi verificada **com `curl`, à mão, em
29/07/2026**. Uma verificação manual que virou parágrafo é cobertura
inexistente: o parágrafo é verdadeiro sobre o dia em que foi escrito e não diz
nada sobre hoje — e ali o custo de errar é uma rota que **pausa campanha e
altera orçamento** aberta na internet.

`test:cron-auth`, **18 asserções**: sem secret ninguém entra (inclusive com
`CRON_SECRET=""` e só-espaços, que é o jeito real de reabrir a porta sem
perceber), prefixo parcial recusado, formato só `Bearer`. E a **outra metade do
par**: guarda estática de que **toda** rota `/api/cron/*` chama a função —
4 de 4 —, porque função de auth perfeita que uma rota esquece de chamar é o
cadeado do lado de fora.

> ### ⚠️ O LIMITE DA VARREDURA, e ele é a própria família
> A primeira versão dela reportou *"237 sem teste"* usando um parser de imports
> que **não pegava `await import` desestruturado** — `derivarLayout` e
> `ads/metrics` apareciam como descobertos e são testados. O número foi
> descartado, não publicado. **Saída plausível não é evidência de que o
> instrumento mediu o alvo**, e um relatório de cobertura errado teria mandado a
> próxima pessoa escrever teste para o que já tem.

### 6 · A varredura das famílias — o que ela achou depois

**Família nova, nomeada pelo dono: *teste que existe e nunca rodou*.**

`teste-ambiente.mjs` tinha `npm run test:ambiente` e **nenhum agregado o
invocava**. É a família do `teste-fita.mjs` (07/08/2026), agora com um segundo
caso — e a diferença entre os dois é o que torna a família traiçoeira:

| | |
|---|---|
| `teste-fita` | estava **podre** — 9 asserções quebradas, e a suíte verde |
| `teste-ambiente` | estava **saudável** — 58 asserções passando |

> ## Órfão podre e órfão saudável são indistinguíveis sem EXECUTAR. Não havia como saber qual era qual sem rodar os dois.

⚠️ E o custo é assimétrico no tempo: o órfão saudável de hoje é o podre de
amanhã, no primeiro commit que mudar o contrato que ele mede.

**`test:agregado-completo` (6 asserções)** fecha a porta: todo `teste-*.mjs` tem
script npm, e todo script npm é invocado por um agregado. Denominador impresso —
**70 arquivos, 71 scripts em agregado**.

✅ **Ela reprovou no estado real antes de consertar**, o que vale mais que
plantio sintético — e o primeiro que ela pegou foi **ela mesma**, recém-criada e
ainda sem script npm.

⛔ O limite está escrito nela: prova que o arquivo é INVOCADO, não que ele mede
alguma coisa. Um teste no agregado com zero asserções passa por ali.

### 7 · O caminho do FRACASSO do Login ganhou asserção

O `CLAUDE.md` registrava que o estado de erro do formulário **nunca foi
exercido**, e propunha uma ação falsa como remédio. **A proposta não funcionava,
e o motivo é estrutural:** `useActionState` **não roda a ação no SSR** — o
estado inicial é `{}`, e `renderToStaticMarkup` nunca alcançava aquele ramo. O
`test:login` já passava uma `acaoFalsa`, e isso dava a **aparência** de
exercitar o envio.

⛔ **Quem acerta a senha vê a tela por dois segundos e vai embora. Quem erra
fica ali, lendo.** Era esse o caminho descoberto.

O aviso virou `AvisoDeErro`, exportado, com consumidor de verdade.
`test:login` foi de 22 para **27 asserções**: a mensagem do servidor chega
inteira, `role="alert"` está lá, o par tingido não sumiu, o componente **não
inventa texto por cima do que o servidor mandou**, e — a linha de base do par —
o formulário limpo **não** desenha alerta nenhum.

> ### ⚠️ POR QUE NÃO UMA PROP `estadoInicial`
> Era a saída óbvia e foi **recusada**: uma prop que só o teste passa é
> literalmente o sinal barato da família *"helper com parâmetro que ninguém mais
> passa"* — eu estaria plantando o defeito que a varredura procura. Um
> componente extraído tem consumidor de produção, e some do radar por ser
> correto, não por disfarce.
