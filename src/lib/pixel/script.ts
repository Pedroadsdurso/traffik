/**
 * Gerador do snippet do pixel próprio da Traffik (Bloco 12).
 *
 * Um snippet por pixel cadastrado. É só um LOADER: injeta `/px.js` de forma
 * assíncrona com a configuração nos atributos `data-*`. A lógica dos eventos
 * vive em `src/scripts/traffik-pixel.src.js`, minificada para `public/px.js`
 * por `scripts/build-scripts.mjs`.
 *
 * Purchase continua fora daqui: é server-side, disparado pelo webhook da venda.
 */

export interface PixelScriptConfig {
  configId: string;
  apiBase: string;
  lead: boolean;
  addToCart: boolean;
  initiateCheckout: {
    enabled: boolean;
    type?: "clique_checkout" | "contem_texto" | "contem_css" | "contem_url";
    value?: string;
  };
}

/** Escapa uma string para embutir com segurança dentro de aspas duplas JS. */
function jsStr(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Os atributos `data-*` que carregam a configuração deste pixel. */
function dados(cfg: PixelScriptConfig): [string, string][] {
  const ic = cfg.initiateCheckout;
  const out: [string, string][] = [["data-cfg", cfg.configId]];
  if (cfg.lead) out.push(["data-lead", "1"]);
  if (cfg.addToCart) out.push(["data-atc", "1"]);
  // `clique_checkout` funciona sem valor (cai na lista de domínios padrão do
  // runtime); os demais modos só fazem sentido com o valor preenchido.
  if (ic.enabled && ic.type && (ic.value || ic.type === "clique_checkout")) {
    out.push(["data-ic-t", ic.type]);
    if (ic.value) out.push(["data-ic-v", ic.value]);
  }
  return out;
}

/**
 * Snippet de instalação do pixel — **opção única e universal**.
 *
 * IIFE em JavaScript puro, sem tags `<script>` próprias: é a única forma que
 * funciona tanto no `<head>` de um site (onde o campo embrulha o conteúdo em
 * `<script>`) quanto nos campos de script de gateway/checkout, que só aceitam
 * JavaScript. Por ser universal, **não existe formato alternativo** — o cliente
 * copia um código só e cola onde precisar.
 */
export function pixelLoaderSnippet(cfg: PixelScriptConfig): string {
  const src = `${cfg.apiBase.replace(/\/+$/, "")}/px.js`;
  const attrs = dados(cfg)
    .map(([chave, valor]) => `s.setAttribute("${chave}","${jsStr(valor)}");`)
    .join("");
  return `(function(d,s){s=d.createElement("script");s.async=1;s.src="${jsStr(src)}";${attrs}(d.head||d.documentElement).appendChild(s)})(document);`;
}
