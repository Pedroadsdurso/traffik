# 05 — MAPA DAS RAZÕES COM DENOMINADOR ZERO

> ⚠️ **LEVANTAMENTO INCOMPLETO.** Iniciado em 06/08/2026 e interrompido pelo fim
> da sessão. **Só o item 4 está pronto** — e ele é o urgente, então o corte não
> foi arbitrário.
>
> ⛔ **Este documento é levantamento, não decisão.** Nada foi corrigido. A regra
> que o dono pretende adotar está no fim, ainda **não validada** contra os itens
> que faltam.

| Item | O que responde | Estado |
|---|---|---|
| 1 | onde cada métrica é calculada | ⛔ **não começou** |
| 2 | por que hero e faixa divergem (`0,00x` × `—`) | ⛔ **não começou** |
| 3 | quem consome | ⛔ **não começou** |
| **4** | **as regras de automação** | ✅ **PRONTO — ver abaixo** |
| 5 | o padrão da string formatada | ⛔ **não começou** |

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

## 【1】【2】【3】【5】 — NÃO COMEÇARAM

Registrado aqui o que já se sabe e **por onde começar**, para não refazer do zero.

### 【1】 Onde são calculadas — o que perguntar

Para ROAS, ROI, CPA, Ticket médio, ARPU, Margem de lucro, CTR, CPC e Taxa de
conversão: arquivo e função, **listando TODAS as ocorrências** quando a mesma
métrica é calculada em mais de um lugar.

Suspeitos conhecidos, a confirmar:

- `src/lib/dashboard/metrics.ts` — `computeDashboard`
- `src/lib/ads/overview.ts` — `computeAdsOverview`
- `src/lib/ads/creatives.ts`
- `src/components/dashboard/useTraffikState.ts` — tem `roasLabel`, `cpaLabel`,
  `ctrLabel` como helpers de formatação, e é onde `finance` é montado
- `src/lib/rules/engine.ts` — `metricValue` ✅ já mapeado no item 4

⚠️ O dono já sabe de **três fórmulas de ROI** espalhadas (Dashboard, Gerenciador,
Taxas). A pergunta é se as outras métricas têm o mesmo espalhamento.

### 【2】 Por que hero e faixa divergem — a pergunta mais importante

No mesmo período, o hero mostra `0,00x` e a faixa mostra `—`. **São dois caminhos
de código ou o mesmo valor formatado de dois jeitos?** A resposta diz se o
problema está no cálculo ou na apresentação.

Começar por `DashboardScreen.tsx`: os `heros` e a `faixa` são montados no mesmo
arquivo, e o `KpiHero`/`MetricStrip` vêm de `tk/Kpi.tsx`.

### 【3】 Quem consome — lista completa, não só o Dashboard

cards e faixas · tooltips · tabelas do Gerenciador · exportação (CSV/planilha) ·
alertas · notificações · **regras de automação** (✅ já mapeado) · qualquer rota
de API que devolva esses números.

### 【5】 O padrão da string formatada

Expor **só** o valor formatado, sem o número. Conhecidos: `finance` e
`despesaRows` (este já ganhou `value` numérico **ao lado** do `valueLabel`, como
paliativo — o formatado ficou para não quebrar quem já consome).

Procurar os outros: campos que terminam em `Label` no retorno do
`useTraffikState` são o melhor ponto de partida (`roasLabel`, `cpaLabel`,
`ctrLabel`, `spendLabel`, `budgetLabel`, `revenueLabel`…).

---

## A REGRA QUE O DONO PRETENDE ADOTAR — ainda NÃO validada

> ⛔ Não implementar. Validar contra os itens 1, 2, 3 e 5 antes.

```
denominador = 0, numerador = 0    →  indefinido  →  "—"
denominador = 0, numerador > 0    →  indefinido  →  "—"   (nunca Infinity)
denominador > 0, numerador = 0    →  0,00x       →  valor real
```

E nas regras de automação:

> **Valor indefinido nunca satisfaz comparação nenhuma. A regra é PULADA**, não
> avaliada como 0 nem como Infinity.

### O que já dá para dizer sobre ela, com o item 4 na mão

✅ **É aplicável ao motor de regras, e resolve exatamente o defeito encontrado.**
O ponto de aplicação é uma função só (`metricValue`), e a mudança é de tipo de
retorno, não de fórmula.

⚠️ **O que ela quebraria no motor, e é preciso decidir de propósito:** hoje uma
regra `ROAS < 1` dispara para campanha sem gasto. Com a regra nova ela **deixa de
disparar**. Para quem cadastrou "pausar o que está ruim" contando (mesmo sem
saber) que campanha parada também fosse pausada, o comportamento muda de forma
visível. É a mudança certa — *"não tenho dado" é diferente de "o dado diz que
está ruim"* —, mas é mudança de comportamento em produção e merece aviso.

❓ **Não validada para os itens 1, 2, 3 e 5.** Em especial: se a mesma métrica é
calculada em três lugares (o caso conhecido do ROI), a regra tem de ser aplicada
nos três, ou os três divergem de um jeito novo — e a regra "duas implementações
da mesma conta divergem sempre" diz que vão divergir.
