/*! Traffik px.js */
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
!function(t,e){"use strict";if(!t.__traffikPixel){t.__traffikPixel=1;var r=["pay.kirvano.com","hotmart","cartpanda","kiwify","monetizze","pay.","checkout"],a=function(){var t,r=[],a=e.getElementsByTagName("script");for(t=0;t<a.length;t++)/\/px\.js(\?|$)/.test(a[t].src||"")&&r.push(a[t]);return!r.length&&e.currentScript&&r.push(e.currentScript),r}(),n=e.currentScript||a[0]||null,i="";if(n&&n.src)try{i=new URL(n.src).origin}catch(t){i=""}i=i.replace(/\/+$/,"");var c={},o=t.traffikPixel&&t.traffikPixel.q;t.traffikPixel={track:k};for(var f=0;f<a.length;f++){var u=m(a[f]);u&&g(u)}var l=t._tkpx||[];t._tkpx={push:g};for(var d=0;d<l.length;d++)g(l[d]);if(o)for(var v=0;v<o.length;v++)k.apply(null,o[v])}function s(){try{if(t.traffik&&"function"==typeof t.traffik.getData){var r=t.traffik.getData();if(r&&r.fbclid)return r.fbclid}var a=e.cookie.match(/traffik_track\s*=\s*([^;]+)/);if(a){var n=JSON.parse(decodeURIComponent(a[1]));if(n.fbclid)return n.fbclid}return new URLSearchParams(location.search).get("fbclid")}catch(t){return null}}function h(t,e,r){var a,n={pixelConfigId:t,event:e,eventId:(a=e,a+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),url:location.href,fbclid:s()};if(r)for(var c in r)n[c]=r[c];try{fetch(i+"/api/pixel/event",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(n),keepalive:!0,mode:"cors"}).catch(function(){})}catch(t){}}function p(t,r){for(var a=t;a&&a!==e.body;){if(r(a))return!0;a=a.parentElement}return!1}function g(a){a&&a.c&&!c[a.c]&&(c[a.c]=1,function(a){var n=a.c;a.l&&e.addEventListener("submit",function(){h(n,"Lead")},!0),a.a&&e.addEventListener("click",function(t){p(t.target,function(t){var e=(t.textContent||"").toLowerCase(),r=(t.className||"")+" "+(t.id||"");return/adicionar ao carrinho|add to cart|comprar/.test(e)||/cart|carrinho/i.test(r)})&&h(n,"AddToCart")},!0);var i=a.i;if(i&&i.t){if("clique_checkout"===i.t){var c=[];if(i.v)for(var o=i.v.split(","),f=0;f<o.length;f++){var u=o[f].replace(/^\s+|\s+$/g,"").toLowerCase();u&&c.push(u)}return c.length||(c=r),void e.addEventListener("click",function(t){for(var r=t.target,a="";r&&r!==e.body;){if("A"===r.tagName&&r.getAttribute("href")){a=r.getAttribute("href");break}r=r.parentElement}if(a)for(var i=a.toLowerCase(),o=0;o<c.length;o++)if(i.indexOf(c[o])>-1)return void h(n,"InitiateCheckout",{destino:a.slice(0,500)})},!0)}if(i.v){if("contem_url"===i.t){var l=!1,d=function(){l||location.href.indexOf(i.v)<0||(l=!0,h(n,"InitiateCheckout"))};return d(),void(l||(t.addEventListener("popstate",d),t.addEventListener("hashchange",d)))}var v="contem_css"===i.t?"."===i.v.charAt(0)||"#"===i.v.charAt(0)?i.v:"."+i.v:"",s=i.v.toLowerCase();e.addEventListener("click",function(t){p(t.target,function(t){if("contem_texto"===i.t)return(t.textContent||"").toLowerCase().indexOf(s)>-1;if("contem_css"===i.t)try{return t.matches(v)}catch(t){return!1}return!1})&&h(n,"InitiateCheckout")},!0)}}}(a))}function k(t,e){for(var r in c)h(r,t,e)}function m(t){var e=t.getAttribute("data-cfg");if(!e)return null;var r=t.getAttribute("data-ic-t"),a=t.getAttribute("data-ic-v");return{c:e,l:"1"===t.getAttribute("data-lead"),a:"1"===t.getAttribute("data-atc"),i:r?{t:r,v:a||""}:0}}}(window,document);
