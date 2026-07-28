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
!function(t,e){"use strict";if(!t.__traffikPixel){t.__traffikPixel=1;var r=function(){var t,r=[],n=e.getElementsByTagName("script");for(t=0;t<n.length;t++)/\/px\.js(\?|$)/.test(n[t].src||"")&&r.push(n[t]);return!r.length&&e.currentScript&&r.push(e.currentScript),r}(),n=e.currentScript||r[0]||null,a="";if(n&&n.src)try{a=new URL(n.src).origin}catch(t){a=""}a=a.replace(/\/+$/,"");var i={},c=t.traffikPixel&&t.traffikPixel.q;t.traffikPixel={track:g};for(var o=0;o<r.length;o++){var f=k(r[o]);f&&p(f)}var u=t._tkpx||[];t._tkpx={push:p};for(var d=0;d<u.length;d++)p(u[d]);if(c)for(var l=0;l<c.length;l++)g.apply(null,c[l])}function s(){try{if(t.traffik&&"function"==typeof t.traffik.getData){var r=t.traffik.getData();if(r&&r.fbclid)return r.fbclid}var n=e.cookie.match(/traffik_track\s*=\s*([^;]+)/);if(n){var a=JSON.parse(decodeURIComponent(n[1]));if(a.fbclid)return a.fbclid}return new URLSearchParams(location.search).get("fbclid")}catch(t){return null}}function v(t,e,r){var n,i={pixelConfigId:t,event:e,eventId:(n=e,n+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),url:location.href,fbclid:s()};if(r)for(var c in r)i[c]=r[c];try{fetch(a+"/api/pixel/event",{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(i),keepalive:!0,mode:"cors"}).catch(function(){})}catch(t){}}function h(t,r){for(var n=t;n&&n!==e.body;){if(r(n))return!0;n=n.parentElement}return!1}function p(r){r&&r.c&&!i[r.c]&&(i[r.c]=1,function(r){var n=r.c;r.l&&e.addEventListener("submit",function(){v(n,"Lead")},!0),r.a&&e.addEventListener("click",function(t){h(t.target,function(t){var e=(t.textContent||"").toLowerCase(),r=(t.className||"")+" "+(t.id||"");return/adicionar ao carrinho|add to cart|comprar/.test(e)||/cart|carrinho/i.test(r)})&&v(n,"AddToCart")},!0);var a=r.i;if(a&&a.v){if("contem_url"===a.t){var i=!1,c=function(){i||location.href.indexOf(a.v)<0||(i=!0,v(n,"InitiateCheckout"))};return c(),void(i||(t.addEventListener("popstate",c),t.addEventListener("hashchange",c)))}var o="contem_css"===a.t?"."===a.v.charAt(0)||"#"===a.v.charAt(0)?a.v:"."+a.v:"",f=a.v.toLowerCase();e.addEventListener("click",function(t){h(t.target,function(t){if("contem_texto"===a.t)return(t.textContent||"").toLowerCase().indexOf(f)>-1;if("contem_css"===a.t)try{return t.matches(o)}catch(t){return!1}return!1})&&v(n,"InitiateCheckout")},!0)}}(r))}function g(t,e){for(var r in i)v(r,t,e)}function k(t){var e=t.getAttribute("data-cfg");if(!e)return null;var r=t.getAttribute("data-ic-t"),n=t.getAttribute("data-ic-v");return{c:e,l:"1"===t.getAttribute("data-lead"),a:"1"===t.getAttribute("data-atc"),i:n?{t:r||"",v:n}:0}}}(window,document);
