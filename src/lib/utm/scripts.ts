/**
 * Geradores dos scripts próprios da Traffik para instalar na página de vendas
 * (Bloco 11 › Scripts). São strings de JavaScript autocontido — o usuário baixa
 * e cola no <head> do site. Nada de terceiros: código nosso.
 */

/** Escapa uma string para embutir com segurança dentro de aspas duplas JS. */
function jsString(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Script de captura de UTMs: lê UTMs + fbclid, persiste em cookie de 1ª parte
 * por 30 dias, registra o clique no nosso endpoint, propaga os parâmetros para
 * os links de checkout da página e expõe `window.traffik.getData()`.
 */
export function utmScript(accountId: string, apiBase: string, workspaceId?: string | null): string {
  return `/*! Traffik — captura de UTMs (cole antes de </head>) */
(function () {
  "use strict";
  var ACCOUNT = "${jsString(accountId)}";
  // Área de Trabalho desta página. O servidor valida a posse; se vier vazio o
  // clique cai na regra normal de atribuição, como nos scripts antigos.
  var WS = "${jsString(workspaceId ?? "")}";
  var API = "${jsString(apiBase.replace(/\/+$/, ""))}";
  var COOKIE = "traffik_track", SESSION = "traffik_session", DAYS = 30;
  var UTM = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
  var IDS = ["fbclid","gclid","ttclid"];
  // Domínios de checkout que recebem os parâmetros automaticamente.
  var CHECKOUT = ["hotmart","kirvano","cartpanda","kiwify","monetizze","pay.","checkout"];

  function readCookie(n){var m=document.cookie.match("(^|;)\\\\s*"+n+"\\\\s*=\\\\s*([^;]+)");return m?decodeURIComponent(m.pop()):null;}
  function writeCookie(n,v,d){var e=new Date(Date.now()+d*864e5).toUTCString();document.cookie=n+"="+encodeURIComponent(v)+";expires="+e+";path=/;SameSite=Lax";}
  function stored(){try{return JSON.parse(readCookie(COOKIE)||"{}");}catch(e){return {};}}
  function merge(a,b){var o={},k;for(k in a)o[k]=a[k];for(k in b)o[k]=b[k];return o;}
  function fromUrl(){var o={},q=new URLSearchParams(location.search);UTM.concat(IDS).forEach(function(k){var v=q.get(k);if(v)o[k]=v;});return o;}

  var fresh=fromUrl(), has=Object.keys(fresh).length>0, data=has?merge(stored(),fresh):stored();
  if(has||!readCookie(COOKIE))writeCookie(COOKIE,JSON.stringify(data),DAYS);

  window.traffik=window.traffik||{};
  window.traffik.getData=function(){return merge(stored(),{account:ACCOUNT});};
  window.traffik.data=data;

  // Propaga os parâmetros salvos para os links de checkout da página.
  function decorate(){
    var qs=[];UTM.concat(IDS).forEach(function(k){if(data[k])qs.push(k+"="+encodeURIComponent(data[k]));});
    if(data.click_id)qs.push("click_id="+encodeURIComponent(data.click_id));
    if(!qs.length)return;
    var links=document.getElementsByTagName("a");
    for(var i=0;i<links.length;i++){
      var href=links[i].getAttribute("href")||"";
      var isCheckout=CHECKOUT.some(function(d){return href.indexOf(d)>-1;});
      if(!isCheckout)continue;
      links[i].href=href+(href.indexOf("?")>-1?"&":"?")+qs.join("&");
    }
  }

  function send(){
    if(sessionStorage.getItem(SESSION)){decorate();return;}
    var payload=merge(data,{account:ACCOUNT,url:location.href,referrer:document.referrer||null});
    if(WS)payload.ws=WS;
    var ep=API+"/api/track/click";
    function done(id){if(id){data.click_id=id;writeCookie(COOKIE,JSON.stringify(data),DAYS);window.traffik.data=data;}sessionStorage.setItem(SESSION,"1");decorate();}
    if(typeof fetch==="function"){
      fetch(ep,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(payload),keepalive:true,mode:"cors"})
        .then(function(r){return r.ok?r.json():null;})
        .then(function(res){done(res&&res.click_id);})
        .catch(function(){if(navigator.sendBeacon){navigator.sendBeacon(ep,JSON.stringify(payload));}done(null);});
    }else if(navigator.sendBeacon){navigator.sendBeacon(ep,JSON.stringify(payload));done(null);}
    else{decorate();}
  }

  if(document.readyState==="complete"||document.readyState==="interactive")send();
  else window.addEventListener("DOMContentLoaded",send);
})();
`;
}

/**
 * Script de back redirect: intercepta o botão "voltar" do navegador e
 * redireciona para a URL definida, preservando os UTMs da URL atual.
 */
export function backRedirectScript(destUrl: string): string {
  return `/*! Traffik — back redirect (cole antes de </head>) */
(function () {
  "use strict";
  var DEST = "${jsString(destUrl.trim())}";
  if(!DEST)return;
  try{ history.pushState(null,"",location.href); history.pushState(null,"",location.href); }catch(e){}
  window.addEventListener("popstate", function () {
    var qs = location.search.replace(/^\\?/,"");
    var url = DEST + (qs ? (DEST.indexOf("?")>-1?"&":"?") + qs : "");
    location.href = url;
  });
})();
`;
}
