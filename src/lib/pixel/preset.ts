/**
 * # Uma pergunta em vez de vinte escolhas
 *
 * A gaveta do Pixel pedia o dono de **cada um dos 5 eventos**, entre 4 opções —
 * 20 decisões que exigem entender deduplicação da Meta para serem tomadas. E o
 * caso é praticamente o mesmo para todo mundo aqui: pixel do Facebook na página,
 * checkout hospedado pelo gateway, infoproduto.
 *
 * > **Quando o caso é o mesmo para quase todos, a ferramenta resolve — não
 * > pergunta.** Uma pergunta que o usuário não consegue responder sem estudar o
 * > mecanismo não é configuração, é transferência de problema.
 *
 * ## 🔴 Por que isto NÃO é açúcar de interface
 *
 * A resposta amarra **duas coisas que hoje moram em lugares diferentes** e que
 * precisam concordar:
 *
 * 1. **quem é o dono de cada evento** (`PixelConfig.eventOwners`), que o servidor
 *    consulta ao vivo para decidir se manda à CAPI;
 * 2. **se o script deve espelhar no `fbq`** (assado no snippet).
 *
 * Separadas, elas divergem — e a divergência é cara nos dois sentidos:
 *
 * | Estado | Consequência |
 * |---|---|
 * | Dono = Traffik, script não espelha | evento da CAPI sem par no navegador → **a Meta conta duas vezes** |
 * | Sem pixel nativo, script tentando espelhar | 10s de espera por um `fbq` que nunca vem, `console.warn` e `sem-fbq` gravado — **alarme vermelho numa configuração correta** |
 *
 * Uma resposta, um mapa, os dois lados coerentes por construção.
 */

import { EVENTOS_DO_PIXEL, donoDoEvento, type DonoDoEvento, type MapaDeDonos } from "./donos";

export interface PresetPixel {
  /**
   * O código do Facebook (pixel) está instalado na página do usuário?
   *
   * ⚠️ Decide **os donos E o comportamento do script**. Ver a tabela acima.
   */
  temPixelNativo: boolean;
}

export const PRESET_PADRAO: PresetPixel = { temPixelNativo: true };

/**
 * O mapa de donos que cada resposta produz.
 *
 * > ### ⛔ `PageView` é a única linha que a resposta inverte
 * > O código-base da Meta termina em `fbq('track','PageView')`: dispara sozinho,
 * > em todo carregamento, **sem `event_id`** — e não há como fazê-lo ir com um,
 * > porque o código é deles. Ele nunca casa com a nossa CAPI. Como nenhum dos
 * > dois lados cede, quem cede somos nós: **havendo pixel nativo, a visita é
 * > dele.** Sem pixel nativo não existe segundo emissor, e a CAPI é o único
 * > caminho — aí o PageView volta a ser nosso.
 * >
 * > ⚠️ Os demais eventos são **sempre da Traffik**, nas duas respostas. Eles só
 * > saem do navegador se alguém chamar `fbq('track', …)` explicitamente, então
 * > não há emissor automático concorrendo. Rebaixá-los perderia conversão em
 * > silêncio, que é o erro caro.
 */
export function donosDoPreset(preset: PresetPixel): MapaDeDonos {
  return {
    PageView: preset.temPixelNativo ? "navegador" : "traffik",
    Lead: "traffik",
    AddToCart: "traffik",
    InitiateCheckout: "traffik",
    Purchase: "traffik",
  };
}

/**
 * Lê o preset gravado; sem ele, **infere do estado atual**.
 *
 * ⚠️ Pixel anterior a esta coluna tem `setup` NULO, e a inferência precisa
 * reproduzir **exatamente** o comportamento de hoje — senão a reforma da tela
 * mudaria o envio de eventos de quem não pediu nada. Como o padrão do projeto já
 * é `PageView: "navegador"`, todo pixel existente infere `temPixelNativo: true`,
 * que é o comportamento em vigor.
 *
 * Só cai em `false` quem trocou o PageView para Traffik na mão — e aí `false` é
 * a leitura certa, porque é o que essa escolha significa.
 */
export function lerPreset(setup: unknown, eventOwners: unknown): PresetPixel {
  if (setup && typeof setup === "object" && !Array.isArray(setup)) {
    const v = (setup as Record<string, unknown>).temPixelNativo;
    if (typeof v === "boolean") return { temPixelNativo: v };
  }
  return { temPixelNativo: donoDoEvento(eventOwners, "PageView") === "navegador" };
}

/**
 * Os donos gravados são exatamente os que o preset produz?
 *
 * É o que decide se a seção avançada aparece como "definido pelas suas respostas"
 * ou como "ajustado à mão" — e se o `↩ voltar ao padrão` tem o que desfazer.
 * Sem isso, um ajuste manual viraria um estado do qual não se sai.
 */
export function seguePreset(preset: PresetPixel, eventOwners: unknown): boolean {
  const esperado = donosDoPreset(preset);
  return EVENTOS_DO_PIXEL.every(
    (e) => donoDoEvento(eventOwners, e) === (esperado[e] as DonoDoEvento),
  );
}
