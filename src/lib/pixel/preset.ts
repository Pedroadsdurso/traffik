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
  /**
   * Alguém MAIS já avisa o Facebook quando a venda é aprovada?
   *
   * ## 🔴 Por que isto é uma SEGUNDA pergunta, e não derivado da primeira
   *
   * São **páginas diferentes**. `temPixelNativo` fala da página de vendas; o
   * `Purchase` é disparado na página de obrigado ou pelo checkout do gateway —
   * que na maioria dos casos **não é do usuário**. Ter o código do Facebook no
   * site não diz nada sobre o que o checkout da Kirvano faz.
   *
   * Derivar uma da outra erraria nos dois sentidos, e os dois são caros:
   *
   * | Se derivasse | Consequência |
   * |---|---|
   * | "tem pixel ⇒ ele manda o Purchase" | quem tem pixel só na página de vendas **perde toda venda** na Meta, em silêncio |
   * | "tem pixel ⇒ nós mandamos mesmo assim" | é o bug atual: **a Meta conta cada venda duas vezes** |
   *
   * ## ⚠️ O `Purchase` é o ÚNICO evento que não tem como deduplicar
   *
   * Nos demais, o nosso script espelha no `fbq` com o mesmo `event_id` e a Meta
   * junta os dois. **O `Purchase` nunca sai do nosso script** — ele é
   * server-side, disparado pelo webhook, e o `event_id` que mandamos é o `id` da
   * venda no nosso banco. Nenhum pixel de navegador no mundo gera esse id.
   * Então aqui não existe coordenação possível: ou nós enviamos, ou o outro.
   *
   * ## ⚠️ O padrão é `false` (nós enviamos), e isso é escolha
   *
   * Errar para "não enviar" perde conversão **em silêncio** — nada na tela
   * denuncia. Errar para "enviar" produz contagem dobrada, que aparece no
   * Gerenciador de Eventos da Meta. Mesma regra de `lerDonos`: aqui o risco não
   * é permissão indevida, é perder venda.
   */
  outroEnviaPurchase: boolean;
  /**
   * **Onde o comprador paga.** Decide a regra de detecção do InitiateCheckout.
   *
   * ## 🔴 Por que isto virou pergunta, e não ficou só no avançado
   *
   * A escolha entre `clique_checkout` e `contem_url` **não é uma preferência
   * técnica — é um fato sobre o negócio do usuário**, e ele sabe a resposta sem
   * saber o que é um detector:
   *
   * | Onde ele paga | Regra | Por quê |
   * |---|---|---|
   * | No checkout do gateway (`pay.cakto.com.br`, `pay.kirvano.com`) | `clique_checkout` | **não dá para instalar script lá** — a página é do gateway. O que dá para ver é o CLIQUE no link, no site dele |
   * | No próprio site | `contem_url` | o script roda na página de pagamento, então a URL dela é o sinal |
   *
   * Escolher errado não dá erro: dá **zero InitiateCheckout**, para sempre. Era
   * a configuração de quem apontava `contem_url` para o checkout hospedado — a
   * URL comparada é a da página onde o script roda, e o script nunca roda lá.
   *
   * ⚠️ `contem_url` **exige o trecho da URL**. Vazio, `location.href.indexOf("")`
   * é sempre verdadeiro e toda visita viraria checkout — o erro oposto, e tão
   * mudo quanto. O script guarda contra isso e a gaveta exige o campo.
   *
   * > ### ⛔ NÃO grave este campo no `setup` — ele é DERIVADO da regra de IC
   * > Ao contrário dos outros dois, a resposta aqui já tem onde morar: a regra
   * > gravada em `PixelEventRule`. Guardá-la também no `setup` criaria duas
   * > fontes para a mesma pergunta, e elas divergiriam no primeiro ajuste pelo
   * > avançado — a tela mostraria "paga no meu site" com o script detectando
   * > clique. É o defeito que fez a tela de Áreas dizer "Sem webhook" para uma
   * > área com webhook.
   * >
   * > `temPixelNativo` e `outroEnviaPurchase` são diferentes: eles não têm outra
   * > coluna própria (o mapa de donos só os reflete por coincidência do padrão),
   * > então **esses dois** precisam do `setup`.
   */
  ondeSePaga: OndeSePaga;
}

/** Onde fica a página em que o comprador efetivamente paga. */
export type OndeSePaga = "gateway" | "proprio_site";

/** A regra de detecção que cada resposta produz. */
export const REGRA_DE_CHECKOUT: Record<OndeSePaga, "clique_checkout" | "contem_url"> = {
  gateway: "clique_checkout",
  proprio_site: "contem_url",
};

export const PRESET_PADRAO: PresetPixel = {
  temPixelNativo: true,
  outroEnviaPurchase: false,
  // O caso comum deste produto: infoprodutor com checkout hospedado pelo gateway.
  ondeSePaga: "gateway",
};

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
 * > ⚠️ `Lead`, `AddToCart` e `InitiateCheckout` são **sempre da Traffik**, em
 * > qualquer resposta. Eles só saem do navegador se alguém chamar
 * > `fbq('track', …)` explicitamente, e quando isso acontece o nosso script
 * > espelha com o mesmo `event_id` — a Meta junta os dois. Rebaixá-los perderia
 * > conversão em silêncio, que é o erro caro.
 *
 * > ### 🔴 `Purchase` responde à SEGUNDA pergunta, e por um motivo estrutural
 * > Ele é o único evento sem contraparte de navegador do nosso lado: é enviado
 * > pelo webhook, com `event_id = Sale.id`, que nenhum pixel de navegador
 * > consegue reproduzir. **Não há dedup possível** — só partição. Ver
 * > `PresetPixel.outroEnviaPurchase`.
 */
export function donosDoPreset(preset: PresetPixel): MapaDeDonos {
  return {
    PageView: preset.temPixelNativo ? "navegador" : "traffik",
    Lead: "traffik",
    AddToCart: "traffik",
    InitiateCheckout: "traffik",
    Purchase: preset.outroEnviaPurchase ? "gateway" : "traffik",
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
 *
 * ⚠️ O mesmo vale para `outroEnviaPurchase`: o padrão do projeto é
 * `Purchase: "traffik"`, então todo pixel existente infere `false` — que é
 * exatamente o que ele faz hoje. Quem tiver mexido no dono do Purchase à mão
 * infere `true`, e continua sem receber envio nosso.
 *
 * ⚠️ Cada campo é lido de forma INDEPENDENTE. Um `setup` gravado antes de
 * `outroEnviaPurchase` existir tem `temPixelNativo` e não tem o outro — exigir
 * os dois faria a resposta antiga ser descartada inteira e o PageView voltar
 * ao padrão sem ninguém pedir.
 */
export function lerPreset(setup: unknown, eventOwners: unknown, icTipo?: string | null): PresetPixel {
  const obj =
    setup && typeof setup === "object" && !Array.isArray(setup)
      ? (setup as Record<string, unknown>)
      : {};
  const nativo = obj.temPixelNativo;
  const outro = obj.outroEnviaPurchase;
  return {
    temPixelNativo:
      typeof nativo === "boolean" ? nativo : donoDoEvento(eventOwners, "PageView") === "navegador",
    outroEnviaPurchase:
      typeof outro === "boolean" ? outro : donoDoEvento(eventOwners, "Purchase") !== "traffik",
    // ⚠️ SEMPRE derivado da regra gravada — nunca lido do `setup`. Ver a nota
    // em `PresetPixel.ondeSePaga`. O "senão" é `gateway` de propósito: é o que
    // `clique_checkout` (o padrão de sempre) significa, e é onde os modos
    // manuais do avançado (`contem_texto`/`contem_css`) caem — a pergunta não
    // os descreve, então a tela mostra isso em vez de fingir uma resposta.
    ondeSePaga: icTipo === "contem_url" ? "proprio_site" : "gateway",
  };
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
