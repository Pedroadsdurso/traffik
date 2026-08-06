# 05 — MAPA DAS RAZÕES COM DENOMINADOR ZERO

> ## ✅ FECHADO EM 06/08/2026 — **0 de 24** com contrato errado
>
> O levantamento abaixo fica como está, porque descreve o estado ANTES. O que
> mudou está no CLAUDE.md, seção "DENOMINADOR ZERO".
>
> ### 🔎 A base estava mais pronta do que este mapa sugeria
>
> Contraintuitivo, e muda a expectativa de custo: **o trabalho real era no
> PRODUTOR, quase nada nos consumidores.**
>
> Ao tornar `margem` e `chargeback` anuláveis — duas mudanças de tipo em
> interfaces lidas por dezenas de arquivos — o `tsc` quebrou em **dois lugares,
> os dois no mesmo arquivo** (`reports/generate.ts:41,48`).
>
> A razão: `format.ts` já aceitava `null` em TODOS os formatadores (`brl`, `pct`,
> `multFmt`) e `financeiro.ts` já tinha campo nulo por causa da correção anterior
> do ROI. A camada de apresentação estava pronta havia tempo — faltava alguém
> puxar o gatilho na origem.
>
> ⚠️ **Mas o `tsc` só conta metade.** Ele acha quem lê; não acha quem colapsa. A
> varredura por `?? 0` / `|| 0` / `|| 1` encontrou **6 pontos** que compilavam,
> mantinham o tipo e desfaziam a correção em silêncio — inclusive o do
> `chargebackRate`, cuja correção teria nascido inerte.
>
> **A conta final:** 2 quebras de compilação, 6 colapsos silenciosos. Se isto
> valer para a próxima mudança de contrato, espere o mesmo formato — barato no
> compilador, caro na varredura.

> ✅ **LEVANTAMENTO COMPLETO.** Iniciado em 06/08/2026 (só o item 4) e fechado em
> 06/08/2026, itens 1, 2, 3 e 5.
>
> ⛔ **Este documento é levantamento, não decisão. NADA foi corrigido.** A regra
> que o dono pretende adotar está no fim, agora **validada** contra os cinco
> itens — com a lista do que ela quebraria.

| Item | O que responde | Estado |
|---|---|---|
| 1 | onde cada métrica é calculada | ✅ **PRONTO** — 24 pontos, 3 contratos diferentes |
| 2 | por que hero e faixa divergem (`0,00x` × `—`) | ✅ **PRONTO** — e a resposta é que **não divergem** |
| 3 | quem consome | ✅ **PRONTO** — 7 consumidores, 1 guarda morta |
| **4** | **as regras de automação** | ✅ **PRONTO** |
| 5 | o padrão da string formatada | ✅ **PRONTO** — 11 campos |

### O resumo em quatro linhas

1. **Existem duas funções chamadas `div`, com contratos OPOSTOS.** `ads/metrics.ts:43`
   devolve `null`; `dashboard/metrics.ts:1064` devolve `0`. Mesmo nome, mesma conta,
   respostas contrárias.
2. **A camada do servidor está quase toda certa** — `computeDashboard` e
   `derivar()` já devolvem `null`. Quem colapsa para zero são **as bordas**:
   séries de sparkline, criativos, motor de regras, margem, funil e chargeback.
3. **O item 2 era um alarme falso.** ROAS é renderizado em **um** lugar só. O que
   se viu foi ROAS (denominador = gasto) ao lado de CPA (denominador = vendas) —
   métricas diferentes, as duas corretas.
4. **A guarda `Number.isFinite` do `Sparkline` não pode disparar.** O produtor não
   emite não-finito. Ela protege de um caso que não existe, enquanto o caso que
   existe — o zero — passa por ela sem ser tocado.

---

## 【4】 REGRAS DE AUTOMAÇÃO — pronto, e o achado inverte a hipótese

### A pergunta era

> *"`Infinity > 50` é true. Se uma regra 'pausar quando CPA > X' recebe Infinity,
> ela pausa a campanha sozinha — e Infinity é o que sai quando não houve conversão."*

### A resposta é NÃO — e o bug real é o espelho disso

**a) Sim, regras comparam CPA, ROAS e CTR contra limite.** As métricas
disponíveis numa condição são `cpa`, `roas`, `ctr`, `gasto`, `vendas`
(`engine.ts:11`). **`ROI` não existe nas regras** — o caminho de ROI não toca o
motor.

**b) `Infinity` e `NaN` nunca chegam à comparação.** As três divisões derivadas
têm guarda de denominador zero, em `src/lib/rules/engine.ts:74-87`:

```ts
function metricValue(m: EntityMetrics, key: RuleCondition["metrica"]): number {
  case "cpa":  return m.results     ? m.spend / m.results            : 0;
  case "roas": return m.spend       ? m.revenue / m.spend            : 0;
  case "ctr":  return m.impressions ? (m.clicks / m.impressions) * 100 : 0;
}
```

Ou seja: **a campanha nova NÃO é pausada por uma regra de "CPA alto".** O cenário
temido não acontece.

**c) 🔴 Mas a guarda devolve `0`, e isso é a outra metade do mesmo erro.**

*"Não tenho dado"* vira *"o dado é zero"* — e **zero satisfaz toda comparação com
`<` e `<=`**. O `conditionsMet` (`engine.ts:99-112`) compara o número direto, sem
nenhuma noção de que aquele zero é uma ausência:

```ts
case ">":  return actual > c.valor;
case "<":  return actual < c.valor;    // ← 0 < qualquer limite positivo = TRUE
case ">=": return actual >= c.valor;
case "<=": return actual <= c.valor;   // ← idem
```

| Regra cadastrada | Estado sem dado | Dispara? |
|---|---|---|
| `PAUSAR` quando **ROAS < 1** | campanha sem gasto no período → ROAS = 0 | 🔴 **SIM — pausa** |
| `PAUSAR` quando **CTR < 1** | zero impressões → CTR = 0 | 🔴 **SIM — pausa** |
| `AJUSTAR_ORCAMENTO` quando **CPA < 20** | zero conversões → CPA = 0 | 🔴 **SIM — escala orçamento de campanha que não converteu nada** |
| `PAUSAR` quando **CPA > 50** | zero conversões → CPA = 0 | ✅ não (`0 > 50` é falso) |

**A direção segura é a que se temia; a insegura é a oposta.** `>` e `>=` erram
para o lado de não agir. `<` e `<=` **agem por falta de dado** — e o terceiro caso
**gasta dinheiro** em vez de economizar.

### O agravante: o risco já tinha sido pensado, e a proteção ficou no lugar errado

O comentário de `engine.ts:212` diz, sobre a consulta de vendas:

> *"Estas linhas alimentam CPA e ROAS de uma regra que PAUSA campanha e altera
> orçamento sozinha. Clique apagado não pode zerar o faturamento de uma campanha
> aqui: seria uma regra de 'CPA alto' agindo por falta de dado."*

A proteção foi posta na **origem do dado** (não deixar o faturamento zerar por
clique apagado). A mesma classe de erro ficou aberta **na guarda da divisão**, um
arquivo abaixo. É o padrão "ao endurecer um alarme, procure as OUTRAS SAÍDAS do
mesmo módulo".

### Onde a correção caberia — UM lugar, não espalhado

`metricValue` passa a poder devolver "indefinido", e `conditionsMet` retorna
`false` **para a condição inteira** quando recebe indefinido, qualquer que seja o
operador. Os dois vizinhos que também leem `metricValue` e precisam concordar:

| Consumidor | Linha | O que faz hoje |
|---|---|---|
| `conditionsMet` | `engine.ts:99` | compara — é onde a decisão acontece |
| `previewRule` | `engine.ts:518` | monta a prévia da gaveta com os mesmos valores |
| log de execução | `engine.ts:601` | grava os valores avaliados no `RuleRun` |

⚠️ Os três chamam `metricValue`, então a mudança é **de uma função só** — mas a
prévia e o log passam a poder exibir "indefinido", e o texto deles precisa
decidir como mostrar isso. Hoje os dois já anotam que `cpa`, `roas` e `ctr` são
DERIVADAS e não vêm do mapa cru.

### ⛔ O que NÃO se sabe daqui

**Se existe hoje, em produção, alguma regra com `<` ou `<=` sobre `roas`, `cpa`
ou `ctr`.** As credenciais de produção não existem em arquivo local, de
propósito, então qualquer afirmação sobre aquele banco seria inferência.

👉 **Quem responde é `npm run regras:auditar -- --url '<conn>'`**, rodado pelo
dono. Ele mostra o que as regras fariam e o que já fizeram.

Contexto que o CLAUDE.md já registra: o motor **já pausou campanha por acidente**
uma vez, em produção, em 31/07/2026.

---

## 【1】 ONDE CADA MÉTRICA É CALCULADA — 24 pontos, TRÊS contratos

### 🔴 O achado que organiza todos os outros: DOIS `div`, contratos opostos

```ts
// src/lib/ads/metrics.ts:43        — o Gerenciador
function div(a: number, b: number): number | null { return b > 0 ? a / b : null; }

// src/lib/dashboard/metrics.ts:1064 — as séries do Dashboard
const div = (a: number, b: number) => (b ? a / b : 0);
```

Mesmo nome, mesma conta, **respostas contrárias à mesma pergunta**. É a regra
"duas implementações da mesma conta divergem sempre" na forma mais literal que
esta base já produziu — e o pior é que o arquivo do Dashboard **sabe disso**: o
comentário de `metrics.ts:613` cita o `div()` do Gerenciador como o modelo certo,
**56 linhas antes** de declarar o `div` que faz o contrário.

⚠️ O `div` de `metrics.ts:1064` é local a uma função, então nada no `tsc` os
aproxima. O nome idêntico é coincidência de quem escreveu, não import.

### A tabela completa

Legenda: ✅ devolve `null`/indefinido · 🔴 colapsa para `0` · 🟡 devolve só string

| Métrica | Onde | Denominador 0 → | |
|---|---|---|---|
| **ROAS** | `dashboard/metrics.ts:633` | `null` | ✅ |
| | `ads/metrics.ts:56` (`div`) | `null` | ✅ |
| | `ads/creatives.ts:151` | **`0`** | 🔴 |
| | `rules/engine.ts:76` | **`0`** | 🔴 |
| | `dashboard/metrics.ts:1074` (série) | **`0`** | 🔴 |
| | `useTraffikState.ts:1116` (`roasLabel`) | `"—"` | 🟡 |
| | `useTraffikState.ts:1221` (criativos) | `"—"` | 🟡 |
| **CPA** | `dashboard/metrics.ts:632` | `null` | ✅ |
| | `ads/metrics.ts:58` | `null` | ✅ |
| | `rules/engine.ts:75` | **`0`** | 🔴 |
| | `dashboard/metrics.ts:1077` (série) | **`0`** | 🔴 |
| | `useTraffikState.ts:1115` (`cpaLabel`) | `"—"` | 🟡 |
| **CTR** | `dashboard/metrics.ts:634` | `null` | ✅ |
| | `ads/metrics.ts:61` | `null` | ✅ |
| | `ads/creatives.ts:150` | **`0`** | 🔴 |
| | `rules/engine.ts:77` | **`0`** | 🔴 |
| | `useTraffikState.ts:1114` / `:1220` | `"—"` | 🟡 |
| **ROI** | `financeiro.ts:397` | `null` | ✅ |
| | `ads/metrics.ts:57` (**fórmula diferente**) | `null` | ✅ |
| **Ticket** | `dashboard/metrics.ts:631` | `null` | ✅ |
| | `dashboard/metrics.ts:1075` (série) | **`0`** | 🔴 |
| | `useTraffikState.ts:785` (posicionamento) | `"—"` | 🟡 |
| **ARPU** | `dashboard/metrics.ts:695` | `null` | ✅ |
| | `dashboard/metrics.ts:1076` (série) | **`0`** | 🔴 |
| **Margem** | `financeiro.ts:385` | **`0`** | 🔴 |
| **CPC · CPM · CPI** | `ads/metrics.ts:60,62,63` | `null` | ✅ |
| **Chargeback** | `dashboard/metrics.ts:603` | **`0`** | 🔴 |
| **Funil %** | `funnel.ts:62` | **`0`** | 🔴 |
| | `funnel.ts:67` | `null` | ✅ |
| | `useTraffikState.ts:812` (`rate`) | **`"0%"`** | 🔴🟡 |
| **Participação** | `useTraffikState.ts:770` / `:805` | **sem guarda** | 🔴 |
| | `Donut.tsx:79,151,186` · `DonutChart.tsx:46` | misto | 🔴 |

### As três coisas que essa tabela mostra e a leitura linha a linha não mostra

**a) O servidor está certo; as BORDAS é que erram.** `computeDashboard` (as 5
razões de KPI) e `derivar()` (as 8 do Gerenciador) devolvem `null` corretamente,
e os dois têm comentário longo explicando por quê. Todos os 🔴 estão em código
que ficou **fora** desses dois — série de sparkline, criativos, motor de regras,
margem, funil, chargeback, donut.

**b) `funnel.ts` tem os dois contratos na MESMA função**, cinco linhas de
distância: a linha 62 devolve `0` e a 67 devolve `null`. Nada indica que a
diferença foi decidida.

**c) `ROI` tem duas fórmulas, e as duas estão certas — o problema é o NOME.**
`financeiro.ts:397` é `lucro líquido ÷ custo total` (com taxas, impostos e
despesas); `ads/metrics.ts:57` é `(faturamento − gasto) ÷ gasto`. O
`AdsTable.tsx:88-96` já documenta a diferença e chama a segunda de **"ROI de
mídia"** na coluna. Isso está resolvido — fica registrado para não ser
"corrigido" por engano numa unificação futura.

⚠️ **`margem` e `chargeback` não têm sequer o tipo para dizer indefinido:**
`metrics.ts:88` declara `margin: number` (os irmãos são `number | null`). Mudar
o contrato deles é mudança de tipo, não só de guarda.

---

## 【2】 HERO × FAIXA — o alarme era falso, e a razão importa

### A pergunta era

> *"O mesmo período mostrava `0,00x` no hero e `—` na faixa. São dois caminhos de
> código ou o mesmo valor formatado de dois jeitos?"*

### Nenhum dos dois: **ROAS é renderizado em UM lugar só**

`grep -rn "roas" src/components/dashboard/views/dashboard/` devolve **um acerto**:
`DashboardScreen.tsx:56`, a constante `HERO`. A faixa é
`FAIXA = ["ticket","ctr","cpa","arpu","margem","pendentes","reembolsadas"]` — ROAS
não está nela.

E os dois componentes leem a **mesma** fonte, sem recalcular nada:

```
useTraffikState.ts:695-740   monta `reg` (um Record por métrica, com `value` já formatado)
        ↓ metricCards
DashboardScreen.tsx:75-91    `kpi()` copia `k.value` para `DadosKpi.valor` — verbatim
        ↓
KpiHero (Kpi.tsx:97)  e  MetricStrip (Kpi.tsx:169)   imprimem `dados.valor`
```

**Um cálculo, uma formatação, dois componentes que só imprimem.** Não há caminho
de código onde a mesma métrica possa sair diferente nos dois.

⚠️ E não é herança do Dashboard antigo: o `BlockContent.tsx` deletado lia
`v.metricCards[metric]` (linha 45) — a mesma fonte única.

### O que foi visto, então

`0,00x` e `—` lado a lado, no mesmo período, são **duas métricas diferentes**:

| | Fórmula | Período com gasto e sem venda |
|---|---|---|
| ROAS (hero) | faturamento ÷ **gasto** | gasto > 0 → **`0,00x`**, e é verdade: gastou e não voltou nada |
| CPA (faixa) | gasto ÷ **vendas** | vendas = 0 → **`—`**, e é verdade: não dá para calcular |

**As duas estão certas, e pela regra que o dono pretende adotar continuariam
certas.** A tela não erra o número; ela não *diz* que os denominadores são
diferentes, e quem lê a fileira inteira de uma vez lê como inconsistência.

> ### 🔎 A assimetria REAL que existe entre os dois — e não é de valor
> `KpiHero` recebe `carregando` e imprime `"—"` enquanto carrega (`Kpi.tsx:97`).
> `MetricStrip` **não recebe a prop** (`DashboardScreen.tsx:369`) e segue
> imprimindo os números do carregamento anterior.
>
> Então, durante todo `dashLoading`, a tela mostra **quatro traços em cima e sete
> números embaixo** — e os sete são do período ANTERIOR ao filtro que a pessoa
> acabou de trocar. Não é divisão por zero, mas é a única divergência real entre
> hero e faixa, e ela aparece toda vez que se muda o período.
>
> ⛔ Fica registrada aqui e **não foi corrigida** — está fora do escopo do
> levantamento.

---

## 【3】 QUEM CONSOME

Sete consumidores. A coluna que importa é a última: o que cada um faz quando o
valor é indefinido **hoje**.

| # | Consumidor | Lê de | Comportamento com indefinido |
|---|---|---|---|
| 1 | **Cards e faixa do Dashboard** | `metricCards` | ✅ `"—"` via `format.ts` |
| 2 | **Sparkline dos 4 heros** | `chart.sparklines` | 🔴 desenha **0 no chão** — ver abaixo |
| 3 | **Tabela do Gerenciador** | `derivar()` | ✅ `traco` em toda célula (`AdsTable.tsx:385-428`) |
| 4 | **Criativos** | `ads/creatives.ts` | 🔴 `0` no cálculo, mascarado por `"—"` na view |
| 5 | **Regras de automação** | `metricValue` | 🔴 `0` — item 4 |
| 6 | **Relatórios / notificação** | `computeDashboard` | ✅ `mult()`/`brl()` · 🔴 exceto `margem` |
| 7 | **Funil, donuts, barras** | `funnel.ts`, `useTraffikState` | 🔴 `0`, `"0%"` ou `NaN%` |

**Não há exportação CSV/planilha** nesta base — `grep` por `csv`/`xlsx`/`download`
não encontra rota nem ação. E **nenhuma rota de `/api` devolve razão calculada**:
`/api/dashboard`, `/api/ads` e `/api/creatives` repassam o que as funções acima
produzem. Então a lista está fechada.

### 🔴 O consumidor 2 tem uma guarda que NÃO PODE DISPARAR

`Sparkline.tsx:30-36` filtra não-finitos, com este comentário:

> *"As séries de razão são divisões feitas no servidor, e num bucket com
> denominador zero elas saem `Infinity` ou `NaN`."*

**O produtor não faz isso.** `div = (a, b) => (b ? a / b : 0)` devolve `0` para
todo denominador falso. Medido, com a cópia literal das duas funções:

```
10 / 0          → 0   finito? true
0 / 0           → 0   finito? true
10 / NaN        → 0   finito? true
10 / undefined  → 0   finito? true
```

Só sai não-finito se o **numerador** já for `Infinity`/`NaN` — e o numerador é
`revenue[i]` ou `spend[i]`, somas de `num()`. O filtro nunca remove nada.

**E o que a série realmente contém passa por ele intacto.** Geometria do próprio
`Sparkline`, para uma série de 7 dias em que 4 não tiveram gasto:

```
entrada        [0, 0, 3.2, 0, 2.8, 0, 0]
y dos pontos   [29, 29, 3, 29, 6.3, 29, 29]      (0 = topo, 32 = chão)
```

Os dias sem gasto são plotados **no chão**, indistinguíveis de "o ROAS despencou
para zero". É exatamente o que o comentário de `metrics.ts:1065-1068` diz querer
evitar — mas a proteção `serieVazia` de lá só cobre o caso em que a série
**inteira** não tem gasto (`gastoNaSerie === false`), nunca o buraco no meio.

⚠️ **`ticket` e `arpu` não têm nem essa proteção**: as séries deles não são
condicionadas por `gastoNaSerie`, então todo dia sem venda vai para o chão.

> ### ⛔ E há um pedaço que este levantamento NÃO consegue explicar
> O CLAUDE.md registra ter visto *"uma barra azul sólida"* no sparkline do ROAS,
> e atribui a `Infinity`. **Este produtor não consegue emitir `Infinity`**, e ele
> devolve `0` desde `7c79566` — muito antes do filtro, que nasceu em `16e0e21`.
>
> Ou o sintoma veio de outra forma de série (uma série **toda igual** cai em
> `max === min` e desenha uma faixa horizontal no meio do card, com preenchimento
> abaixo — o que na tela também é "uma barra"), ou de um estado de código que não
> está no histórico. **Não afirmo qual.** O que está provado é que o filtro atual
> não tem entrada que o acione, e que o defeito que a série produz de fato é o
> zero-no-chão.

---

## 【5】 O PADRÃO DA STRING FORMATADA — 11 campos

O defeito: o hook expõe **só** o texto, e quem precisa do número tem de reverter
`"R$ 1.234,00"` em reais. Nenhum deles tem `null` — o indefinido já virou traço
antes de sair, e a informação de que era indefinido se perde junto.

| Campo | Onde | Só string? |
|---|---|---|
| `roasLabel` `cpaLabel` `ctrLabel` | `useTraffikState.ts:1114-1116` (helpers) | 🔴 sim |
| `roasLabel` `cpaLabel` `ctrLabel` `spendLabel` `budgetLabel` | `:1143-1193` (campanha/conjunto/anúncio) | 🔴 sim |
| `spendLabel` `revenueLabel` `roasLabel` | `:1203-1208` (contas) | 🔴 sim |
| `ctrLabel` `roasLabel` | `:1220-1221` (criativos) | 🔴 sim |
| `ticketLabel` | `:785` (posicionamento) | 🔴 sim |
| `pctLabel` | `:770` (fontes) e `:805` (pagamentos) | 🔴 sim, **e sem guarda** |
| `rate` do funil | `:812` | 🔴 sim, e `"0%"` para indefinido |
| `totalLabel` `barWidth` | `:761-806` | 🟡 sim, mas `total` cru está ao lado |
| `finance` | `:1915` | 🔴 sim — o caso original |
| `despesaRows` | `:929-930` | ✅ **já tem `value` numérico ao lado** (paliativo de 06/08) |

**A forma da correção já existe nesta base**, e é a do `despesaRows`: acrescentar
o número **ao lado** do formatado, sem tirar o formatado. Quem já consome não
quebra, e quem precisa somar para de reverter texto.

⚠️ **`pctLabel` é o único sem guarda nenhuma.** `srcTotal` e `payTotal` levam
`|| 1` (linhas 764 e 798), o que evita o `NaN` — mas com o preço de afirmar
`0%` para toda fonte quando o total é zero, em vez de dizer que não há
participação a calcular. É guarda contra `NaN`, não contra indefinido.

---

## A REGRA QUE O DONO PRETENDE ADOTAR — agora VALIDADA

```
denominador = 0, numerador = 0    →  indefinido  →  "—"
denominador = 0, numerador > 0    →  indefinido  →  "—"   (nunca Infinity)
denominador > 0, numerador = 0    →  0,00x       →  valor real
```

E nas regras de automação:

> **Valor indefinido nunca satisfaz comparação nenhuma. A regra é PULADA**, não
> avaliada como 0 nem como Infinity.

### ✅ Ela é coerente com o que o sistema JÁ FAZ na maioria dos pontos

Os dois cálculos centrais — `computeDashboard` e `derivar()` — já a seguem, e
`format.ts` já a implementa do lado da apresentação (`TRACO`, e todo formatador
aceitando `null`). **Adotá-la não é inventar um contrato novo: é terminar de
aplicar o que 13 dos 24 pontos já aplicam.**

### O que ela muda, ponto a ponto

| Onde | Hoje | Com a regra | Muda o quê |
|---|---|---|---|
| `rules/engine.ts:74-87` | `0` | pula a condição | 🔴 **comportamento em produção** |
| `dashboard/metrics.ts:1064` (`div`) | `0` no chão | ponto ausente | visual do sparkline |
| `ads/creatives.ts:150-151` | `0` | `null` | ranking "melhor do dia" |
| `financeiro.ts:385` (margem) | `0` | `null` | **tipo muda** |
| `dashboard/metrics.ts:603` (chargeback) | `0` | `null` | **tipo muda** |
| `funnel.ts:62` | `0` | `null` | alinha com a linha 67 |
| `useTraffikState.ts:812` (`rate`) | `"0%"` | `"—"` | funil |
| `:770` / `:805` (`pctLabel`) | `0%` via `\|\| 1` | `"—"` | fontes e pagamentos |

### ⚠️ Os três pontos que exigem decisão explícita, não só aplicação

**1. O motor de regras muda comportamento em produção.** Uma regra `ROAS < 1`
deixa de pausar campanha parada. Para quem cadastrou "pausar o que está ruim"
contando — mesmo sem saber — que campanha parada também fosse pausada, o
comportamento muda de forma visível. É a mudança certa (*"não tenho dado" é
diferente de "o dado diz que está ruim"*), e merece aviso ao usuário.

👉 **Antes de mexer: `npm run regras:auditar -- --url '<conn>'`.** Se não houver
regra com `<`/`<=` sobre `roas`/`cpa`/`ctr` em produção, a mudança é inócua hoje
e preventiva para amanhã. Se houver, é mudança sentida.

**2. "Melhor criativo do dia" muda de critério.** `creatives.ts:168-175` escolhe
por `r.spend > 0 && r.roas > bestRoas` — o `spend > 0` já filtra o caso, então na
prática o `0` de hoje não elege ninguém errado. Com `null`, a comparação
`null > bestRoas` é `false` e o resultado é o mesmo. **É o único 🔴 da tabela que
não produz defeito visível hoje**, e vale registrar para não gastar revisão nele.

**3. `margem` e `chargeback` mudam de TIPO** (`number` → `number | null`), e
`reports/generate.ts:41,48` faz `k.margin.toFixed(0)` sem checagem. São os dois
call sites que quebram no `tsc` — o que é bom: quebram alto, não em silêncio.

### ❓ O que a regra NÃO resolve

**A assimetria de carregamento entre `KpiHero` e `MetricStrip`** (item 2). Não é
divisão por zero e não sai daqui.

**A guarda morta do `Sparkline`.** A regra torna a série capaz de ter buracos, e
aí o filtro `Number.isFinite` continua sem ter o que filtrar — o que o componente
vai precisar é saber **pular** um ponto ausente, que é outro desenho (linha
interrompida) e outra decisão.
