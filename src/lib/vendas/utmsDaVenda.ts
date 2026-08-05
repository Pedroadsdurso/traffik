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
 *
 * ---
 *
 * ## Quem consulta (05/08/2026) — antes, NINGUÉM consultava
 *
 * A cópia era gravada desde a migration `20260731080000` e **nenhum leitor a
 * lia**: toda a atribuição fazia `sale.click.utmCampaign` direto. Ou seja, o
 * seguro existia, era pago em toda ingestão, e não cobria nada.
 *
 * | Consumidor | O que a cópia sustenta |
 * |---|---|
 * | `areas/precedencia.ts` | de qual ÁREA a venda é (passo 1, conta de anúncio) |
 * | `ads/overview.ts` | ROAS, CPA e faturamento por campanha |
 * | `ads/creatives.ts` | ranking de criativos |
 * | `dashboard/metrics.ts` | fonte, origem, posicionamento e o feed |
 * | `rules/engine.ts` | 🔴 CPA/ROAS de regra que PAUSA campanha sozinha |
 *
 * **Provado no-op sobre os dados reais:** no backup de produção de 01/08, 27
 * vendas examinadas e **0** com `clickId` nulo e cópia preenchida. Ligar o
 * fallback não mexeu em número nenhum — só fechou o buraco.
 *
 * ⚠️ **Não copiamos `Click.workspaceId`** (a área que o script da página
 * declarou, passo 2 da precedência). Não é esquecimento: o único caminho que
 * apaga clique é "apagar dados" na exclusão de área, e ali a área declarada
 * está sendo excluída junto — `valida()` a recusaria de todo jeito. Copiá-la
 * seria peso morto.
 *
 * ⚠️ Os TRÊS efeitos pós-venda (`dispatchPixel`, `checkoutEvent`,
 * `dispatchNotification`) seguem lendo o clique direto, de propósito: rodam no
 * `after()` do próprio request de ingestão, microssegundos depois do match, e
 * não têm caminho de reprocessamento. Ali o clique não pode ter sumido.
 */

export interface UtmsDaVenda {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
}

/**
 * As 6 colunas de UTM, para espalhar num `select` do Prisma.
 *
 * > ### ⛔ Existe para a cópia não poder ser ESQUECIDA
 * > Coluna fora do `select` chega `undefined`, `utmsDaVenda` cai na resposta
 * > vazia e a venda perde a campanha — **sem `tsc`, `lint` ou `build` acusarem**.
 * > É a armadilha do `pedidoId`, e ela já morde este projeto duas vezes.
 * >
 * > Uma constante espalhada é estrutura; lembrar de listar seis campos em nove
 * > consultas é disciplina. A diferença aparece na décima consulta.
 *
 * Use nas DUAS pontas, com os MESMOS campos:
 *
 * ```ts
 * select: { ...CAMPOS_UTM, click: { select: { ...CAMPOS_UTM, workspaceId: true } } }
 * ```
 *
 * ⚠️ **Selecionar menos no clique do que na venda faz a `fonte` MENTIR.** Um
 * clique com `utmSource` preenchido e `utmCampaign` nulo, lido com um `select`
 * que só trouxe `utmCampaign`, reprova o `temAlgum()` e cai na cópia. Os valores
 * saem iguais (a cópia veio daquele clique), mas o diagnóstico passa a dizer
 * "cópia" onde a fonte estava viva.
 *
 * ⚠️ Custo: 4 colunas de texto curto a mais por linha. Contra ~99 ms de ida e
 * volta ao Supabase, é ruído — e é o lado seguro de errar.
 */
export const CAMPOS_UTM = {
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  utmContent: true,
  utmTerm: true,
  fbclid: true,
} as const;

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
