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

/** Escapa para dentro de um atributo HTML com aspas duplas. */
function attr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Os atributos `data-*` que carregam a configuração do pixel na própria tag. */
function dados(cfg: PixelScriptConfig): { chave: string; valor: string }[] {
  const ic = cfg.initiateCheckout;
  const out = [{ chave: "data-cfg", valor: cfg.configId }];
  if (cfg.lead) out.push({ chave: "data-lead", valor: "1" });
  if (cfg.addToCart) out.push({ chave: "data-atc", valor: "1" });
  if (ic.enabled && ic.value) {
    out.push({ chave: "data-ic-t", valor: ic.type || "" });
    out.push({ chave: "data-ic-v", valor: ic.value });
  }
  return out;
}

const fonte = (cfg: PixelScriptConfig) => `${cfg.apiBase.replace(/\/+$/, "")}/px.js`;

/**
 * Formato **HTML**: uma tag externa, sem JavaScript inline. É o formato mais
 * robusto — sobrevive a campos que embrulham o conteúdo em `<script>` sozinhos
 * (o que quebrava um snippet que já trazia as próprias tags) e a Content
 * Security Policy que bloqueia script inline.
 */
export function pixelLoaderSnippet(cfg: PixelScriptConfig): string {
  const attrs = dados(cfg).map((d) => ` ${d.chave}="${attr(d.valor)}"`).join("");
  return `<script async src="${attr(fonte(cfg))}"${attrs}></script>`;
}

/**
 * Formato **JavaScript puro**, para campos que aceitam só JS (é o caso de vários
 * "scripts do checkout" de gateway, que embrulham o conteúdo em `<script>`).
 * Monta a mesma tag por DOM, mantendo o `async`.
 */
export function pixelLoaderJs(cfg: PixelScriptConfig): string {
  const sets = dados(cfg)
    .map((d) => `s.setAttribute("${d.chave}","${jsStr(d.valor)}");`)
    .join("");
  return `(function(d,s){s=d.createElement("script");s.async=1;s.src="${jsStr(fonte(cfg))}";${sets}(d.head||d.documentElement).appendChild(s)})(document);`;
}
