/**
 * Gerador do snippet do pixel próprio da Traffik (Bloco 12).
 *
 * O que o usuário cola no site é só um LOADER: registra a configuração deste
 * pixel em `window._tkpx`, cria um stub de `window.traffikPixel.track` com fila
 * (para disparos manuais feitos antes do arquivo chegar) e injeta `/px.js` de
 * forma assíncrona. A lógica dos eventos vive em `src/scripts/traffik-pixel.src.js`,
 * minificada para `public/px.js` por `scripts/build-scripts.mjs`.
 *
 * Purchase continua fora daqui: é server-side, disparado pelo webhook da venda.
 */

export interface PixelScriptConfig {
  configId: string;
  apiBase: string;
  lead: boolean;
  addToCart: boolean;
  initiateCheckout: { enabled: boolean; type?: "contem_texto" | "contem_css" | "contem_url"; value?: string };
}

/** Escapa uma string para embutir com segurança dentro de aspas duplas JS. */
function jsStr(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * JSON seguro para dentro de um `<script>` inline: o `<` escapado impede que um
 * valor de regra contendo `</script>` feche a tag e quebre a página do cliente.
 */
function jsonInline(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

export function pixelLoaderSnippet(cfg: PixelScriptConfig): string {
  const ic = cfg.initiateCheckout;
  // Chaves curtas: o objeto viaja no HTML de todas as páginas do cliente.
  const conf = {
    c: cfg.configId,
    l: cfg.lead ? 1 : 0,
    a: cfg.addToCart ? 1 : 0,
    i: ic.enabled && ic.value ? { t: ic.type || "", v: ic.value } : 0,
  };
  const src = `${cfg.apiBase.replace(/\/+$/, "")}/px.js`;

  return `<!-- Traffik Pixel (cole antes de </head>) -->
<script>
(function(w,d,c,s){w.traffikPixel=w.traffikPixel||{q:[],track:function(){w.traffikPixel.q.push([].slice.call(arguments))}};
(w._tkpx=w._tkpx||[]).push(c);if(w.__tkpxL)return;w.__tkpxL=1;
s=d.createElement("script");s.async=1;s.src="${jsStr(src)}";d.head.appendChild(s)})(window,document,${jsonInline(conf)});
</script>`;
}
