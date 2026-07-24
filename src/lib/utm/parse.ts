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

/** Divide `"Nome do anúncio|120210..."` no ÚLTIMO `|` → { name, id }. */
export function splitPipe(v: string | null | undefined): { name: string | null; id: string | null } {
  if (!v) return { name: null, id: null };
  const i = v.lastIndexOf("|");
  if (i === -1) return { name: v.trim() || null, id: null };
  const name = v.slice(0, i).trim() || null;
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
    placement: utms.utmTerm?.trim() || null,
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
