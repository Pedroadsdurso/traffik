/**
 * O FORMULÁRIO do pixel, como estado puro — e as transições do preset.
 *
 * > ### 🔴 POR QUE ISTO SAIU DE DENTRO DO COMPONENTE
 * >
 * > O acoplamento mais caro deste produto vivia num handler de `.tsx`:
 * > `responderPreset` reescrevia **o mapa de donos** e **o `temPixelNativo`** na
 * > mesma linha, e essa simultaneidade é a proteção contra a Meta contar
 * > conversão em dobro.
 * >
 * > Proteção que mora dentro de um componente é proteção que **nenhum teste
 * > alcança**. A regra do projeto responde: *quando uma regra depende de alguém
 * > lembrar, procure a forma de o compilador — ou o teste — cobrar.*
 * >
 * > Aqui a forma é esta: as transições são funções puras, e
 * > `npm run test:pixel-preset` prova que **não existe patch de preset que mude
 * > o dono sem mudar o espelho, nem o contrário**.
 *
 * ## O par que precisa concordar
 *
 * | Lado | De onde sai | Quem lê |
 * |---|---|---|
 * | **dono do evento** | `PixelConfig.eventOwners` | o SERVIDOR, ao vivo, ao decidir se manda à CAPI |
 * | **espelho no `fbq`** | `setup.temPixelNativo` → `NATIVO` no script | o NAVEGADOR, assado no snippet instalado |
 *
 * Os dois nascem da mesma resposta. Separados, divergem — e a divergência conta
 * conversão em dobro num sentido e produz alarme falso no outro (a tabela
 * completa está em `preset.ts`).
 *
 * ⚠️ **Este arquivo não muda uma linha do que a `PixelView` calculava.** Ele é um
 * MOVE: as mesmas conversões, no lugar em que dá para verificá-las.
 */

import type { DetectionType, PixelConfigDTO, PixelFormInput } from "@/lib/actions/pixels";
import { donosDoPreset, REGRA_DE_CHECKOUT, type OndeSePaga, type PresetPixel } from "./preset";
import type { MapaDeDonos } from "./donos";

export interface MetaDraft {
  pixelId: string;
  accessToken: string;
  nickname: string;
  /** Já existe token gravado? O campo fica vazio e não apaga o que está lá. */
  savedToken?: boolean;
}

export interface FormPixel {
  name: string;
  metaPixels: MetaDraft[];
  /** 1ª pergunta. Decide os donos **E** o comportamento do script. */
  temPixelNativo: boolean;
  /** 2ª pergunta. Decide só o dono do `Purchase`. */
  outroEnviaPurchase: boolean;
  lead: boolean;
  addToCart: boolean;
  ic: { enabled: boolean; type: DetectionType; value: string };
  purchase: {
    enabled: boolean;
    sendMode: string;
    valueMode: string;
    fixedValue: string;
    targetProduct: string;
  };
  /** Quem envia cada evento. Derivado do preset, ajustável no avançado. */
  donos: MapaDeDonos;
}

export const FORM_VAZIO: FormPixel = {
  name: "",
  metaPixels: [],
  // O caso comum deste produto: infoprodutor com o pixel do Facebook na página.
  temPixelNativo: true,
  outroEnviaPurchase: false,
  lead: false,
  addToCart: false,
  ic: { enabled: true, type: "clique_checkout", value: "" },
  purchase: {
    enabled: true,
    sendMode: "APENAS_APROVADAS",
    valueMode: "VALOR_DA_VENDA",
    fixedValue: "",
    targetProduct: "",
  },
  donos: donosDoPreset({ temPixelNativo: true, outroEnviaPurchase: false, ondeSePaga: "gateway" }),
};

/** A resposta de "onde o comprador paga", LIDA da regra de detecção. */
export function ondePaga(tipo: DetectionType): OndeSePaga {
  return tipo === "contem_url" ? "proprio_site" : "gateway";
}

/**
 * A regra é um dos dois modos manuais do avançado?
 *
 * A pergunta descreve `clique_checkout` e `contem_url`. `contem_texto` e
 * `contem_css` não são nenhum dos dois — marcar um botão assim mesmo seria a
 * tela afirmando uma resposta que o usuário não deu.
 */
export function regraManual(tipo: DetectionType): boolean {
  return tipo !== "clique_checkout" && tipo !== "contem_url";
}

/** O preset COMPLETO que o formulário representa agora. */
export function presetDoForm(f: FormPixel): PresetPixel {
  return {
    temPixelNativo: f.temPixelNativo,
    outroEnviaPurchase: f.outroEnviaPurchase,
    // ⚠️ DERIVADO da regra, nunca um campo próprio: duas fontes para a mesma
    // resposta divergem no primeiro ajuste pelo avançado.
    ondeSePaga: ondePaga(f.ic.type),
  };
}

/**
 * 🔴 A TRANSIÇÃO DO PRESET — a função que este arquivo existe para tornar testável.
 *
 * Ela reescreve o mapa de donos **junto** com a resposta. As duas coisas saem
 * daqui na mesma expressão, e é por isso que não há como mexer numa sem a outra.
 *
 * ⚠️ **Sobrescreve ajuste manual, de propósito.** Responder de novo é um pedido
 * explícito de "reconfigure para este caso"; preservar o ajuste antigo deixaria
 * o usuário numa combinação que ele não escolheu e não vê. O caminho de volta é
 * o `↩ voltar ao padrão` do avançado.
 */
export function responderPreset(
  f: FormPixel,
  patch: Partial<Omit<PresetPixel, "ondeSePaga">>,
): FormPixel {
  const preset: PresetPixel = { ...presetDoForm(f), ...patch };
  return { ...f, ...patch, donos: donosDoPreset(preset) };
}

/**
 * "Onde o comprador paga" — a resposta **É** a regra de detecção.
 *
 * ⚠️ O valor é LIMPO ao trocar: uma lista de domínios de checkout e um trecho de
 * URL da própria página não são a mesma coisa, e carregar o valor antigo
 * produziria uma regra que casa com nada — ou, pior, com tudo.
 */
export function responderOndePaga(f: FormPixel, onde: OndeSePaga): FormPixel {
  if (ondePaga(f.ic.type) === onde && !regraManual(f.ic.type)) return f;
  return { ...f, ic: { ...f.ic, type: REGRA_DE_CHECKOUT[onde], value: "" } };
}

/**
 * O formulário está pronto para salvar?
 *
 * 🔴 `contem_url` com trecho VAZIO é o caso que precisa ser barrado aqui:
 * `location.href.indexOf("")` é sempre verdadeiro, e **toda visita viraria
 * checkout**. O erro é mudo — nada quebra, os números só ficam errados.
 */
export function problemasDoForm(f: FormPixel): string[] {
  const p: string[] = [];
  if (!f.name.trim()) p.push("Dê um nome a este pixel.");
  if (f.metaPixels.filter((m) => m.pixelId.trim()).length === 0) {
    p.push("Informe pelo menos um ID de pixel da Meta.");
  }
  if (f.ic.enabled && f.ic.type === "contem_url" && !f.ic.value.trim()) {
    p.push("Informe o trecho da URL da sua página de pagamento — sem ele, toda visita viraria início de checkout.");
  }
  if (f.purchase.enabled && f.purchase.valueMode === "VALOR_FIXO" && !f.purchase.fixedValue.trim()) {
    p.push("Informe o valor fixo da venda.");
  }
  return p;
}

export function formParaInput(f: FormPixel): PixelFormInput {
  return {
    name: f.name,
    metaPixels: f.metaPixels
      .filter((m) => m.pixelId.trim())
      .map((m) => ({ pixelId: m.pixelId, accessToken: m.accessToken, nickname: m.nickname })),
    lead: f.lead,
    addToCart: f.addToCart,
    initiateCheckout: { enabled: f.ic.enabled, detectionType: f.ic.type, detectionValue: f.ic.value },
    purchase: {
      enabled: f.purchase.enabled,
      sendMode: f.purchase.sendMode as PixelFormInput["purchase"]["sendMode"],
      valueMode: f.purchase.valueMode as PixelFormInput["purchase"]["valueMode"],
      fixedValue: f.purchase.valueMode === "VALOR_FIXO" ? parseFloat(f.purchase.fixedValue) || 0 : null,
      targetProduct: f.purchase.targetProduct || null,
    },
    eventOwners: f.donos,
    preset: presetDoForm(f),
  };
}

export function dtoParaForm(px: PixelConfigDTO): FormPixel {
  const ic = px.rules.find((r) => r.eventType === "INITIATE_CHECKOUT");
  const pu = px.rules.find((r) => r.eventType === "PURCHASE");
  return {
    name: px.name,
    metaPixels: px.metaPixels.map((m) => ({
      pixelId: m.pixelId,
      accessToken: "",
      nickname: m.nickname ?? "",
      savedToken: m.hasToken,
    })),
    temPixelNativo: px.preset.temPixelNativo,
    outroEnviaPurchase: px.preset.outroEnviaPurchase,
    lead: px.rules.find((r) => r.eventType === "LEAD")?.enabled ?? false,
    addToCart: px.rules.find((r) => r.eventType === "ADD_TO_CART")?.enabled ?? false,
    ic: {
      enabled: ic?.enabled ?? false,
      type: (ic?.detectionType as DetectionType) ?? "clique_checkout",
      value: ic?.detectionValue ?? "",
    },
    purchase: {
      enabled: pu?.enabled ?? true,
      sendMode: pu?.sendMode ?? "APENAS_APROVADAS",
      valueMode: pu?.valueMode ?? "VALOR_DA_VENDA",
      fixedValue: pu?.fixedValue != null ? String(pu.fixedValue) : "",
      targetProduct: pu?.targetProduct ?? "",
    },
    donos: px.eventOwners,
  };
}
