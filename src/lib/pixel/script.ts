/**
 * Gerador do script de pixel próprio da Traffik (Bloco 12). É um JS
 * autocontido que o usuário cola no <head>: escuta os eventos configurados na
 * página e reporta ao nosso backend (`/api/pixel/event`), que repassa à
 * Conversions API dos pixels da Meta cadastrados. Purchase é server-side (via
 * webhook), então não entra aqui.
 */

import { EVENTOS_DO_PIXEL, traffikEnvia } from "./donos";

export interface PixelScriptConfig {
  configId: string;
  /** `PixelConfig.eventOwners` cru. Ausente = tudo da Traffik. */
  eventOwners?: unknown;
  apiBase: string;
  lead: boolean;
  addToCart: boolean;
  initiateCheckout: {
    enabled: boolean;
    type?: "clique_checkout" | "contem_texto" | "contem_css" | "contem_url";
    value?: string;
  };
}

/** Domínios de checkout usados quando a regra por clique não lista os do usuário. */
const CHECKOUT_PADRAO = ["pay.kirvano.com", "hotmart", "cartpanda", "kiwify", "monetizze", "pay.", "checkout"];

function jsStr(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Eventos que a Traffik NÃO envia — o espelho no `fbq` os ignora.
 *
 * ⚠️ Só o ESPELHO. O `track()` continua mandando o POST para nós, porque o
 * funil e o Dashboard contam do nosso banco: escolher "meu gateway" para o
 * InitiateCheckout não pode apagar uma etapa inteira do funil como efeito
 * colateral invisível de uma decisão sobre pixel.
 */
function eventosAlheios(donos: unknown): string[] {
  return EVENTOS_DO_PIXEL.filter((e) => !traffikEnvia(donos, e));
}

/** Lista de domínios da regra por clique; vazio cai nos padrões. */
function dominiosCheckout(ic: PixelScriptConfig["initiateCheckout"]): string[] {
  if (ic.type !== "clique_checkout") return [];
  const doUsuario = (ic.value ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return doUsuario.length ? doUsuario : CHECKOUT_PADRAO;
}

export function pixelScript(cfg: PixelScriptConfig): string {
  const ic = cfg.initiateCheckout;
  return `/*! Traffik Pixel — cole antes de </head> */
(function () {
  "use strict";
  var CONFIG = "${jsStr(cfg.configId)}";
  var API = "${jsStr(cfg.apiBase.replace(/\/+$/, ""))}";
  var LEAD = ${cfg.lead};
  var ADD_TO_CART = ${cfg.addToCart};
  var IC = ${ic.enabled ? `{ type: "${jsStr(ic.type || "")}", value: "${jsStr(ic.value || "")}" }` : "null"};
  var CHECKOUT = ${JSON.stringify(dominiosCheckout(ic))};
  // Eventos cujo dono NÃO é a Traffik. Só afeta o espelho no pixel nativo:
  // o POST para nós continua, porque o funil e o Dashboard contam do nosso
  // banco e não podem perder uma etapa por causa de uma escolha de pixel.
  var ALHEIOS = ${JSON.stringify(eventosAlheios(cfg.eventOwners))};

  function fbclid() {
    try {
      if (window.traffik && typeof window.traffik.getData === "function") { var d = window.traffik.getData(); if (d && d.fbclid) return d.fbclid; }
      var m = document.cookie.match(/traffik_track\\s*=\\s*([^;]+)/);
      if (m) { var j = JSON.parse(decodeURIComponent(m[1])); if (j.fbclid) return j.fbclid; }
      var q = new URLSearchParams(location.search); return q.get("fbclid");
    } catch (e) { return null; }
  }
  // Hash estável (FNV-1a) — só para derivar um id curto e reproduzível.
  function hash(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h.toString(36);
  }
  /**
   * Id do evento — DETERMINÍSTICO.
   *
   * Era \`nome + Date.now() + Math.random()\`, ou seja, um id novo a cada
   * chamada. Isso tornava a deduplicação impossível por construção: nem o nosso
   * servidor nem a Meta conseguiam reconhecer o mesmo evento duas vezes.
   *
   * Agora deriva do que identifica a AÇÃO: pixel, evento, página, visitante e
   * uma janela de 10s. Duas cópias do script na mesma página, um reenvio, ou o
   * mesmo clique contado duas vezes produzem o MESMO id — e viram um evento só.
   */
  function eid(name) {
    return name + "-" + hash([CONFIG, name, location.href, fbclid() || "", Math.floor(Date.now() / 10000)].join("|"));
  }

  /**
   * Espelha o evento no pixel NATIVO da Meta com o MESMO event_id.
   *
   * ⛔ É esta função que faz a deduplicação existir. Sem ela, o pixel do
   * navegador manda o evento com um id dele e nós mandamos pela CAPI com o
   * nosso — a Meta recebe dois eventos sem nada em comum e **conta os dois**,
   * inflando o sinal que otimiza a campanha. Dinheiro real, sem erro e sem log.
   *
   * Só dispara quando \`fbq\` já existe na página: não instalamos o pixel nativo
   * de ninguém, apenas nos alinhamos ao que já está lá.
   */
  function espelhar(event, id) {
    try {
      if (ALHEIOS.indexOf(event) > -1) return; // o dono deste evento é outro
      if (typeof window.fbq === "function") window.fbq("track", event, {}, { eventID: id });
    } catch (e) {}
  }

  function track(event, extra) {
    var id = eid(event);
    var payload = { pixelConfigId: CONFIG, event: event, eventId: id, url: location.href, fbclid: fbclid() };
    if (extra) for (var k in extra) payload[k] = extra[k];
    espelhar(event, id);
    try {
      fetch(API + "/api/pixel/event", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload), keepalive: true, mode: "cors" }).catch(function () {});
    } catch (e) {}
  }
  window.traffikPixel = { track: track };

  // PageView: sempre ativo, dispara a cada carregamento de página. Não depende
  // de regra — é o evento base do pixel.
  track("PageView");

  // Lead: dispara ao enviar qualquer formulário.
  if (LEAD) document.addEventListener("submit", function () { track("Lead"); }, true);

  // AddToCart: clique em elementos com cara de carrinho.
  if (ADD_TO_CART) document.addEventListener("click", function (e) {
    var el = e.target; while (el && el !== document.body) {
      var t = (el.textContent || "").toLowerCase(), c = (el.className || "") + " " + (el.id || "");
      if (/adicionar ao carrinho|add to cart|comprar/.test(t) || /cart|carrinho/i.test(c)) { track("AddToCart"); return; }
      el = el.parentElement;
    }
  }, true);

  // InitiateCheckout conforme a regra de detecção.
  if (IC) {
    if (IC.type === "clique_checkout") {
      // Padrão: clique num link que leva ao checkout, capturado AQUI, na página
      // de vendas. É o único modo que funciona com checkout hospedado pelo
      // gateway (pay.kirvano.com e afins), onde não dá para instalar script.
      document.addEventListener("click", function (e) {
        var el = e.target, href = "";
        // Sobe até o <a>: o clique costuma cair num <span>/<img> dentro do link.
        while (el && el !== document.body) {
          if (el.tagName === "A" && el.getAttribute("href")) { href = el.getAttribute("href"); break; }
          el = el.parentElement;
        }
        if (!href) return;
        var alvo = href.toLowerCase();
        for (var i = 0; i < CHECKOUT.length; i++) {
          if (alvo.indexOf(CHECKOUT[i]) > -1) { track("InitiateCheckout", { destino: href.slice(0, 500) }); return; }
        }
      }, true);
    } else if (IC.type === "contem_url") {
      if (location.href.indexOf(IC.value) > -1) track("InitiateCheckout");
    } else {
      document.addEventListener("click", function (e) {
        var el = e.target; while (el && el !== document.body) {
          if (IC.type === "contem_texto" && (el.textContent || "").toLowerCase().indexOf(IC.value.toLowerCase()) > -1) { track("InitiateCheckout"); return; }
          if (IC.type === "contem_css") { try { if (el.matches(IC.value.charAt(0) === "." || IC.value.charAt(0) === "#" ? IC.value : "." + IC.value)) { track("InitiateCheckout"); return; } } catch (err) {} }
          el = el.parentElement;
        }
      }, true);
    }
  }
})();
`;
}
