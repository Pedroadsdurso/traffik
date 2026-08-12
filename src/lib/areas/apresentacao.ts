/**
 * A LINGUAGEM da tela de Áreas — pura, sem JSX e sem prisma.
 *
 * ⛔ `CAMPOS_DE_RECORTE` não é uma lista de rótulos: é a declaração de que
 * `products` e `sources` **são recorte de painel de verdade**. Medido em
 * 12/08/2026, contando referências fora de `actions/workspaces.ts`:
 *
 *   `sources`  → **21** referências, inclusive `dashboard/metrics.ts`
 *   `products` → **19**
 *
 * Isso importa porque o `CLAUDE.md` os declarava **mortos** até esta data — uma
 * entrada que autorizava deletar código vivo. Se alguém reencontrar a afirmação
 * em algum lugar, o comando que decide é um `grep` com contagem, não a memória.
 */

/** A paleta de cor de área. Sete tons, todos legíveis como ponto de 10px. */
export const CORES_DE_AREA: readonly string[] = [
  "#3B82F6",
  "#22D3EE",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#64748B",
];

export type CampoDeRecorte = {
  chave: "products" | "sources";
  titulo: string;
  /** O que ele FAZ com o painel — não o que ele é. */
  apoio: string;
  exemplo: string;
};

export const CAMPOS_DE_RECORTE: readonly CampoDeRecorte[] = [
  {
    chave: "products",
    titulo: "Produtos",
    apoio: "Só as vendas destes produtos entram nas métricas desta área.",
    exemplo: "Ex: Curso de Tráfego",
  },
  {
    chave: "sources",
    titulo: "Fontes de tráfego",
    apoio: "Só os cliques destas fontes entram. Vazio = todas.",
    exemplo: "Ex: facebook",
  },
];

/**
 * O resumo de uma área, em uma linha — o que ela recorta.
 *
 * ⚠️ Diz o EFEITO, não a contagem crua. `0 contas · 0 produtos` é verdade e não
 * informa; **"vê todas as contas"** é a mesma verdade dita do jeito que decide
 * alguma coisa. Recorte vazio significa "sem filtro", e é o oposto do que a
 * contagem sugere a quem bate o olho.
 */
export function resumoDoRecorte(a: {
  accountIds: string[];
  products: string[];
  sources: string[];
  webhookIds: string[];
}): string {
  const partes: string[] = [];

  partes.push(
    a.accountIds.length === 0
      ? "todas as contas"
      : `${a.accountIds.length} ${a.accountIds.length === 1 ? "conta" : "contas"}`,
  );
  if (a.webhookIds.length > 0) {
    partes.push(`${a.webhookIds.length} ${a.webhookIds.length === 1 ? "webhook" : "webhooks"}`);
  }
  if (a.products.length > 0) {
    partes.push(`${a.products.length} ${a.products.length === 1 ? "produto" : "produtos"}`);
  }
  if (a.sources.length > 0) {
    partes.push(`${a.sources.length} ${a.sources.length === 1 ? "fonte" : "fontes"}`);
  }

  return partes.join(" · ");
}
