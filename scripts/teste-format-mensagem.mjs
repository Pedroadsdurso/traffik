/**
 * `buildPoints` · `mensagemCurta` — GEOMETRIA E TEXTO DE ERRO, os dois últimos
 * da triagem por consequência.
 *
 * ### 🔴 `buildPoints` TEM DOIS DENOMINADORES, e nenhum é guardado por ele
 *
 * ```ts
 * arr.map((v, i) => `${(i * w) / (n - 1)},${h - pad - (v / max) * (h - pad * 2)}`)
 * ```
 *
 * | denominador | quando é zero | o que sai |
 * |---|---|---|
 * | `n - 1` | série com **um** ponto | `NaN` na coordenada x — é `0/0`, não `1/0` |
 * | `max` | série toda **zerada** | `NaN` na coordenada y |
 *
 * ⛔ E o `CLAUDE.md` já pagou por esse defeito, com o sintoma medido: *"todo `y`
 * vira `NaN`, e o `<path>` da área degenera num retângulo cheio: na tela, uma
 * barra azul sólida"*.
 *
 * ### ⚠️ O QUE SEGURA HOJE É O CHAMADOR, não a função
 *
 * `useTraffikState:734` escreve `cr.length > 1 ? cr : [...cr, ...cr]` — ele
 * duplica o ponto único para o `n - 1` não ser zero. **Isso é proteção
 * acidental**: a propriedade não é do módulo, e some no dia de um segundo
 * chamador. A §2 congela a guarda do chamador por isso.
 *
 * ⛔ **A função NÃO foi alterada** — `format.ts` é anterior a `4e6aa9e`, e
 * mexer nela muda a geometria de um gráfico que eu não consigo ver. MEDE ·
 * REGISTRA · AVISA.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { buildPoints } = await import("@/lib/format");
const { mensagemCurta } = await import("@/lib/webhook/efeitos");

const W = 100, H = 40, PAD = 4;
const coords = (s) => s.split(" ").map((p) => p.split(",").map(Number));
const finitos = (s) => coords(s).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · O CAMINHO NORMAL — e ele tem de sair finito e dentro da caixa
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · buildPoints, série normal");

  const s = buildPoints([0, 5, 10], 10, W, H, PAD);
  ok("produz um ponto por valor", coords(s).length === 3, s);
  ok("todas as coordenadas são finitas", finitos(s));
  ok("o primeiro x é 0 e o último é a largura", coords(s)[0][0] === 0 && coords(s)[2][0] === W);
  ok(
    "o maior valor fica no TOPO da área útil",
    coords(s)[2][1] === PAD,
    "e o menor no piso: " + coords(s)[0][1] + " = h − pad",
  );
  ok("o piso é `h - pad`", coords(s)[0][1] === H - PAD);

  /* Monotonia: valor maior nunca desce mais que valor menor (y cresce para
     baixo no SVG). É a relação, e ela não conhece número nenhum. */
  let quebrou = null;
  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let amostras = 0;
  for (let i = 0; i < 200; i++) {
    const arr = Array.from({ length: 2 + Math.floor(rnd() * 8) }, () => rnd() * 100);
    const max = Math.max(...arr);
    const pts = coords(buildPoints(arr, max, W, H, PAD));
    amostras++;
    if (!pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) quebrou ??= JSON.stringify(arr);
    for (let k = 1; k < arr.length; k++) {
      if (arr[k] > arr[k - 1] && pts[k][1] > pts[k - 1][1]) quebrou ??= "monotonia: " + JSON.stringify(arr);
    }
  }
  ok("linha de base: " + amostras + " séries no fuzz", amostras === 200);
  ok("fuzz 200 (semente 7): finito e monotônico", quebrou === null, quebrou ?? "valor maior nunca fica mais baixo");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · 🔴 OS DOIS DENOMINADORES — medidos, NÃO corrigidos
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · 🔴 os dois denominadores");

  /* ── n - 1 = 0 */
  const umPonto = buildPoints([5], 10, W, H, PAD);
  /* ⚠️ Eu escrevi "produz `Infinity`" e MEDI depois: é `NaN`. Com um ponto só,
     o índice do único elemento é 0, então a conta é `0 / 0` — indeterminação,
     não divisão de não-zero por zero. A asserção passava pelo `!finitos`, e a
     DESCRIÇÃO é que estava errada. Supor a forma do defeito é supor. */
  ok(
    "🔴 série de UM ponto produz `NaN` no x — `(0 * w) / 0`",
    !finitos(umPonto) && Number.isNaN(coords(umPonto)[0][0]),
    JSON.stringify(umPonto) + " — o `<polyline>` não desenha, e nada acusa",
  );
  ok("…e é o x, não o y", !Number.isFinite(coords(umPonto)[0][0]) && Number.isFinite(coords(umPonto)[0][1]));

  /* ── max = 0 */
  const tudoZero = buildPoints([0, 0, 0], 0, W, H, PAD);
  ok(
    "🔴 série toda ZERADA produz `NaN` no y",
    coords(tudoZero).some(([, y]) => Number.isNaN(y)),
    JSON.stringify(tudoZero) + " — é o `retângulo cheio` que o CLAUDE.md mede",
  );
  ok(
    "…e uma série zerada é o estado NORMAL de conta nova",
    buildPoints([0, 0], 0, W, H, PAD).includes("NaN"),
    "não é caso de borda: é o dia 1 de todo usuário",
  );

  /* ⚠️ E o par que mostra que não é o zero em si: com `max > 0`, série zerada
     desenha no piso, que é o desenho certo. */
  ok(
    "⚠️ com `max > 0`, a série zerada desenha no PISO — sem NaN",
    finitos(buildPoints([0, 0], 10, W, H, PAD)),
    "o defeito é o DENOMINADOR zero, não o valor zero",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · A GUARDA MORA NO CHAMADOR — e é proteção acidental
 *
 * ⛔ Sem esta seção, o §2 seria um achado sem consequência declarada: alguém
 * leria "produz Infinity" e não saberia se está em produção. Está protegido —
 * por uma linha do `useTraffikState`, não pela função.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · a guarda do chamador");

  const semCom = (s) =>
    s.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
  const hook = semCom(readFileSync("src/components/dashboard/useTraffikState.ts", "utf8"));

  ok("linha de base: o hook chama `buildPoints` no CÓDIGO", /buildPoints\(/.test(hook));
  ok(
    "🔑 GUARDA: ele duplica o ponto único antes de chamar",
    /length > 1 \? c[rs] : \[\.\.\.c[rs], \.\.\.c[rs]\]/.test(hook),
    "é o que impede o `n - 1 === 0` — e é do chamador, não da função",
  );

  /* E os chamadores continuam sendo os que se conhece. Um terceiro é
     informação: ele não herda a guarda. */
  {
    const { globSync } = await import("node:fs");
    const chamadores = globSync("src/**/*.{ts,tsx}")
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("generated") && !f.endsWith("lib/format.ts"))
      .filter((f) => /buildPoints\(/.test(semCom(readFileSync(f, "utf8"))));
    ok(
      "há UM arquivo chamador, e é o que guarda",
      chamadores.length === 1 && chamadores[0].endsWith("useTraffikState.ts"),
      chamadores.join(" · ") + " — um segundo chamador não herda a guarda",
    );
  }

  console.log(
    "\n   \x1b[33m⚠️  REGISTRADO, NÃO CORRIGIDO. `format.ts` é anterior a `4e6aa9e`,\n" +
      "      e guardar os denominadores mudaria a geometria de um gráfico que não\n" +
      "      dá para ver nesta máquina. MEDE · REGISTRA · AVISA.\x1b[0m",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `mensagemCurta` — o que vai para a COLUNA que a tela mostra
 *
 * Quatro pontos de escrita (`checkoutEvent`, `dispatchNotification`,
 * `dispatchPixel` ×2), todos em `catch`. O cabeçalho diz por que existe: *"a
 * Meta devolve corpo de erro longo e às vezes com a URL da documentação
 * inteira. A coluna não é um log — é o que a tela mostra ao lado do rótulo."*
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · mensagemCurta");

  ok("um `Error` vira a mensagem dele", mensagemCurta(new Error("falhou")) === "falhou");
  ok("texto solto atravessa", mensagemCurta("falhou") === "falhou");
  ok(
    "quebras e espaços viram UM espaço",
    mensagemCurta("linha 1\n\n  linha 2\tfim") === "linha 1 linha 2 fim",
    "a coluna é uma linha na tela — `\\n` cru viraria texto colado",
  );

  /* 🔑 O fallback: nunca sai vazio, porque a tela desenharia um rótulo mudo. */
  const VAZIOS = [null, undefined, "", "   ", new Error(""), "\n\n"];
  const semTexto = VAZIOS.filter((v) => mensagemCurta(v) !== "Erro sem mensagem.");
  ok(
    "🔑 as " + VAZIOS.length + " formas de vazio viram `Erro sem mensagem.`",
    semTexto.length === 0,
    semTexto.length ? "FALHARAM: " + JSON.stringify(semTexto.map(String)) : "nunca sai string vazia",
  );
  ok(
    "…mas `0` NÃO é vazio",
    mensagemCurta(0) === "0",
    "é a distinção de sempre — zero é conteúdo, ausência não",
  );

  /* O teto, e ele fecha EXATAMENTE no limite. */
  const longo = "x".repeat(1000);
  ok("o teto padrão é 300", mensagemCurta(longo).length === 300);
  ok("…e a reticência entra no teto, não além dele", mensagemCurta(longo).endsWith("…") && mensagemCurta(longo).length === 300);
  ok("no limite exato não trunca", mensagemCurta("x".repeat(300)) === "x".repeat(300));
  ok("um a mais trunca", mensagemCurta("x".repeat(301)).length === 300 && mensagemCurta("x".repeat(301)).endsWith("…"));
  ok("o limite é parametrizável", mensagemCurta(longo, 10).length === 10);
  ok(
    "e o texto curto sai intacto, sem reticência",
    mensagemCurta("erro breve") === "erro breve",
    "reticência em texto que coube seria mentira sobre truncamento",
  );

  /* ── PLANTIO: o fallback removido — o `|| "Erro sem mensagem."`. */
  {
    const semFallback = (e, lim = 300) => {
      const t = (e instanceof Error ? e.message : String(e ?? "")).replace(/\s+/g, " ").trim();
      return t.length > lim ? `${t.slice(0, lim - 1)}…` : t;
    };
    ok(
      "PLANTIO: sem o fallback, a coluna grava string VAZIA",
      semFallback(new Error("")) === "" && mensagemCurta(new Error("")) === "Erro sem mensagem.",
      "a tela desenharia o rótulo do erro com nada ao lado — parece que deu certo",
    );
    ok(
      "PAR NEGATIVO: com mensagem as duas versões concordam",
      ["falhou", "x".repeat(400)].every((v) => semFallback(v) === mensagemCurta(v)),
      "o caso comum é um erro COM texto — por isso o vazio passaria",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
