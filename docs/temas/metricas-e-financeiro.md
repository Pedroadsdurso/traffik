# Métricas, financeiro e períodos

> Leia ao mexer em KPI, funil, lucro, taxa, ROI/ROAS ou janela de período.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 📐 Precisão das métricas e coerência do funil (28/07/2026)

### ⚠️ ROI travado em −1,00x NÃO é bug — é o piso matemático

Não existe clamp no código. A conta é `roi = (faturamento − custo) / custo`, que
é o mesmo que `faturamento/custo − 1`. **Com faturamento 0 o resultado é −1 para
qualquer custo**, porque não dá para perder mais do que 100% do que se investiu.
Um ROI "cada vez mais negativo" exigiria faturamento NEGATIVO, e reembolso aqui
muda o status da venda (sai do faturamento) em vez de subtrair.

Quem varia com o tamanho do prejuízo é o **Lucro, em reais** — já é um card.
Se o ROI está −1,00x em tudo, a pergunta certa é *"por que o faturamento é 0?"*,
e a resposta costuma ser atribuição: sem os UTMs do Bloco 11 casando, a venda não
cola na campanha e o Gerenciador mostra faturamento 0 por linha.

**O que era bug de verdade e foi corrigido:** `totalCost === 0` devolvia `0`, e a
tela mostrava "0,00x" — que se lê como empate — para uma conta que faturou sem
gastar nada. Agora é `null` → "—". `DashboardData.kpis.roi` virou `number | null`.

### Arredondamento: 2 casas em tudo

`roasFmt` tinha **1 casa** e `multFmt` **2**, então o mesmo número aparecia
diferente conforme o card (ROAS 3,73 → "3,7x"; ROI 3,73 → "3,73x"). `toFixed`
arredonda para a casa pedida (3,75 → "3,8" com 1 casa) — era daí que vinha a
sensação de "número fechado". Hoje **`roasFmt` é alias de `multFmt`** e `pct`
passou de 1 para 2 casas (CTR, margem). CPA/CPC/CPM usam `brl`, que já tinha 2.

### Funil: de onde vem cada etapa

As 5 etapas **não saem da mesma fonte**, e é isso que explica uma passar de 100%
da anterior:

| Etapa | Fonte |
|---|---|
| Cliques no anúncio | Meta Ads (`DailyAdMetric`) |
| Visita na página | Nosso script (`Click`) — 1 por sessão |
| Initiate Checkout | `PixelEvent` + webhook — **visitantes distintos** |
| Vendas iniciadas | Gateway (`Sale`, todos os status) |
| Vendas aprovadas | Gateway (`Sale`, status APROVADA) |

Só **aprovadas ⊆ iniciadas** é garantido por construção. As demais podem cruzar
legitimamente: tráfego orgânico gera visita sem clique no anúncio, e o Meta
subnotifica cliques.

**Dois bugs de contagem corrigidos:**
1. **IC contava EVENTOS, não visitantes.** O `px.js` dispara um IC a cada clique
   no link de checkout, então quem clicava duas vezes contava duas. Medido no
   banco: **31 eventos para 25 visitantes**. Agora deduplica por
   `fbclid → eventId → id da linha`.
2. **Etapa anterior zerada mostrava "0,0%"** em vez de "—". Com o Facebook não
   sincronizado ("cliques" = 0), "Visitas" exibia 0,0% tendo 220 visitas.
   Conversão sobre zero é **indefinida**, não zero.

> ⚠️ **Passar de 100% não é escondido nem clampado.** A etapa aparece em âmbar
> com "⚠" e o tooltip diz de qual fonte cada número veio. Clampar em 100%
> esconderia justamente o sinal de que as fontes não estão casando — que é
> informação de diagnóstico, não ruído. O tooltip mostra as duas taxas (vs.
> etapa anterior e vs. topo).

### IC e CPI no Gerenciador — agora preenchidos

O `PixelEvent` não guarda campanha, mas guarda **`fbclid`** — e é por ele que se
chega ao `Click`, que tem os UTMs. `overview.ts` faz o mesmo caminho de
atribuição das vendas: `fbclid → Click.utmCampaign/utmContent → splitPipe` (id do
Facebook, com fallback por nome). **Não precisou de migration.**

- **Campanha:** por `utm_campaign`; se nada casar, cai na soma dos anúncios.
- **Anúncio:** por `utm_content`. **Conjunto:** soma dos anúncios (não tem UTM próprio).
- **CPI** = gasto ÷ IC, em `ads/metrics.ts`, `null` quando IC é 0.

> ⚠️ **IC só é atribuído quando o evento tem `fbclid`.** Visitante que chegou sem
> `fbclid` (orgânico, ou o script de UTM não instalado) entra no funil do
> Dashboard mas **não** na coluna IC do Gerenciador — lá o total pode ser menor.

**Testado:** 11 asserções de formatação/ROI e 6 ponta a ponta com conta semeada
(3 eventos de IC de 2 visitantes → IC = 2 em campanha/conjunto/anúncio, CPI
120÷2 = 60, ROI −1,00x sem faturamento). No funil real do dono: IC 31→25 e as
taxas saíram 11,36% → 56,00% → 14,29%, nenhuma acima de 100%. Dados de teste
removidos.

### Filtro do Dashboard abre em HOJE

`dashPeriod` inicial era `"7d"`. O período **não é persistido de propósito** — é
filtro de sessão, não preferência —, então mudar o padrão bastou.

## 📅 Períodos: UMA fonte, três telas (30/07/2026 — Prompt C)

`src/lib/periodo.ts` é a **fonte única** das janelas de data, usada pelo seletor da
interface E pelo servidor. `src/components/dashboard/ui/FiltroPeriodo.tsx` é o
**único** seletor de período da ferramenta.

### 🔴 Havia TRÊS implementações da mesma regra — e duas estavam erradas

`resolveRange` (`dashboard/metrics.ts`), `rangeStart` (`ads/overview.ts`) e outro
`rangeStart` (`ads/creatives.ts`), este último com o comentário *"mesma janela do
gerenciador"* — a confissão de que era cópia.

**Os dois `rangeStart` devolviam só o INÍCIO** e filtravam `timestamp >= start`,
isto é "do início até agora". Isso funcionava por acidente: os únicos períodos
eram Hoje/7d/30d, que terminam hoje. Ao entrar "Ontem" e "Mês passado" no
seletor, aquilo passaria a trazer **a janela escolhida mais tudo o que veio
depois** — "Mês passado" incluindo o mês atual.

**Provado contra o banco de dev** (gasto todo em julho, hoje é 30/07):

| Período | Gasto retornado | |
|---|---|---|
| `mesPassado` (junho) | **R$ 0,00** | ✅ correto — com o código antigo daria 800 |
| `mesAtual` (julho) | R$ 800,00 | ✅ |
| `ontem` (29/07) | R$ 800,00 | ✅ |
| `hoje` (30/07) | R$ 0,00 | ✅ |

### O que a centralização entregou

- **7 períodos** em vez de 3: Hoje · Ontem · Últimos 7 · Últimos 30 · Este mês ·
  Mês passado · Personalizado — nas **três** telas (Dashboard, Gerenciador,
  Criativos). O Gerenciador e os Criativos não tinham calendário nenhum.
- **"Ontem" ganha detalhamento por HORA** de graça: a granularidade passou a ser
  "hora quando a janela é de um dia", em vez de "hora só quando é hoje".
- `DashPeriod` e `CreativePeriod` viraram **alias de `PeriodoNome`**. Eram três
  uniões separadas — um período novo exigia editar três arquivos para funcionar.

> ### ⛔ O período viaja como NOME, nunca como intervalo de datas
> `?period=mesPassado`, não `?from=…&to=…`. Quem resolve a janela é o servidor,
> com o **fuso do usuário** — que o navegador não conhece de forma confiável.
> Resolver data no cliente foi exatamente o bug de "o hoje do calendário era o do
> navegador". A única exceção é `custom`, que **é** um intervalo por definição.
>
> ⚠️ **Valide com `ehPeriodoValido`, não com uma lista escrita na rota.** As três
> rotas tinham `["hoje","7d","30d"].includes(...)` — uma lista local fica para trás
> a cada período novo e o valor cai no fallback **em silêncio**.
>
> ⚠️ **O relógio de `janelaDoPeriodo` é injetável (`agora`).** Não é luxo de teste:
> trocar `Date.now` de fora **não funciona**, porque `new Date()` lê o relógio
> interno direto — foi assim que 8 asserções minhas falharam antes de eu perceber
> que o teste estava errado, não o código.
>
> ⚠️ **Aritmética de mês é por STRING.** Nada de `new Date(ano, mes-1, 1)`: o
> construtor trabalha no fuso do PROCESSO, que na Vercel é UTC. O último dia do mês
> passado é `primeiroDoMesAtual − 1 dia` em chave de dia.

**`npm run test:periodo` — 33 asserções**, com `TZ=UTC` forçado (o fuso da
Vercel): virada de ano num fuso +14, fevereiro bissexto, o mesmo instante dando
dias diferentes em fusos diferentes, `custom` invertido, e querystring adulterada.

### Botão "Atualizar" (C1) — já existia; faltava a idade do dado

Posição, spinner, `disabled` durante a atualização, ausência de reload e mensagem
de erro **já estavam feitos**. O que faltava era o **"Atualizado há Xs"**: o
`syncLabel` existia no estado e só era exibido no Gerenciador — no Dashboard, que
é onde fica o botão, não havia como saber se o número é de agora ou de 20 minutos
atrás. Ele desaparece enquanto sincroniza, porque aí quem informa é o botão.

## 💰 Faturamento líquido, Lucro e cores (30/07/2026 — Prompt B)

`src/lib/financeiro.ts` é a **conta única** de líquido, lucro, margem, ROI e das
cores dessas métricas.

### 🔴 Coprodução e custo de produto NÃO EXISTIAM

`ExpenseType` tinha só `TAXA_GATEWAY`, `IMPOSTO` e `DESPESA_RECORRENTE`. Sem os
dois tipos novos, o Faturamento Líquido só descontaria gateway e imposto e
apareceria **maior que a realidade** — continuando plausível, que é o pior tipo de
erro. Migration `20260730120000` acrescenta `COPRODUCAO` e `CUSTO_PRODUTO`
(**aditiva**: `ALTER TYPE ... ADD VALUE`, nenhuma linha muda de tipo), e a tela de
Taxas ganhou dois cards para cadastrá-los.

### A cadeia

```
  Faturamento bruto        (vendas APROVADAS no período)
− Taxa de gateway          (por FORMA DE PAGAMENTO, não sobre o total)
− Coprodução / afiliados
− Impostos
− Custo de produto
= FATURAMENTO LÍQUIDO
− Gasto com anúncios
− Despesas recorrentes
= LUCRO
```

> ### ⚠️ Desconto não cadastrado vale ZERO — e `faltando` é o que denuncia
> Nada é obrigatório, para a conta não quebrar. O efeito colateral é que o líquido
> fica **maior que a realidade** e o número continua plausível. Por isso
> `Composicao.faltando` devolve quais descontos estão ausentes, e o aviso âmbar da
> tela de Taxas agora cobre os **quatro** (antes só gateway e imposto).
> **Não remova esse campo sem tornar as taxas obrigatórias.**

> ### ⚠️ A cor vem de `corFinanceira`, nunca decidida na view
>
> **O equilíbrio do ROAS é 1x; o do ROI é 0.** São escalas diferentes e não podem
> usar o mesmo corte: `ROAS 0,80x` é um número positivo e **é prejuízo** — cada
> R$ 1 de anúncio devolveu 80 centavos. O mesmo `0,80` no ROI é lucro de 80%.
>
> ⚠️ **Sem GASTO não existe ROAS** (a conta é faturamento ÷ gasto). Nesse caso
> quem chama passa `null` e a cor fica neutra — senão um painel zerado mostraria
> `0,00x` em vermelho, o mesmo defeito que o ROI tinha.
>
> - **Abaixo do equilíbrio é sempre VERMELHO** — prejuízo tem de saltar aos olhos.
> - **ROI positivo é VERDE**; é uma nota de desempenho.
> - **Lucro e margem positivos ficam na cor NORMAL, sem `+`.** Pintar todo lucro
>   de verde tira o contraste de quando algo dá errado, e `+R$ 340` parece erro de
>   digitação.
>
> O `AdsTable` tinha um ternário inline pintando lucro **positivo de verde** —
> contra a regra. Foi substituído, e o ROI da tabela também passou a ter cor.

> ### ⚠️ `lucroLiquido` e `lucro` são chaves DIFERENTES
> `METRICAS.lucro` já existia e descreve o lucro **bruto** do Gerenciador ("não
> desconta taxas, impostos nem despesas"). O card do Dashboard usa
> **`lucroLiquido`**, com explicação própria. Uma chave só faria o card do
> Dashboard exibir a explicação que diz o **oposto** do que ele faz.

- **Vendas pendentes virou VALOR.** "12 vendas pendentes" não diz quanto dinheiro
  está na mesa; `R$ 240,00` diz. A contagem ficou como linha de apoio.
- **Card sem delta deixou de imprimir "vs. período anterior"** — um rótulo de
  comparação num card que não compara nada. Cinco cards caíam nisso; agora usam o
  `trendLabel`, que diz algo de verdade.
- Líquido e Lucro **não têm delta** de propósito: dependem das taxas do período,
  que não são reprocessadas na janela anterior. Delta inventado seria pior.
- Os dois cards estão em **"Métricas disponíveis"**, arrastáveis. **Não entram no
  layout padrão**, que é a transcrição aprovada de 12 KPIs.

**`npm run test:financeiro` — 33 asserções**: cadeia completa, taxa incidindo só
sobre a própria forma de pagamento, desconto ausente valendo zero **e** denunciado,
ROI `null` com custo zero (não `0`), piso de −1,00x, valor fixo, e as 6 regras de cor.
