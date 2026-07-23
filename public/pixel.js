/*!
 * Traffik pixel — rastreamento de cliques e UTMs de primeira parte.
 *
 * Instale antes de </head>:
 *   <script src="https://SEU_HOST/pixel.js" data-account="SEU_ID" async></script>
 *
 * O que faz:
 *   - Lê utm_source/medium/campaign/content/term, fbclid, gclid e ttclid da URL
 *   - Persiste em cookie de primeira parte por 30 dias
 *   - Registra o clique em /api/track/click na primeira visita da sessão
 *   - Expõe window.getTrackingData() para o checkout enviar junto da venda
 */
(function () {
  "use strict";

  var COOKIE = "traffik_track";
  var SESSION = "traffik_session";
  var MAX_AGE_DAYS = 30;

  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (/pixel\.js(\?|$)/.test(all[i].src)) {
        script = all[i];
        break;
      }
    }
  }
  if (!script) return;

  var account = script.getAttribute("data-account");
  if (!account) {
    console.warn("[traffik] atributo data-account ausente no <script>.");
    return;
  }

  // Deriva o host da API a partir do src do próprio script.
  var apiBase;
  try {
    apiBase = new URL(script.src).origin;
  } catch (e) {
    apiBase = "";
  }

  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var CLICK_KEYS = ["fbclid", "gclid", "ttclid"];

  function readCookie(name) {
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : null;
  }

  function writeCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie =
      name + "=" + encodeURIComponent(value) + ";expires=" + expires + ";path=/;SameSite=Lax";
  }

  function parseStored() {
    try {
      return JSON.parse(readCookie(COOKIE) || "{}");
    } catch (e) {
      return {};
    }
  }

  function paramsFromUrl() {
    var out = {};
    var qs = new URLSearchParams(window.location.search);
    UTM_KEYS.concat(CLICK_KEYS).forEach(function (k) {
      var v = qs.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  // Preserva a primeira atribuição: só sobrescreve quando a URL traz novos UTMs.
  var stored = parseStored();
  var fresh = paramsFromUrl();
  var hasFresh = Object.keys(fresh).length > 0;
  var data = hasFresh ? merge(stored, fresh) : stored;

  function merge(base, extra) {
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var j in extra) out[j] = extra[j];
    return out;
  }

  function send() {
    // Uma vez por sessão para não inflar o volume de cliques.
    if (sessionStorage.getItem(SESSION)) return;

    var payload = merge(data, {
      account: account,
      url: window.location.href,
      referrer: document.referrer || null,
    });

    var endpoint = apiBase + "/api/track/click";
    var handled = false;

    function onClickId(clickId) {
      if (handled || !clickId) return;
      handled = true;
      data.click_id = clickId;
      writeCookie(COOKIE, JSON.stringify(data), MAX_AGE_DAYS);
      sessionStorage.setItem(SESSION, "1");
      window.traffik = window.traffik || {};
      window.traffik.data = data;
    }

    // fetch é preferível porque devolve o click_id; sendBeacon fica de fallback.
    if (typeof fetch === "function") {
      fetch(endpoint, {
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
          if (res && res.click_id) onClickId(res.click_id);
        })
        .catch(function () {
          if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, JSON.stringify(payload));
            sessionStorage.setItem(SESSION, "1");
          }
        });
    } else if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
      sessionStorage.setItem(SESSION, "1");
    }
  }

  // Persiste imediatamente o que já temos (mesmo antes da resposta do servidor).
  if (hasFresh || !readCookie(COOKIE)) {
    writeCookie(COOKIE, JSON.stringify(data), MAX_AGE_DAYS);
  }

  /** Dados de atribuição salvos, para o checkout enviar junto da venda. */
  window.getTrackingData = function () {
    return merge(parseStored(), { account: account });
  };

  window.traffik = window.traffik || {};
  window.traffik.data = data;

  if (document.readyState === "complete" || document.readyState === "interactive") {
    send();
  } else {
    window.addEventListener("DOMContentLoaded", send);
  }
})();
