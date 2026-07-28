/**
 * Geradores dos snippets que o usuário cola no site (Bloco 11 › Scripts).
 *
 * O snippet de UTMs é só um LOADER: injeta `/t.js` de forma assíncrona passando
 * o account. Toda a lógica (cookie, propagação de links, envio do clique) vive em
 * `src/scripts/traffik-utm.src.js`, minificado para `public/t.js` no build por
 * `scripts/build-scripts.mjs`. Assim o HTML do cliente não carrega ~3 KB de código
 * nem precisa ser reinstalado quando corrigimos o rastreamento.
 */

/** Escapa uma string para embutir com segurança dentro de aspas duplas JS. */
function jsString(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Remove a barra final para concatenar caminhos sem duplicar `/`. */
function base(apiBase: string): string {
  return apiBase.replace(/\/+$/, "");
}

/**
 * Loader do rastreamento de UTMs. `async` = não bloqueia o parser nem a
 * renderização da página do cliente; o runtime lida com o DOM já pronto.
 */
export function utmLoaderSnippet(accountId: string, apiBase: string): string {
  return `<!-- Traffik — rastreamento de UTMs (cole antes de </head>) -->
<script>
(function(d,s){s=d.createElement("script");s.async=1;s.src="${jsString(base(apiBase))}/t.js";s.setAttribute("data-account","${jsString(accountId)}");d.head.appendChild(s)})(document);
</script>`;
}

/**
 * Script de back redirect: intercepta o botão "voltar" do navegador e
 * redireciona para a URL definida, preservando os UTMs da URL atual.
 *
 * Continua inline de propósito: são ~460 bytes, o destino muda por instalação e
 * um loader para isto seria maior que o próprio código.
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
