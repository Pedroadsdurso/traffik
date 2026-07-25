export function brl(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function brl0(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function pct(n: number): string {
  return n.toFixed(1).replace(".", ",") + "%";
}

export function roasFmt(n: number): string {
  return n.toFixed(1).replace(".", ",") + "x";
}

/**
 * Multiplicador com 2 casas — o formato que o Bloco 4 pediu para o ROI
 * (`1,87x`, `0,80x`). O `roasFmt` continua com 1 casa por ora: mexer nele
 * mudaria o ROAS, que não estava no escopo.
 */
export function multFmt(n: number): string {
  return n.toFixed(2).replace(".", ",") + "x";
}

export function elapsed(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 3) return "agora";
  if (sec < 60) return sec + "s atrás";
  return Math.round(sec / 60) + "min atrás";
}

export function buildPoints(arr: number[], max: number, w: number, h: number, pad: number): string {
  const n = arr.length;
  return arr.map((v, i) => `${(i * w) / (n - 1)},${h - pad - (v / max) * (h - pad * 2)}`).join(" ");
}
