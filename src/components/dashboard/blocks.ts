/**
 * Registro dos blocos do Dashboard (Bloco 2).
 *
 * Fonte única da verdade sobre **o que existe** no dashboard, o tamanho padrão
 * de cada bloco e o mínimo abaixo do qual ele fica ilegível. O grid, o painel de
 * "Métricas Disponíveis" e o layout padrão são todos derivados daqui — assim
 * adicionar uma métrica nova (Bloco 4) é acrescentar uma entrada nesta lista.
 */

import type { MetricKey } from "./types";

export type BlockKind = "kpi" | "chart";

export interface BlockDef {
  /** Id usado no layout do react-grid-layout (`i`). */
  id: string;
  label: string;
  kind: BlockKind;
  /** Para blocos de KPI, qual métrica ele mostra. */
  metric?: MetricKey;
  /** Tamanho padrão em unidades do grid (12 colunas). */
  w: number;
  h: number;
  minW: number;
  minH: number;
}

/**
 * Grid de 12 colunas; `rowHeight` de 40px casa com a altura dos cards atuais.
 *
 * ⚠️ **Quatro breakpoints, não dois.** Com apenas `desktop:900 / mobile:0`, tudo
 * acima de 900px usava 12 colunas — inclusive 1024px e, principalmente, **zoom
 * alto**: a 150% uma tela de 1920 vira ~1280 CSS px, e 12 colunas espremidas
 * faziam cada KPI virar uma tira estreita, com o conteúdo cortado e o layout
 * parecendo embaralhado. Reduzir as colunas junto com a largura é o que faz o
 * zoom se comportar.
 *
 * Os layouts salvos continuam sendo DOIS (`desktop` e `mobile`) — `laptop` e
 * `tablet` reaproveitam o layout vizinho. Guardar quatro exigiria migration e o
 * ganho seria pequeno: o que muda entre eles é o número de colunas, e o RGL já
 * reflui sozinho.
 */
export const GRID_COLS = { desktop: 12, laptop: 12, tablet: 6, mobile: 4 } as const;
export const GRID_ROW_HEIGHT = 40;
export const GRID_BREAKPOINTS = { desktop: 1280, laptop: 940, tablet: 640, mobile: 0 } as const;

/** Breakpoint do RGL → viewport que persistimos. */
export function viewportDoBreakpoint(bp: string): "desktop" | "mobile" {
  return bp === "desktop" || bp === "laptop" ? "desktop" : "mobile";
}

/** KPIs — cards pequenos. A ordem aqui é a ordem do layout padrão. */
const KPI_BLOCKS: BlockDef[] = (
  [
    ["faturamento", "Faturamento"],
    ["gasto", "Gasto total"],
    ["roas", "ROAS"],
    ["roi", "ROI"],
    ["margem", "Margem de lucro"],
    ["vendas", "Vendas"],
    ["cpa", "CPA"],
    ["ticket", "Ticket médio"],
    ["arpu", "ARPU"],
    ["ctr", "CTR"],
    ["pendentes", "Pendentes"],
    ["reembolsadas", "Reembolsadas"],
    ["chargeback", "Chargeback"],
  ] as [MetricKey, string][]
).map(([metric, label]) => ({
  id: `kpi:${metric}`,
  label,
  kind: "kpi" as const,
  metric,
  w: 3,
  h: 3,
  minW: 2,
  minH: 3,
}));

/** Gráficos e tabelas — blocos grandes. */
const CHART_BLOCKS: BlockDef[] = [
  { id: "chart:receita", label: "Faturamento vs. gasto", kind: "chart", w: 12, h: 7, minW: 4, minH: 5 },
  { id: "chart:produtos", label: "Vendas por produto", kind: "chart", w: 6, h: 6, minW: 3, minH: 4 },
  { id: "chart:fontes", label: "Vendas por fonte", kind: "chart", w: 6, h: 6, minW: 3, minH: 4 },
  { id: "chart:pagamentos", label: "Vendas por pagamento", kind: "chart", w: 6, h: 6, minW: 3, minH: 4 },
  { id: "chart:funil", label: "Funil de conversão", kind: "chart", w: 12, h: 7, minW: 4, minH: 5 },
  { id: "chart:feed", label: "Atividade recente", kind: "chart", w: 12, h: 8, minW: 4, minH: 5 },
  // Bloco 4 — entram desativados por padrão (aparecem em "Métricas disponíveis").
  { id: "chart:vendasHora", label: "Vendas por horário", kind: "chart", w: 6, h: 6, minW: 3, minH: 4 },
  { id: "chart:lucroHora", label: "Lucro por horário", kind: "chart", w: 6, h: 6, minW: 3, minH: 4 },
  { id: "chart:vendasDia", label: "Vendas por dia", kind: "chart", w: 12, h: 6, minW: 4, minH: 4 },
  // Bloco 5 — também entram desativados.
  { id: "chart:paises", label: "Vendas por país", kind: "chart", w: 6, h: 8, minW: 3, minH: 5 },
  { id: "chart:aprovacao", label: "Taxa de aprovação", kind: "chart", w: 6, h: 6, minW: 3, minH: 4 },
];

export const ALL_BLOCKS: BlockDef[] = [...KPI_BLOCKS, ...CHART_BLOCKS];

export const BLOCK_BY_ID = new Map(ALL_BLOCKS.map((b) => [b.id, b]));

/** Item de layout do react-grid-layout. */
export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/**
 * # Layout PADRÃO do produto
 *
 * É o que toda **área de trabalho nova** e toda **conta nova** vê ao abrir o
 * Dashboard pela primeira vez. Definido pelo usuário em 30/07/2026.
 *
 * ⚠️ **Esta lista é a fonte da verdade do layout inicial.** Antes entravam só os
 * 8 primeiros KPIs e 6 gráficos, e o resto — país, funil, taxa de aprovação,
 * horário, dia — nascia escondido em "Métricas disponíveis". Quem criava uma
 * área nova via um dashboard pobre e não descobria o resto.
 *
 * ## A ordem tem intenção, não é alfabética
 *
 * 1. **Dinheiro primeiro** (faturamento, gasto, lucro em multiplicadores) —
 *    é o que se olha antes de qualquer coisa.
 * 2. **Eficiência** (CPA, CTR, ARPU, ticket) — o "quanto custa e quanto rende".
 * 3. **Saúde da venda** (pendentes, reembolsadas) — o que ameaça o número acima.
 * 4. **A série temporal grande** (faturamento vs. gasto), que é o gráfico que o
 *    usuário mais olha, em largura total.
 * 5. **Funil**, que explica POR QUE o número é esse.
 * 6. **Repartições** (produto, fonte, pagamento, país) em pares.
 * 7. **Ritmo** (horário, dia) e **qualidade** (taxa de aprovação).
 * 8. **Atividade recente** no fim: é para conferir evento a evento, não para
 *    resumir — quem quer resumo já leu tudo acima.
 */
const PADRAO_KPIS: MetricKey[] = [
  "faturamento",
  "gasto",
  "roas",
  "roi",
  "cpa",
  "ctr",
  "arpu",
  "ticket",
  "pendentes",
  "reembolsadas",
];

/**
 * Gráficos do layout padrão, com a largura em colunas do grid de 12.
 *
 * ⚠️ As larguras SOMAM 12 por fileira. Se você mudar uma, ajuste a parceira —
 * senão o `react-grid-layout` empurra o bloco para a linha seguinte e abre um
 * buraco no lugar dele.
 */
const PADRAO_GRAFICOS: [id: string, largura: number][] = [
  ["chart:receita", 12],
  ["chart:funil", 12],
  ["chart:produtos", 6],
  ["chart:fontes", 6],
  ["chart:pagamentos", 6],
  ["chart:paises", 6],
  ["chart:vendasHora", 6],
  ["chart:lucroHora", 6],
  ["chart:vendasDia", 6],
  ["chart:aprovacao", 6],
  ["chart:feed", 12],
];

export function defaultLayout(viewport: "desktop" | "mobile"): GridItem[] {
  const cols = GRID_COLS[viewport];
  const items: GridItem[] = [];
  let y = 0;

  // ── Faixa de KPIs ──
  const kpiW = viewport === "desktop" ? 3 : 2;
  const porLinha = Math.max(1, Math.floor(cols / kpiW));
  const kpiH = 3;

  PADRAO_KPIS.forEach((metric, idx) => {
    const def = BLOCK_BY_ID.get(`kpi:${metric}`);
    // Um id inválido aqui seria um bloco fantasma no layout de todo mundo.
    if (!def) return;
    items.push({
      i: def.id,
      x: (idx % porLinha) * kpiW,
      y: y + Math.floor(idx / porLinha) * kpiH,
      w: kpiW,
      h: kpiH,
      minW: def.minW,
      minH: def.minH,
    });
  });
  y += Math.ceil(PADRAO_KPIS.length / porLinha) * kpiH;

  // ── Gráficos ──
  // No mobile tudo vira largura total: 4 colunas não comportam dois lado a lado
  // sem deixar cada gráfico ilegível.
  let x = 0;
  let alturaDaFileira = 0;
  for (const [id, larguraDesktop] of PADRAO_GRAFICOS) {
    const def = BLOCK_BY_ID.get(id);
    if (!def) continue;
    const w = viewport === "desktop" ? Math.min(larguraDesktop, cols) : cols;

    // Não cabe na fileira atual: desce pela altura do MAIS ALTO da fileira, não
    // pela altura deste bloco — senão um bloco baixo faz o próximo invadir a
    // fileira anterior e o RGL reflui tudo.
    if (x + w > cols) {
      y += alturaDaFileira;
      x = 0;
      alturaDaFileira = 0;
    }

    items.push({ i: id, x, y, w, h: def.h, minW: def.minW, minH: def.minH });
    x += w;
    alturaDaFileira = Math.max(alturaDaFileira, def.h);

    if (x >= cols) {
      y += alturaDaFileira;
      x = 0;
      alturaDaFileira = 0;
    }
  }

  return items;
}

/**
 * Saneia um layout vindo do banco: descarta blocos que não existem mais e
 * recoloca os limites mínimos (o cliente pode ter enviado qualquer coisa).
 */
export function sanitizeLayout(raw: unknown): GridItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GridItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const id = typeof o.i === "string" ? o.i : null;
    const def = id ? BLOCK_BY_ID.get(id) : null;
    if (!id || !def) continue; // bloco removido do código
    const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
    out.push({
      i: id,
      x: Math.max(0, num(o.x, 0)),
      y: Math.max(0, num(o.y, 0)),
      w: Math.max(def.minW, num(o.w, def.w)),
      h: Math.max(def.minH, num(o.h, def.h)),
      minW: def.minW,
      minH: def.minH,
    });
  }
  return out;
}
