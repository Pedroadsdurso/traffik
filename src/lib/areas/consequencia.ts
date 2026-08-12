import type { OpcoesExclusao, PreviaExclusao } from "@/lib/areas/exclusao";

/**
 * O QUE A EXCLUSÃO DE UMA ÁREA **PROMOVE** — puro, sem JSX e sem prisma.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 A CONFIRMAÇÃO TEM DE DIZER O QUE A EXCLUSÃO PROMOVE, NÃO SÓ O QUE APAGA
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Exigência do dono, 12/08/2026, e o motivo é a linha vermelha do `CLAUDE.md`:
 *
 *   `AutomationRule.workspaceId` NULO = regra **GLOBAL**, age em TODAS as contas
 *   `Expense.workspaceId`        NULO = despesa vale para **TODAS** as áreas
 *
 * Nas duas, `onDelete: SetNull` **não é estado neutro — é promoção de escopo**.
 * Foi assim que excluir uma área transformou "pause as campanhas desta operação"
 * em "pause as de TODAS as contas", com a regra ainda ativa e dinheiro real em
 * jogo.
 *
 * ⛔ E UM NÚMERO GENÉRICO NÃO FAZ NINGUÉM PARAR. "Isto não pode ser desfeito" é
 * ruído; **"3 regras vão passar a pausar campanhas de todas as operações"** é
 * uma frase que se lê duas vezes. Por isso a contagem é REAL, vinda da prévia,
 * e vai no diálogo antes de o botão existir.
 *
 * ⚠️ E O TEXTO SEGUE A OPÇÃO SELECIONADA, nunca é fixo. Os padrões de
 * `OpcoesExclusao` já são os seguros (`regras` e `despesas` nascem em
 * `excluir`), então **na configuração padrão não há promoção nenhuma** — e a
 * frase não pode alarmar sobre algo que não vai acontecer. Ela aparece quando, e
 * só quando, o usuário troca para `mover`.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/** Uma consequência declarada, pronta para a tela desenhar. */
export type Consequencia = {
  /** `promocao` = amplia escopo. `perda` = dado que some. `neutro` = só muda de dono. */
  tom: "promocao" | "perda" | "neutro";
  texto: string;
};

const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

/**
 * As consequências da exclusão, na ordem em que importam.
 *
 * ⚠️ ORDEM: promoção primeiro, perda depois, neutro por último. Quem lê um
 * diálogo de confirmação lê as duas primeiras linhas — e a promoção é a única
 * que volta a AGIR sozinha depois que a tela fecha.
 */
export function consequenciasDaExclusao(
  previa: PreviaExclusao,
  opcoes: OpcoesExclusao,
): Consequencia[] {
  const fora: Consequencia[] = [];

  /* ── promoção de escopo ────────────────────────────────────────────────────
     As duas únicas que ampliam alcance. O texto nomeia o EFEITO ("passam a
     valer para todas as áreas"), não o mecanismo ("workspaceId vira nulo") —
     o usuário não conhece a coluna, e conhece o efeito. */

  const regras = previa.regras.length;
  if (regras > 0 && opcoes.regras === "mover") {
    /* 🔴 As que não têm conta específica são as mais caras: movidas para a
       Principal, elas chegam aptas a agir sobre TODAS as campanhas de lá. */
    const amplas = previa.regras.filter((r) => r.semContaEspecifica).length;
    const ativas = previa.regras.filter((r) => r.ativa).length;

    fora.push({
      tom: "promocao",
      texto:
        `${regras} ${plural(regras, "regra passa", "regras passam")} para a área Principal` +
        (amplas > 0
          ? ` — ${amplas === regras ? (regras === 1 ? "ela não está limitada" : "elas não estão limitadas") : `${amplas} ${plural(amplas, "delas não está limitada", "delas não estão limitadas")}`} a contas específicas, ` +
            `então ${plural(amplas, "passa", "passam")} a agir sobre TODAS as campanhas de lá`
          : ""),
    });

    if (ativas > 0) {
      fora.push({
        tom: "promocao",
        texto:
          `${ativas} ${plural(ativas, "dessas regras está ATIVA", "dessas regras estão ATIVAS")} e ` +
          `${plural(ativas, "volta", "voltam")} a rodar sozinha${ativas === 1 ? "" : "s"} — pausando campanhas ou mexendo em orçamento, com dinheiro real`,
      });
    }
  }

  const despesas = previa.despesas.length;
  if (despesas > 0 && opcoes.despesas === "mover") {
    fora.push({
      tom: "promocao",
      texto:
        `${despesas} ${plural(despesas, "despesa passa", "despesas passam")} a ser descontada${despesas === 1 ? "" : "s"} do lucro de ` +
        `TODAS as áreas, não só desta`,
    });
  }

  /* ── perda de dado ─────────────────────────────────────────────────────────
     O que some e não volta. `remover` de conta é o mais caro do diálogo. */

  if (opcoes.contas === "remover" && previa.contas.length > 0) {
    fora.push({
      tom: "perda",
      texto:
        `${previa.contas.length} ${plural(previa.contas.length, "conta de anúncio é APAGADA", "contas de anúncio são APAGADAS")} da ferramenta, ` +
        `com todo o histórico de gasto — que é a base de ROAS, ROI e CPA de todos os períodos`,
    });
  }

  if (opcoes.apagarDados) {
    const d = previa.dados;
    fora.push({
      tom: "perda",
      texto: `${d.vendas} vendas, ${d.cliques} cliques e ${d.eventos} eventos são apagados`,
    });
  }

  if (opcoes.webhooks === "excluir" && previa.webhooks.length > 0) {
    const recebidas = previa.webhooks.reduce((s, w) => s + w.vendasRecebidas, 0);
    fora.push({
      tom: "perda",
      texto:
        `${previa.webhooks.length} ${plural(previa.webhooks.length, "webhook é excluído", "webhooks são excluídos")} — ` +
        `a URL para de receber, e ${plural(recebidas, "já recebeu", "já receberam")} ${recebidas} ${plural(recebidas, "venda", "vendas")}`,
    });
  }

  if (opcoes.pixels === "excluir" && previa.pixels.length > 0) {
    fora.push({
      tom: "perda",
      texto: `${previa.pixels.length} ${plural(previa.pixels.length, "pixel é excluído", "pixels são excluídos")} — o script instalado para de reportar`,
    });
  }

  /* ── só muda de dono ───────────────────────────────────────────────────── */

  if (opcoes.contas !== "remover" && previa.contas.length > 0) {
    fora.push({
      tom: "neutro",
      texto: `${previa.contas.length} ${plural(previa.contas.length, "conta vai", "contas vão")} para a área Principal`,
    });
  }

  return fora;
}

/**
 * `true` = existe promoção de escopo na configuração ATUAL do diálogo.
 *
 * ⚠️ É o que decide se o diálogo mostra o bloco de alarme — e ele muda quando o
 * usuário troca um seletor, porque a promoção é consequência da ESCOLHA, não da
 * exclusão em si. Com os padrões (`regras` e `despesas` em `excluir`) não há
 * promoção nenhuma, e alarmar ali seria alarme que grita sem motivo.
 */
export function ampliaEscopo(previa: PreviaExclusao, opcoes: OpcoesExclusao): boolean {
  return consequenciasDaExclusao(previa, opcoes).some((c) => c.tom === "promocao");
}
