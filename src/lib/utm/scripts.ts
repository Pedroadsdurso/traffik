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
 * Snippet de instalação do rastreamento de UTMs — **opção única e universal**.
 *
 * É um IIFE em JavaScript puro, sem tags `<script>` próprias, porque essa é a
 * única forma que funciona nos DOIS lugares onde ele é colado:
 *   - campo de "código do cabeçalho" de site, que embrulha o conteúdo em
 *     `<script>` (uma tag própria aqui viraria `<script><script>…`, que não roda);
 *   - campo de script de gateway/checkout, que aceita só JavaScript.
 *
 * Por ser universal, **não existe formato alternativo** — oferecer dois códigos
 * transformava um detalhe de bastidor em decisão de quem só quer copiar e colar.
 * `async` garante que não bloqueia a renderização da página do cliente.
 */
export function utmLoaderSnippet(accountId: string, apiBase: string): string {
  return `(function(d,s){s=d.createElement("script");s.async=1;s.src="${jsString(base(apiBase))}/t.js";s.setAttribute("data-account","${jsString(accountId)}");(d.head||d.documentElement).appendChild(s)})(document);`;
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
