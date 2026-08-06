/**
 * Conversões de cor e contraste WCAG.
 *
 * Existe por um motivo específico: os tokens do design system são escritos em
 * OKLCH (é o que a Fase 1 pede, para que a diferença de luminosidade percebida
 * entre os dois temas se mantenha), mas o critério de acessibilidade é definido
 * em sRGB. Sem a conversão, o "teste de contraste" só poderia ser feito sobre os
 * hexadecimais do COMENTÁRIO — ou seja, sobre um valor que não é o que a página
 * pinta. É a armadilha "duas implementações da mesma conta divergem sempre": o
 * dia em que alguém ajustar o OKLCH e esquecer o comentário, o teste aprovaria
 * uma cor que ninguém mais usa.
 *
 * Então: quem manda é o OKLCH do `globals.css`, e ele é convertido aqui.
 *
 * ⚠️ Este arquivo mora em `src/lib` e NÃO em `scripts/` pela mesma regra: quem
 * mede o contraste são DOIS consumidores — o `scripts/teste-contraste.mjs` e a
 * própria página `/design-system`. Duas implementações da mesma conta divergem
 * sempre, e quando as duas erram igual a divergência que denunciaria o erro
 * nem existe.
 */

export type Rgb = [number, number, number];
export type Oklch = [number, number, number];

/* ── sRGB ↔ linear ─────────────────────────────────────────────────────────── */

function paraLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function paraGama(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/* ── hex ↔ OKLCH ───────────────────────────────────────────────────────────── */

export function hexParaRgb(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

export function rgbParaHex([r, g, b]: Rgb): string {
  const v = (c: number) =>
    Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0");
  return `#${v(r)}${v(g)}${v(b)}`.toUpperCase();
}

export function rgbParaOklch([r, g, b]: Rgb): Oklch {
  const lr = paraLinear(r), lg = paraLinear(g), lb = paraLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 1e-6 ? 0 : H];
}

export function oklchParaRgb([L, C, H]: Oklch): Rgb {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);

  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;

  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [paraGama(lr), paraGama(lg), paraGama(lb)];
}

/** `oklch(0.2 0.03 260)` → `[0.2, 0.03, 260]`. Devolve null se não casar. */
export function lerOklch(texto: string): Oklch | null {
  const m = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)/i.exec(texto);
  if (!m) return null;
  const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return [L, parseFloat(m[2]), parseFloat(m[3])];
}

/** Formata com a precisão que vai para o CSS (e é a que o teste vai reler). */
export function formatarOklch([L, C, H]: Oklch): string {
  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;
}

export function hexParaOklchTexto(hex: string): string {
  return formatarOklch(rgbParaOklch(hexParaRgb(hex)));
}

/** OKLCH textual → hexadecimal sRGB. É a ponte que o teste de contraste usa. */
export function oklchTextoParaHex(texto: string): string | null {
  const oklch = lerOklch(texto);
  return oklch ? rgbParaHex(oklchParaRgb(oklch)) : null;
}

/* ── Contraste WCAG 2.x ────────────────────────────────────────────────────── */

export function luminancia([r, g, b]: Rgb): number {
  return 0.2126 * paraLinear(r) + 0.7152 * paraLinear(g) + 0.0722 * paraLinear(b);
}

export function contraste(rgbA: Rgb, rgbB: Rgb): number {
  const a = luminancia(rgbA), b = luminancia(rgbB);
  const claro = Math.max(a, b), escuro = Math.min(a, b);
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Composição alfa sobre um fundo opaco — necessária porque vários pares reais
 * são "cor a X% sobre a superfície" (o preenchimento de 12% do break-even, o
 * anel do glow). Medir a cor pura contra o fundo daria um número que a tela
 * nunca produz.
 */
export function sobrepor(frente: Rgb, fundo: Rgb, alfa: number): Rgb {
  return frente.map((c, i) => c * alfa + fundo[i] * (1 - alfa)) as Rgb;
}
