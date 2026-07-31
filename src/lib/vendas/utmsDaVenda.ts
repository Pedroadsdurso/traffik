/**
 * # De qual campanha é esta venda?
 *
 * Existem DUAS fontes para a mesma pergunta, e é justamente por isso que só um
 * módulo pode respondê-la:
 *
 * | Fonte | O que é |
 * |---|---|
 * | `sale.click.utmCampaign` | a **fonte**: o clique que trouxe o comprador |
 * | `sale.utmCampaign` | a **cópia**, gravada na ingestão (migration `20260731080000`) |
 *
 * > ### ⛔ A CADEIA `Sale → Click` VENCE A CÓPIA. Não inverta.
 * >
 * > 1. **É o caminho já exercido.** Toda a atribuição — `ads/overview.ts`,
 * >    `ads/creatives.ts`, `areas/precedencia.ts` — lê do `Click` há meses,
 * >    contra dado real. Trocar a fonte primária por uma coluna nova, para
 * >    resolver um caso que hoje não acontece, é risco sem ganho.
 * > 2. **Duas fontes para a mesma pergunta divergem sempre.** Foi assim que a
 * >    tela de Áreas passou a dizer "Sem webhook" para uma área com webhook
 * >    vinculado — uma função local lia o array enquanto a FK era a verdade.
 * >    Aqui a ordem é explícita e mora num lugar só.
 * > 3. **A cópia é seguro, não índice.** Ela existe para o dia em que o clique
 *  >   sumir; enquanto ele estiver lá, ele é quem manda.
 *
 * ⚠️ **Enquanto o clique existir, as duas respondem igual** — a cópia é feita a
 * partir dele, e um `Click` nunca muda de UTM depois de criado. A precedência só
 * passa a importar quando o clique é apagado, que hoje só acontece por ação
 * explícita do usuário ("apagar dados" na exclusão de área, atrás de duas
 * travas). É por isso que ela é barata: não muda número nenhum hoje.
 */

export interface UtmsDaVenda {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
}

/** De onde a resposta veio. Existe para o diagnóstico poder dizer. */
export type FonteDosUtms = "clique" | "copia" | "nenhuma";

const VAZIO: UtmsDaVenda = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  fbclid: null,
};

/** A venda como as consultas a trazem: a cópia na linha, o clique via relação. */
export interface VendaComUtms extends Partial<UtmsDaVenda> {
  click?: Partial<UtmsDaVenda> | null;
}

/**
 * ⚠️ **Nunca mescla.** Pegar o `utmCampaign` do clique e o `utmContent` da cópia
 * produziria uma atribuição que não existiu em lugar nenhum: campanha de um
 * visitante, criativo de outro. Ou a venda é descrita pelo clique, ou pela cópia
 * do que o clique era.
 *
 * ⚠️ O clique vence quando **tem algo a dizer**, não pela mera existência: um
 * clique de tráfego direto (sem UTM nenhuma) não deve calar uma cópia que
 * herdou UTMs de um clique anterior mais forte.
 */
export function utmsDaVenda(sale: VendaComUtms): { utms: UtmsDaVenda; fonte: FonteDosUtms } {
  const doClique = sale.click;
  if (doClique && temAlgum(doClique)) return { utms: { ...VAZIO, ...limpar(doClique) }, fonte: "clique" };
  if (temAlgum(sale)) return { utms: { ...VAZIO, ...limpar(sale) }, fonte: "copia" };
  // ⚠️ Clique que existe e é tráfego direto (sem UTM nenhuma) cai aqui, e está
  // certo: a cópia dele também é vazia, então não há resposta melhor a dar.
  return { utms: VAZIO, fonte: "nenhuma" };
}

const CAMPOS: (keyof UtmsDaVenda)[] = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "fbclid",
];

function temAlgum(o: Partial<UtmsDaVenda>): boolean {
  return CAMPOS.some((c) => o[c] != null && o[c] !== "");
}

/** Só os campos de UTM, sem arrastar o resto da linha. */
function limpar(o: Partial<UtmsDaVenda>): Partial<UtmsDaVenda> {
  const out: Partial<UtmsDaVenda> = {};
  for (const c of CAMPOS) if (o[c] != null) out[c] = o[c];
  return out;
}
