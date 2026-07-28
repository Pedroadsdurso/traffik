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
 * A configuração chega pelo array `window._tkpx` (um item por pixel). Como o
 * runtime é async, ele troca o array por um objeto com `push` que inicializa na
 * hora — assim um loader que rode depois do runtime também é atendido.
 *
 * ES5 de propósito: roda em páginas de venda de terceiros, sem transpilação.
 */
!function(t,r){"use strict";if(!t.__traffikPixel){t.__traffikPixel=1;var e=function(){if(r.currentScript)return r.currentScript;for(var t=r.getElementsByTagName("script"),e=t.length-1;e>=0;e--)if(/\/px\.js(\?|$)/.test(t[e].src||""))return t[e];return null}(),n="";if(e&&e.src)try{n=new URL(e.src).origin}catch(t){n=""}n=n.replace(/\/+$/,"");var i={},a=t.traffikPixel&&t.traffikPixel.q;t.traffikPixel={track:v};var c=t._tkpx||[];t._tkpx={push:d};for(var f=0;f<c.length;f++)d(c[f]);if(a)for(var o=0;o<a.length;o++)v.apply(null,a[o])}function u(){try{if(t.traffik&&"function"==typeof t.traffik.getData){var e=t.traffik.getData();if(e&&e.fbclid)return e.fbclid}var n=r.cookie.match(/traffik_track\s*=\s*([^;]+)/);if(n){var i=JSON.parse(decodeURIComponent(n[1]));if(i.fbclid)return i.fbclid}return new URLSearchParams(location.search).get("fbclid")}catch(t){return null}}function l(t,r,e){var i,a={pixelConfigId:t,event:r,eventId:(i=r,i+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),url:location.href,fbclid:u()};if(e)for(var c in e)a[c]=e[c];try{fetch(n+"/api/pixel/event",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(a),keepalive:!0,mode:"cors"}).catch(function(){})}catch(t){}}function s(t,e){for(var n=t;n&&n!==r.body;){if(e(n))return!0;n=n.parentElement}return!1}function d(t){t&&t.c&&!i[t.c]&&(i[t.c]=1,function(t){var e=t.c;t.l&&r.addEventListener("submit",function(){l(e,"Lead")},!0),t.a&&r.addEventListener("click",function(t){s(t.target,function(t){var r=(t.textContent||"").toLowerCase(),e=(t.className||"")+" "+(t.id||"");return/adicionar ao carrinho|add to cart|comprar/.test(r)||/cart|carrinho/i.test(e)})&&l(e,"AddToCart")},!0);var n=t.i;if(n&&n.v)if("contem_url"!==n.t){var i="contem_css"===n.t?"."===n.v.charAt(0)||"#"===n.v.charAt(0)?n.v:"."+n.v:"",a=n.v.toLowerCase();r.addEventListener("click",function(t){s(t.target,function(t){if("contem_texto"===n.t)return(t.textContent||"").toLowerCase().indexOf(a)>-1;if("contem_css"===n.t)try{return t.matches(i)}catch(t){return!1}return!1})&&l(e,"InitiateCheckout")},!0)}else location.href.indexOf(n.v)>-1&&l(e,"InitiateCheckout")}(t))}function v(t,r){for(var e in i)l(e,t,r)}}(window,document);
