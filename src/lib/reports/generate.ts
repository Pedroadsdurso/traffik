import { computeDashboard } from "@/lib/dashboard/metrics";
import { prisma } from "@/lib/prisma";
import type { ReportPattern } from "@/generated/prisma/enums";

function brl(v: number | null): string {
  // ⚠️ Indefinido não vira "R$ 0,00". Um relatório que diz "CPA R$ 0,00" num dia
  // sem venda afirma aquisição de graça — e chega por notificação, onde não há
  // tooltip nem contexto para desfazer a leitura.
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Multiplicador (ROAS). `null` = indefinido, e o relatório diz isso. */
function mult(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(2)}x`;
}

/** Monta o conteúdo do relatório conforme o padrão escolhido pelo usuário. */

/**
 * O trecho da margem, ou NADA.
 *
 * ⛔ Em PROSA, indefinido some — nao vira "—". A regra "vira traco" e de tabela
 * e de card, onde a celula existe e precisa dizer que esta vazia. Aqui o texto
 * chega por notificacao, corrido: "12 vendas · ROAS 3,20x" e uma frase
 * completa; "12 vendas · ROAS 3,20x · margem —" parece defeito de formatacao.
 */
function margem(v: number | null): string {
  return v === null ? "" : ` · margem ${v.toFixed(0)}%`;
}

function buildContent(
  pattern: ReportPattern,
  k: {
    revenue: number;
    spend: number;
    profit: number;
    sales: number;
    roas: number | null;
    margin: number | null;
    cpa: number | null;
    ticket: number | null;
  },
): { title: string; content: string } {
  if (pattern === "RESUMO_DETALHADO") {
    return {
      title: "📊 Resumo detalhado de hoje",
      content: `Faturamento ${brl(k.revenue)} · Gasto ${brl(k.spend)} · Vendas ${k.sales} · ROAS ${mult(k.roas)} · Ticket ${brl(k.ticket)} · CPA ${brl(k.cpa)} · Lucro ${brl(k.profit)}`,
    };
  }
  if (pattern === "NOTIFICACOES_CRIATIVAS") {
    return {
      title: "🎨 Performance de hoje",
      content: `${k.sales} vendas · ROAS ${mult(k.roas)}${margem(k.margin)}`,
    };
  }
  // STATUS_LUCRO
  const emoji = k.profit >= 0 ? "🟢" : "🔴";
  return {
    title: `${emoji} Status de lucro`,
    content: `Lucro ${brl(k.profit)} · Faturamento ${brl(k.revenue)}${margem(k.margin)}`,
  };
}

/** Gera o relatório do dia de um usuário e cria a Notification correspondente. */
export async function generateReportNotification(userId: string, pattern: ReportPattern): Promise<void> {
  const data = await computeDashboard(userId, { period: "hoje", account: "todas", product: "todos", source: "todas" });
  const { title, content } = buildContent(pattern, data.kpis);
  await prisma.notification.create({
    data: { userId, type: "RELATORIO", title, content, data: { kpis: data.kpis } as object },
  });
}
