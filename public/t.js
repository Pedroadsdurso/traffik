/*! Traffik t.js */
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
!function(t,e){"use strict";var n="traffik_track",r="traffik_session",a=["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].concat(["fbclid","gclid","ttclid"]),i=["hotmart","kirvano","cartpanda","kiwify","monetizze","pay.","checkout"];if(!t.__traffikUtm){t.__traffikUtm=1;var o=function(){if(e.currentScript)return e.currentScript;for(var t=e.getElementsByTagName("script"),n=t.length-1;n>=0;n--)if(/\/(t|pixel)\.js(\?|$)/.test(t[n].src||""))return t[n];return null}(),c=t.traffikConfig||{},f=c.a||o&&o.getAttribute("data-account")||"",u="";if(o&&o.src)try{u=new URL(o.src).origin}catch(t){u=""}if(u||(u=c.u||""),u&&(u=u.replace(/\/+$/,"")),f){var s=function(){for(var t={},e=new URLSearchParams(location.search),n=0;n<a.length;n++){var r=e.get(a[n]);r&&(t[a[n]]=r)}return t}(),l=Object.keys(s).length>0,d=l?h(m(),s):m();!l&&g(n)||k(n,JSON.stringify(d),30),t.traffik=t.traffik||{},t.traffik.getData=function(){return h(m(),{account:f})},t.traffik.data=d,t.getTrackingData=t.traffik.getData,"complete"===e.readyState||"interactive"===e.readyState?v():t.addEventListener("DOMContentLoaded",v)}else t.console&&t.console.warn&&t.console.warn("[traffik] account ausente — verifique o snippet instalado.")}function g(t){var n=e.cookie.match("(^|;)\\s*"+t+"\\s*=\\s*([^;]+)");return n?decodeURIComponent(n.pop()):null}function k(t,n,r){var a=new Date(Date.now()+864e5*r).toUTCString();e.cookie=t+"="+encodeURIComponent(n)+";expires="+a+";path=/;SameSite=Lax"}function m(){try{return JSON.parse(g(n)||"{}")}catch(t){return{}}}function h(t,e){var n,r={};for(n in t)r[n]=t[n];for(n in e)r[n]=e[n];return r}function p(){var t,n=[];for(t=0;t<a.length;t++)d[a[t]]&&n.push(a[t]+"="+encodeURIComponent(d[a[t]]));if(d.click_id&&n.push("click_id="+encodeURIComponent(d.click_id)),n.length){var r=e.getElementsByTagName("a");for(t=0;t<r.length;t++){for(var o=r[t].getAttribute("href")||"",c=!1,f=0;f<i.length;f++)if(o.indexOf(i[f])>-1){c=!0;break}c&&(r[t].href=o+(o.indexOf("?")>-1?"&":"?")+n.join("&"))}}}function v(){if(sessionStorage.getItem(r))p();else{var a=h(d,{account:f,url:location.href,referrer:e.referrer||null}),i=u+"/api/track/click";"function"==typeof fetch?fetch(i,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(a),keepalive:!0,mode:"cors"}).then(function(t){return t.ok?t.json():null}).then(function(t){o(t&&t.click_id)}).catch(function(){navigator.sendBeacon&&navigator.sendBeacon(i,JSON.stringify(a)),o(null)}):navigator.sendBeacon?(navigator.sendBeacon(i,JSON.stringify(a)),o(null)):p()}function o(e){e&&(d.click_id=e,k(n,JSON.stringify(d),30),t.traffik.data=d);try{sessionStorage.setItem(r,"1")}catch(t){}p()}}}(window,document);
