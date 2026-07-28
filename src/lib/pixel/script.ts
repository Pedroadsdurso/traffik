/**
 * Gerador do script de pixel próprio da Traffik (Bloco 12). É um JS
 * autocontido que o usuário cola no <head>: escuta os eventos configurados na
 * página e reporta ao nosso backend (`/api/pixel/event`), que repassa à
 * Conversions API dos pixels da Meta cadastrados. Purchase é server-side (via
 * webhook), então não entra aqui.
 */

export interface PixelScriptConfig {
  configId: string;
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

  function fbclid() {
    try {
      if (window.traffik && typeof window.traffik.getData === "function") { var d = window.traffik.getData(); if (d && d.fbclid) return d.fbclid; }
      var m = document.cookie.match(/traffik_track\\s*=\\s*([^;]+)/);
      if (m) { var j = JSON.parse(decodeURIComponent(m[1])); if (j.fbclid) return j.fbclid; }
      var q = new URLSearchParams(location.search); return q.get("fbclid");
    } catch (e) { return null; }
  }
  function eid(name) { return name + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8); }

  function track(event, extra) {
    var payload = { pixelConfigId: CONFIG, event: event, eventId: eid(event), url: location.href, fbclid: fbclid() };
    if (extra) for (var k in extra) payload[k] = extra[k];
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
