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
  initiateCheckout: { enabled: boolean; type?: "contem_texto" | "contem_css" | "contem_url"; value?: string };
}

function jsStr(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
    if (IC.type === "contem_url") {
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
