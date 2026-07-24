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

/** Grid de 12 colunas; `rowHeight` de 40px casa com a altura dos cards atuais. */
export const GRID_COLS = { desktop: 12, mobile: 4 } as const;
export const GRID_ROW_HEIGHT = 40;
export const GRID_BREAKPOINTS = { desktop: 900, mobile: 0 } as const;

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
 * Layout padrão: reproduz o dashboard como ele era antes do grid — faixa de
 * KPIs no topo, gráfico grande, dois lado a lado, e as tabelas embaixo.
 * Só os 8 primeiros KPIs entram; o resto fica em "Métricas Disponíveis".
 */
export function defaultLayout(viewport: "desktop" | "mobile"): GridItem[] {
  const cols = GRID_COLS[viewport];
  const items: GridItem[] = [];
  let y = 0;

  const kpisVisiveis = KPI_BLOCKS.slice(0, 8);
  const kpiW = viewport === "desktop" ? 3 : 2;
  const porLinha = Math.max(1, Math.floor(cols / kpiW));

  kpisVisiveis.forEach((b, idx) => {
    items.push({
      i: b.id,
      x: (idx % porLinha) * kpiW,
      y: y + Math.floor(idx / porLinha) * b.h,
      w: kpiW,
      h: b.h,
      minW: b.minW,
      minH: b.minH,
    });
  });
  y += Math.ceil(kpisVisiveis.length / porLinha) * 3;

  const empilhados: [string, number][] =
    viewport === "desktop"
      ? [
          ["chart:receita", 12],
          ["chart:produtos", 6],
          ["chart:fontes", 6],
          ["chart:pagamentos", 12],
          ["chart:funil", 12],
          ["chart:feed", 12],
        ]
      : [
          ["chart:receita", 4],
          ["chart:produtos", 4],
          ["chart:fontes", 4],
          ["chart:pagamentos", 4],
          ["chart:funil", 4],
          ["chart:feed", 4],
        ];

  let x = 0;
  for (const [id, w] of empilhados) {
    const def = BLOCK_BY_ID.get(id)!;
    if (x + w > cols) {
      x = 0;
      y += def.h;
    }
    items.push({ i: id, x, y, w, h: def.h, minW: def.minW, minH: def.minH });
    x += w;
    if (x >= cols) {
      x = 0;
      y += def.h;
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
