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

/**
 * Tempo relativo com escala completa: segundos → minutos → horas → dias →
 * semanas → meses → anos.
 *
 * Antes parava nos minutos, então um evento de 14 horas atrás era exibido como
 * "842min atrás" — tecnicamente certo e ilegível.
 *
 * Cada degrau só entra quando o anterior estoura, e o arredondamento é para
 * BAIXO (`floor`): "1h atrás" com 1h59 é honesto, enquanto o `round` mostraria
 * "2h atrás" para algo que ainda não completou duas horas. A única exceção é o
 * futuro — relógio de gateway adiantado gera `ts` à frente do nosso, e "agora"
 * é melhor do que um número negativo.
 */
export function elapsed(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 3) return "agora";
  if (sec < 60) return sec + "s atrás";

  const min = Math.floor(sec / 60);
  if (min < 60) return min + "min atrás";

  const horas = Math.floor(min / 60);
  if (horas < 24) return horas + "h atrás";

  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return dias + " dias atrás";

  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return semanas === 1 ? "1 semana atrás" : semanas + " semanas atrás";

  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses <= 1 ? "1 mês atrás" : meses + " meses atrás";

  const anos = Math.floor(dias / 365);
  return anos <= 1 ? "1 ano atrás" : anos + " anos atrás";
}

export function buildPoints(arr: number[], max: number, w: number, h: number, pad: number): string {
  const n = arr.length;
  return arr.map((v, i) => `${(i * w) / (n - 1)},${h - pad - (v / max) * (h - pad * 2)}`).join(" ");
}
