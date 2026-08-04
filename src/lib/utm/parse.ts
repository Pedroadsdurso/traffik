/**
 * Parser reverso dos códigos de UTM do Bloco 11.
 *
 * Os links gerados na aba UTMs codificam `nome|id` em cada parâmetro
 * (`utm_campaign={{campaign.name}}|{{campaign.id}}` etc.) e, na Hotmart, também
 * concatenam tudo no `xcod` separado por uma string única por conta. Aqui
 * desmembramos esses formatos para extrair os **ids do Facebook**
 * (campaign/adset/ad) — é isso que permite cruzar a venda com o anúncio certo
 * pelo `fbAdId`, em vez do frágil casamento por nome.
 */

export interface ParsedCodes {
  campaignName: string | null;
  campaignId: string | null;
  adsetName: string | null;
  adsetId: string | null;
  adName: string | null;
  adId: string | null;
  placement: string | null;
}

const EMPTY: ParsedCodes = {
  campaignName: null,
  campaignId: null,
  adsetName: null,
  adsetId: null,
  adName: null,
  adId: null,
  placement: null,
};

/**
 * O valor é um placeholder que a Meta NÃO substituiu?
 *
 * ## 🔴 Por que isto recusa em vez de aceitar como nome
 *
 * `splitPipe` já rejeitava o **id** (`{{campaign.id}}` não é numérico) e
 * **aceitava o nome**: `{{campaign.name}}|{{campaign.id}}` virava
 * `campaignName: "{{campaign.name}}"`, que entrava no balde de atribuição por
 * nome como se fosse uma campanha de verdade.
 *
 * Template não substituído significa que **o clique não veio de uma entrega
 * real do anúncio** — é preview do Gerenciador, crawler, ou alguém que colou o
 * link cru. A Meta só troca `{{…}}` quando serve o anúncio. Atribuir esse
 * clique a qualquer campanha é inventar origem; o destino honesto dele é
 * tráfego direto.
 *
 * ⚠️ Cobre as duas formas: crua (`{{`) e percent-encoded (`%7B`), que é como
 * ela chega quando o link passa por um encurtador ou por um redirecionador que
 * codifica a querystring.
 *
 * ⚠️ **A verificação é por PARTE, não pelo valor inteiro.** Substituição
 * parcial existe (`Campanha Real|{{campaign.id}}`), e ali o nome é legítimo —
 * descartar os dois perderia atribuição boa.
 */
export function ehTemplateNaoSubstituido(v: string | null | undefined): boolean {
  if (!v) return false;
  return /\{\{|\}\}|%7B|%7D/i.test(v);
}

/** Divide `"Nome do anúncio|120210..."` no ÚLTIMO `|` → { name, id }. */
export function splitPipe(v: string | null | undefined): { name: string | null; id: string | null } {
  if (!v) return { name: null, id: null };
  const i = v.lastIndexOf("|");
  const bruto = i === -1 ? v : v.slice(0, i);
  const nome = bruto.trim() || null;
  // Nome que ainda é placeholder não é nome — ver `ehTemplateNaoSubstituido`.
  const name = nome && !ehTemplateNaoSubstituido(nome) ? nome : null;
  if (i === -1) return { name, id: null };
  const id = v.slice(i + 1).trim() || null;
  // Ignora placeholders não substituídos ({{ad.id}}) e ids não numéricos.
  const cleanId = id && /^\d+$/.test(id) ? id : null;
  return { name, id: cleanId };
}

/** Extrai os campos a partir dos UTMs individuais (padrão de todos os destinos). */
export function parseUtms(utms: {
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
}): ParsedCodes {
  const campaign = splitPipe(utms.utmCampaign);
  const adset = splitPipe(utms.utmMedium);
  const ad = splitPipe(utms.utmContent);
  return {
    campaignName: campaign.name,
    campaignId: campaign.id,
    adsetName: adset.name,
    adsetId: adset.id,
    adName: ad.name,
    adId: ad.id,
    // ⚠️ O `utm_term` (posicionamento) passa pelo mesmo guarda: um
    // `%7B%7Bplacement%7D%7D` viraria um "posicionamento" fantasma no ranking.
    placement: ehTemplateNaoSubstituido(utms.utmTerm) ? null : utms.utmTerm?.trim() || null,
  };
}

/**
 * Parser do `xcod` da Hotmart: `FB[SEP]camp|id[SEP]adset|id[SEP]ad|id[SEP]placement`.
 * Requer o separador único da conta. Retorna vazio se o formato não bater.
 */
export function parseXcod(xcod: string | null | undefined, separator: string | null | undefined): ParsedCodes {
  if (!xcod || !separator) return { ...EMPTY };
  const parts = xcod.split(separator);
  if (parts.length < 4) return { ...EMPTY };
  // parts[0] = "FB" (fonte); os seguintes são camp/adset/ad/placement.
  const campaign = splitPipe(parts[1]);
  const adset = splitPipe(parts[2]);
  const ad = splitPipe(parts[3]);
  return {
    campaignName: campaign.name,
    campaignId: campaign.id,
    adsetName: adset.name,
    adsetId: adset.id,
    adName: ad.name,
    adId: ad.id,
    placement: parts[4]?.trim() || null,
  };
}

/**
 * Melhor esforço: tenta o `xcod` (mais completo) e cai nos UTMs individuais.
 * Combina os dois, preferindo qualquer id já encontrado.
 */
export function parseTrackingCodes(
  src: {
    utmCampaign?: string | null;
    utmMedium?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
    xcod?: string | null;
  },
  separator?: string | null,
): ParsedCodes {
  const fromUtms = parseUtms(src);
  const fromXcod = parseXcod(src.xcod, separator);
  // Preferência: id do xcod > id dos utms; nome idem.
  const pick = (a: string | null, b: string | null) => a ?? b;
  return {
    campaignName: pick(fromXcod.campaignName, fromUtms.campaignName),
    campaignId: pick(fromXcod.campaignId, fromUtms.campaignId),
    adsetName: pick(fromXcod.adsetName, fromUtms.adsetName),
    adsetId: pick(fromXcod.adsetId, fromUtms.adsetId),
    adName: pick(fromXcod.adName, fromUtms.adName),
    adId: pick(fromXcod.adId, fromUtms.adId),
    placement: pick(fromXcod.placement, fromUtms.placement),
  };
}
