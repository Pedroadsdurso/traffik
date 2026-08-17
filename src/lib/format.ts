/**
 * O traço que representa **indefinido**.
 *
 * ⛔ Indefinido não é zero, e a diferença custa decisão de mídia: um CPA de
 * `R$ 0,00` se lê como aquisição de graça, um ROAS de `0,00x` como "não
 * retornou nada", quando os dois querem dizer "não dá para calcular ainda".
 *
 * Por isso os formatadores aceitam `null` e devolvem isto — em vez de cada
 * chamador decidir sozinho. Um único `?? 0` esquecido num call site desfaria a
 * correção em silêncio, e é assim que ela voltaria.
 */
export const TRACO = "—";

export function brl(n: number | null | undefined): string {
  if (n == null) return TRACO;
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function brl0(n: number): string {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Percentual de métrica com **2 casas**.
 *
 * Era `toFixed(1)`, que transformava um CTR de 3,73% em "3,7%". Toda métrica
 * numérica da ferramenta agora mostra 2 casas: o arredondamento escondia
 * variação real entre criativos que diferem na segunda casa.
 */
export function pct(n: number | null | undefined): string {
  if (n == null) return TRACO;
  return n.toFixed(2).replace(".", ",") + "%";
}

/**
 * Multiplicador com 2 casas — ROAS e ROI usam o MESMO formato.
 *
 * O `roasFmt` tinha 1 casa e o `multFmt` 2, então o mesmo número aparecia
 * diferente dependendo do card: um ROAS real de 3,73 virava "3,7x" enquanto o
 * ROI de 3,73 virava "3,73x". `toFixed` arredonda para a casa pedida (3,75 →
 * "3,8" com 1 casa), e era daí que vinha a impressão de "número fechado".
 * Ambos agora são a mesma função — `roasFmt` fica como alias para não quebrar
 * os pontos que já o importavam.
 */
export function multFmt(n: number | null | undefined): string {
  if (n == null) return TRACO;
  return n.toFixed(2).replace(".", ",") + "x";
}

export const roasFmt = multFmt;

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

/**
 * Os pontos de um `<polyline>`/`<polygon>`, em coordenadas de tela.
 *
 * ## 🔴 OS DOIS DENOMINADORES — guardados aqui em 17/08/2026
 *
 * A versão anterior era uma linha:
 *
 * ```ts
 * arr.map((v, i) => `${(i * w) / (n - 1)},${h - pad - (v / max) * (h - pad * 2)}`)
 * ```
 *
 * | denominador | quando é zero | o que saía |
 * |---|---|---|
 * | `n - 1` | série com **um** ponto | `NaN` no x — é `0/0`, não `1/0` |
 * | `max`   | série toda **zerada**  | `NaN` no y |
 *
 * ⛔ **O segundo é o estado NORMAL de conta nova**, não caso de borda: é o dia 1
 * de todo usuário. E o sintoma já está medido neste projeto — *"todo `y` vira
 * `NaN`, e o `<path>` da área degenera num retângulo cheio: na tela, uma barra
 * azul sólida"*. O dano não fica no ponto: a string inteira vai para o `points`,
 * e o chamador ainda tira `lastX`/`lastY` do último par, que viram `"NaN"` como
 * atributo no DOM.
 *
 * ## ⚠️ O QUE SEGURAVA ERA O CHAMADOR — e isso não é contrato
 *
 * `useTraffikState:734` escreve `cr.length > 1 ? cr : [...cr, ...cr]` e
 * `Math.max(1, …)` no `max`. Os dois seguram, e nenhum dos dois é propriedade
 * DESTA função: some no dia de um segundo chamador, que não herda guarda
 * nenhuma. É a *proteção acidental* — "não quebra" nunca foi "não pode
 * quebrar".
 *
 * ## ⛔ A GUARDA PRESERVA A ARITMÉTICA, e é isso que autoriza mexer aqui
 *
 * `format.ts` é anterior a `4e6aa9e`, e o instrumento de janela está
 * indisponível nesta máquina — ou seja, não dá para conferir na tela. Por isso
 * as expressões abaixo são **as mesmas**, caractere por caractere, dentro do
 * ramo guardado: `(i * w) / (n - 1)` não virou `i * (w / (n - 1))`, que seria
 * algebricamente igual e diferente no último bit.
 *
 * > **Invariante congelada em `test:format-mensagem`: toda entrada cuja saída
 * > hoje é FINITA produz saída idêntica.** Só o que era `NaN` mudou.
 *
 * O piso (`h - pad`) não é número inventado: é exatamente onde `v = 0` já
 * plota com qualquer `max > 0` — `h - pad - 0 * (h - pad * 2)`. A guarda é o
 * limite contínuo da conta, não um valor de conveniência.
 *
 * ⚠️ **O limite dela, escrito para não virar promessa:** ela guarda o
 * DENOMINADOR, nunca os VALORES. Um `NaN` dentro de `arr` continua saindo
 * `NaN` — de propósito: sanear valor aqui esconderia defeito de quem produziu a
 * série, que é a família do `?? 0`. E `max` não-finito ou `<= 0` com algum `v`
 * positivo significa que o chamador calculou o máximo errado; o desenho vai
 * para o piso em vez de para fora da tela, mas o defeito é dele.
 */
export function buildPoints(arr: number[], max: number, w: number, h: number, pad: number): string {
  const n = arr.length;
  /* Um ponto só não tem vão para distribuir: ele é a primeira amostra, e a
     primeira amostra mora na origem. Repartir `w` por zero é que não é. */
  const temVao = n > 1;
  /* `max <= 0` inclui a série toda zerada; `!isFinite` cobre o `max` quebrado
     rio acima. Nos dois, a fração é 0 e a série deita no piso. */
  const temEscala = Number.isFinite(max) && max > 0;
  return arr
    .map((v, i) => {
      const x = temVao ? (i * w) / (n - 1) : 0;
      const y = temEscala ? h - pad - (v / max) * (h - pad * 2) : h - pad;
      return `${x},${y}`;
    })
    .join(" ");
}

/**
 * Plural de verdade, em vez de `evento(s)`.
 *
 * O parêntese é gambiarra de código vazando na tela: ninguém escreve "43
 * evento(s) recebido(s)" num produto. Aceita a forma plural completa porque
 * português não pluraliza só com "s" (`mês` → `meses`).
 *
 * ```
 * plural(1, "venda", "vendas")   // "1 venda"
 * plural(43, "venda", "vendas")  // "43 vendas"
 * plural(0, "venda", "vendas")   // "nenhuma venda" quando `zero` é dado
 * ```
 */
export function plural(n: number, singular: string, pluralForma: string, zero?: string): string {
  if (n === 0 && zero) return zero;
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Só a palavra, sem o número — para quando o número já está na frase. */
export function palavra(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}
