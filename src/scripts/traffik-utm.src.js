/*!
 * Traffik — runtime de rastreamento de UTMs (fonte).
 *
 * NÃO é este arquivo que o cliente instala. `scripts/build-scripts.mjs` minifica
 * isto em `public/t.js` (e no alias legado `public/pixel.js`); no site do cliente
 * entra só o loader de 3 linhas gerado por `src/lib/utm/scripts.ts`.
 *
 * O que faz:
 *   - lê utm_source/medium/campaign/content/term + fbclid/gclid/ttclid da URL
 *   - persiste em cookie de 1ª parte por 30 dias (preserva a 1ª atribuição)
 *   - registra o clique em /api/track/click uma vez por sessão
 *   - propaga os parâmetros para os links de checkout da página
 *   - expõe window.traffik.getData() e window.getTrackingData() (legado)
 *
 * ES5 de propósito: roda em páginas de venda de terceiros, sem transpilação.
 */
(function (w, d) {
  "use strict";

  var COOKIE = "traffik_track";
  var SESSION = "traffik_session";
  var DAYS = 30;
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var IDS = ["fbclid", "gclid", "ttclid"];
  var KEYS = UTM.concat(IDS);
  // Domínios de checkout que recebem os parâmetros automaticamente.
  var CHECKOUT = ["hotmart", "kirvano", "cartpanda", "kiwify", "monetizze", "pay.", "checkout"];

  // Uma instalação por página: dois loaders não podem duplicar o clique.
  if (w.__traffikUtm) return;
  w.__traffikUtm = 1;

  /** O <script> que carregou este arquivo — dá a URL da API e o data-account legado. */
  function own() {
    if (d.currentScript) return d.currentScript;
    var all = d.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (/\/(t|pixel)\.js(\?|$)/.test(all[i].src || "")) return all[i];
    }
    return null;
  }

  var el = own();
  var cfg = w.traffikConfig || {};
  // O account vem do loader; o data-account cobre quem instalou o pixel.js antigo.
  var ACCOUNT = cfg.a || (el && el.getAttribute("data-account")) || "";
  var API = "";
  if (el && el.src) {
    try {
      API = new URL(el.src).origin;
    } catch (e) {
      API = "";
    }
  }
  if (!API) API = cfg.u || "";
  if (API) API = API.replace(/\/+$/, "");

  if (!ACCOUNT) {
    if (w.console && w.console.warn) w.console.warn("[traffik] account ausente — verifique o snippet instalado.");
    return;
  }

  function readCookie(n) {
    var m = d.cookie.match("(^|;)\\s*" + n + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : null;
  }

  function writeCookie(n, v, days) {
    var exp = new Date(Date.now() + days * 864e5).toUTCString();
    d.cookie = n + "=" + encodeURIComponent(v) + ";expires=" + exp + ";path=/;SameSite=Lax";
  }

  function stored() {
    try {
      return JSON.parse(readCookie(COOKIE) || "{}");
    } catch (e) {
      return {};
    }
  }

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  function fromUrl() {
    var o = {}, q = new URLSearchParams(location.search);
    for (var i = 0; i < KEYS.length; i++) {
      var v = q.get(KEYS[i]);
      if (v) o[KEYS[i]] = v;
    }
    return o;
  }

  // Preserva a primeira atribuição: só sobrescreve quando a URL traz novos UTMs.
  var fresh = fromUrl();
  var has = Object.keys(fresh).length > 0;
  var data = has ? merge(stored(), fresh) : stored();
  if (has || !readCookie(COOKIE)) writeCookie(COOKIE, JSON.stringify(data), DAYS);

  w.traffik = w.traffik || {};
  w.traffik.getData = function () {
    return merge(stored(), { account: ACCOUNT });
  };
  w.traffik.data = data;
  // Nome legado, usado pelo checkout de teste e por quem instalou o pixel.js antigo.
  w.getTrackingData = w.traffik.getData;

  /** Propaga os parâmetros salvos para os links de checkout da página. */
  function decorate() {
    var qs = [], i;
    for (i = 0; i < KEYS.length; i++) {
      if (data[KEYS[i]]) qs.push(KEYS[i] + "=" + encodeURIComponent(data[KEYS[i]]));
    }
    if (data.click_id) qs.push("click_id=" + encodeURIComponent(data.click_id));
    if (!qs.length) return;
    var links = d.getElementsByTagName("a");
    for (i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      var isCheckout = false;
      for (var j = 0; j < CHECKOUT.length; j++) {
        if (href.indexOf(CHECKOUT[j]) > -1) { isCheckout = true; break; }
      }
      if (!isCheckout) continue;
      links[i].href = href + (href.indexOf("?") > -1 ? "&" : "?") + qs.join("&");
    }
  }

  function send() {
    // Uma vez por sessão para não inflar o volume de cliques.
    if (sessionStorage.getItem(SESSION)) {
      decorate();
      return;
    }
    var payload = merge(data, {
      account: ACCOUNT,
      url: location.href,
      referrer: d.referrer || null,
    });
    var ep = API + "/api/track/click";

    function done(id) {
      if (id) {
        data.click_id = id;
        writeCookie(COOKIE, JSON.stringify(data), DAYS);
        w.traffik.data = data;
      }
      try {
        sessionStorage.setItem(SESSION, "1");
      } catch (e) {}
      decorate();
    }

    // fetch é preferível porque devolve o click_id; sendBeacon fica de fallback.
    if (typeof fetch === "function") {
      fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: "cors",
      })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (res) {
          done(res && res.click_id);
        })
        .catch(function () {
          if (navigator.sendBeacon) navigator.sendBeacon(ep, JSON.stringify(payload));
          done(null);
        });
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(ep, JSON.stringify(payload));
      done(null);
    } else {
      decorate();
    }
  }

  if (d.readyState === "complete" || d.readyState === "interactive") send();
  else w.addEventListener("DOMContentLoaded", send);
})(window, document);
