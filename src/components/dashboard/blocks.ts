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
    ["liquido", "Faturamento líquido"],
    ["lucroLiquido", "Lucro"],
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
 * # Layout PADRÃO do produto — transcrito do arranjo do usuário (30/07/2026)
 *
 * É o que toda **área de trabalho nova** e toda **conta nova** vê ao abrir o
 * Dashboard pela primeira vez.
 *
 * ⚠️ **É uma TABELA EXPLÍCITA, não um algoritmo de fluxo.** A versão anterior
 * empacotava os blocos em fileiras que somavam 12, e o resultado era correto mas
 * genérico: pares lado a lado, tudo do mesmo tamanho. O usuário montou o arranjo
 * dele arrastando e pediu para virar o padrão — então o padrão é a transcrição
 * dele, coordenada por coordenada. Fluxo automático não reproduz uma composição
 * feita a olho.
 *
 * ## A composição: duas colunas de larguras diferentes
 *
 * ```
 *  ┌ 12 KPIs, 6 por fileira (w=2) ─────────────────────────────────────┐
 *  │ Fat. │ Gasto │ ROAS │ Ticket │ CTR  │ Reemb.                      │
 *  │ Pend.│ Vendas│ ROI  │ CPA    │ ARPU │ Margem                      │
 *  ├──────────── ESQUERDA (w=7) ──────────┬──── DIREITA (w=5) ─────────┤
 *  │ Funil de conversão                   │ Vendas por país            │
 *  │ Atividade recente                    │ Taxa de aprovação          │
 *  │ Fat. vs gasto (4) │ Produto (3)      │ Vendas por dia             │
 *  │ Fonte (3) │ Pagamento (4)            │ Lucro por horário          │
 *  │                                      │ Vendas por horário         │
 *  └──────────────────────────────────────┴────────────────────────────┘
 * ```
 *
 * As duas colunas **terminam na mesma linha** (23 unidades cada): é isso que
 * elimina o rasgo de espaço vazio no pé de uma delas.
 *
 * ⚠️ **Ao mexer numa altura, reequilibre a outra coluna.** Esquerda
 * `7+6+5+5 = 23`; direita `7+4+4+4+4 = 23`. Desbalanceou, sobra buraco — e o
 * `react-grid-layout` compacta na vertical, então o buraco aparece no fim de uma
 * coluna em vez de dar erro.
 *
 * ⚠️ **`kpi:chargeback` fica FORA** de propósito: são 12 KPIs, não 13. Continua
 * disponível em "Métricas disponíveis".
 */
interface Pos {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** KPIs: 6 por fileira, `w=2` num grid de 12. A ordem é a da tela do usuário. */
const KPIS_PADRAO: MetricKey[] = [
  // fileira 1
  "faturamento", "gasto", "roas", "ticket", "ctr", "reembolsadas",
  // fileira 2
  "pendentes", "vendas", "roi", "cpa", "arpu", "margem",
];

const KPI_W = 2;
const KPI_H = 3;
// ⚠️ No desktop dão 6 por fileira (12 colunas ÷ w=2), no mobile 2 (4 ÷ 2). Por
// isso **onde os gráficos começam é calculado dentro da função** e não numa
// constante: um valor fixo jogaria os gráficos por cima dos KPIs no mobile.

/** Gráficos, com posição e tamanho explícitos (grid de 12 colunas). */
const GRAFICOS_PADRAO: Pos[] = [
  // ── Coluna esquerda (w=7) ──
  { id: "chart:funil", x: 0, y: 0, w: 7, h: 7 },
  { id: "chart:feed", x: 0, y: 7, w: 7, h: 6 },
  { id: "chart:receita", x: 0, y: 13, w: 4, h: 5 },
  { id: "chart:produtos", x: 4, y: 13, w: 3, h: 5 },
  { id: "chart:fontes", x: 0, y: 18, w: 3, h: 5 },
  { id: "chart:pagamentos", x: 3, y: 18, w: 4, h: 5 },

  // ── Coluna direita (w=5) ──
  { id: "chart:paises", x: 7, y: 0, w: 5, h: 7 },
  { id: "chart:aprovacao", x: 7, y: 7, w: 5, h: 4 },
  { id: "chart:vendasDia", x: 7, y: 11, w: 5, h: 4 },
  { id: "chart:lucroHora", x: 7, y: 15, w: 5, h: 4 },
  { id: "chart:vendasHora", x: 7, y: 19, w: 5, h: 4 },
];

export function defaultLayout(viewport: "desktop" | "mobile"): GridItem[] {
  const cols = GRID_COLS[viewport];
  const items: GridItem[] = [];

  // ── KPIs ──
  // No mobile o grid tem 4 colunas, então `w=2` dá 2 por fileira sozinho.
  const kpiW = Math.min(KPI_W, cols);
  const porFileira = Math.max(1, Math.floor(cols / kpiW));

  KPIS_PADRAO.forEach((metric, idx) => {
    const def = BLOCK_BY_ID.get(`kpi:${metric}`);
    // Um id inválido aqui seria um bloco fantasma no layout de todo mundo.
    if (!def) return;
    items.push({
      i: def.id,
      x: (idx % porFileira) * kpiW,
      y: Math.floor(idx / porFileira) * KPI_H,
      w: kpiW,
      h: KPI_H,
      minW: def.minW,
      minH: def.minH,
    });
  });

  const yGraficos = Math.ceil(KPIS_PADRAO.length / porFileira) * KPI_H;

  // ── Gráficos ──
  if (viewport === "mobile") {
    // 4 colunas não comportam duas colunas de gráfico sem deixar as duas
    // ilegíveis: no mobile tudo vira largura total, empilhado na ORDEM VISUAL
    // do desktop (esquerda antes de direita na mesma altura).
    let y = yGraficos;
    for (const g of [...GRAFICOS_PADRAO].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const def = BLOCK_BY_ID.get(g.id);
      if (!def) continue;
      const h = Math.max(def.minH, g.h);
      items.push({ i: g.id, x: 0, y, w: cols, h, minW: def.minW, minH: def.minH });
      y += h;
    }
    return items;
  }

  for (const g of GRAFICOS_PADRAO) {
    const def = BLOCK_BY_ID.get(g.id);
    if (!def) continue;
    items.push({
      i: g.id,
      x: g.x,
      y: yGraficos + g.y,
      // Respeita o mínimo do bloco: uma tabela escrita à mão não pode entregar
      // um bloco menor do que o tamanho em que ele fica ilegível.
      w: Math.max(def.minW, g.w),
      h: Math.max(def.minH, g.h),
      minW: def.minW,
      minH: def.minH,
    });
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
