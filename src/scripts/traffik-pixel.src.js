/*!
 * Traffik — runtime do pixel próprio (fonte).
 *
 * NÃO é este arquivo que o cliente instala. `scripts/build-scripts.mjs` minifica
 * isto em `public/px.js`; no site do cliente entra só o loader de 4 linhas gerado
 * por `src/lib/pixel/script.ts`.
 *
 * Dispara Lead / AddToCart / InitiateCheckout para /api/pixel/event, que repassa
 * à Conversions API dos pixels da Meta cadastrados. Purchase NÃO passa por aqui:
 * é server-side, no webhook da venda.
 *
 * A configuração chega por DOIS caminhos, porque campos de "script do checkout"
 * de gateway costumam aceitar só um dos formatos:
 *   1. atributos `data-*` na própria tag `<script>` (instalação sem JS inline);
 *   2. o array `window._tkpx` (loader com bootstrap inline).
 * Como o runtime é async, ele troca o array por um objeto com `push` que
 * inicializa na hora — assim um loader que rode depois do runtime é atendido.
 *
 * ES5 de propósito: roda em páginas de venda de terceiros, sem transpilação.
 */
(function (w, d) {
  "use strict";

  if (w.__traffikPixel) return;
  w.__traffikPixel = 1;

  /** Todas as tags deste arquivo na página — pode haver uma por pixel instalado. */
  function tags() {
    var out = [], all = d.getElementsByTagName("script"), i;
    for (i = 0; i < all.length; i++) {
      if (/\/px\.js(\?|$)/.test(all[i].src || "")) out.push(all[i]);
    }
    if (!out.length && d.currentScript) out.push(d.currentScript);
    return out;
  }

  var minhas = tags();
  var el = d.currentScript || minhas[0] || null;
  var API = "";
  if (el && el.src) {
    try {
      API = new URL(el.src).origin;
    } catch (e) {
      API = "";
    }
  }
  API = API.replace(/\/+$/, "");

  /** fbclid vindo do script de UTMs, do cookie de 1ª parte ou da própria URL. */
  function fbclid() {
    try {
      if (w.traffik && typeof w.traffik.getData === "function") {
        var data = w.traffik.getData();
        if (data && data.fbclid) return data.fbclid;
      }
      var m = d.cookie.match(/traffik_track\s*=\s*([^;]+)/);
      if (m) {
        var j = JSON.parse(decodeURIComponent(m[1]));
        if (j.fbclid) return j.fbclid;
      }
      return new URLSearchParams(location.search).get("fbclid");
    } catch (e) {
      return null;
    }
  }

  function eid(name) {
    return name + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function send(configId, event, extra) {
    var payload = {
      pixelConfigId: configId,
      event: event,
      eventId: eid(event),
      url: location.href,
      fbclid: fbclid(),
    };
    if (extra) for (var k in extra) payload[k] = extra[k];
    try {
      fetch(API + "/api/pixel/event", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: "cors",
      }).catch(function () {});
    } catch (e) {}
  }

  var registrados = {};

  /** Sobe a árvore a partir do alvo do clique procurando um elemento que case. */
  function subindo(alvo, casa) {
    var atual = alvo;
    while (atual && atual !== d.body) {
      if (casa(atual)) return true;
      atual = atual.parentElement;
    }
    return false;
  }

  /** Liga os listeners de um pixel. `c` = { c: configId, l: lead, a: addToCart, i: regra de IC }. */
  function bind(c) {
    var id = c.c;

    // Lead: dispara ao enviar qualquer formulário.
    if (c.l) {
      d.addEventListener("submit", function () {
        send(id, "Lead");
      }, true);
    }

    // AddToCart: clique em elementos com cara de carrinho.
    if (c.a) {
      d.addEventListener("click", function (e) {
        var achou = subindo(e.target, function (alvo) {
          var texto = (alvo.textContent || "").toLowerCase();
          var classe = (alvo.className || "") + " " + (alvo.id || "");
          return /adicionar ao carrinho|add to cart|comprar/.test(texto) || /cart|carrinho/i.test(classe);
        });
        if (achou) send(id, "AddToCart");
      }, true);
    }

    // InitiateCheckout conforme a regra de detecção configurada na UI.
    var ic = c.i;
    if (!ic || !ic.v) return;
    if (ic.t === "contem_url") {
      // O runtime é async: numa página que troca a URL depois do load (checkout
      // em etapas, SPA) a checagem única no init perderia o evento. Confere
      // agora e reconfere nas trocas de URL, sem repetir o disparo.
      var jaMandou = false;
      var confere = function () {
        if (jaMandou || location.href.indexOf(ic.v) < 0) return;
        jaMandou = true;
        send(id, "InitiateCheckout");
      };
      confere();
      if (!jaMandou) {
        w.addEventListener("popstate", confere);
        w.addEventListener("hashchange", confere);
      }
      return;
    }
    var alvoCss = ic.t === "contem_css" ? (ic.v.charAt(0) === "." || ic.v.charAt(0) === "#" ? ic.v : "." + ic.v) : "";
    var alvoTexto = ic.v.toLowerCase();
    d.addEventListener("click", function (e) {
      var achou = subindo(e.target, function (alvo) {
        if (ic.t === "contem_texto") return (alvo.textContent || "").toLowerCase().indexOf(alvoTexto) > -1;
        if (ic.t === "contem_css") {
          try {
            return alvo.matches(alvoCss);
          } catch (err) {
            return false;
          }
        }
        return false;
      });
      if (achou) send(id, "InitiateCheckout");
    }, true);
  }

  function init(c) {
    if (!c || !c.c || registrados[c.c]) return;
    registrados[c.c] = 1;
    bind(c);
  }

  /** Disparo manual: window.traffikPixel.track("Lead", { value: 10 }). */
  function track(event, extra) {
    for (var id in registrados) send(id, event, extra);
  }

  /** Configuração vinda dos atributos da tag: `<script src=".../px.js" data-cfg="..." …>`. */
  function daTag(tag) {
    var cfg = tag.getAttribute("data-cfg");
    if (!cfg) return null;
    var tipo = tag.getAttribute("data-ic-t"), valor = tag.getAttribute("data-ic-v");
    return {
      c: cfg,
      l: tag.getAttribute("data-lead") === "1",
      a: tag.getAttribute("data-atc") === "1",
      i: valor ? { t: tipo || "", v: valor } : 0,
    };
  }

  // O loader deixa um stub com fila; drena o que foi chamado antes deste arquivo carregar.
  var fila = w.traffikPixel && w.traffikPixel.q;
  w.traffikPixel = { track: track };

  // 1) Instalação por tag: registra TODAS as tags do px.js, uma por pixel.
  for (var t = 0; t < minhas.length; t++) {
    var viaTag = daTag(minhas[t]);
    if (viaTag) init(viaTag);
  }

  // 2) Instalação por loader inline.
  var pendentes = w._tkpx || [];
  // A partir daqui, `push` inicializa na hora (loader que rode depois do runtime).
  w._tkpx = { push: init };
  for (var i = 0; i < pendentes.length; i++) init(pendentes[i]);

  if (fila) for (var j = 0; j < fila.length; j++) track.apply(null, fila[j]);
})(window, document);
