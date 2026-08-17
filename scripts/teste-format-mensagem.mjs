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
 * 2 · ✅ OS DOIS DENOMINADORES — GUARDADOS em 17/08/2026
 *
 * ## ⛔ ESTA SEÇÃO MUDOU DE VEREDITO, e a saída estava escrita nela
 *
 * Ela CONGELAVA o estado ruim: três asserções afirmavam que `NaN` sai, e uma
 * delas literalmente checava `.includes("NaN")`. Elas passavam, e o rodapé
 * dizia "REGISTRADO, NÃO CORRIGIDO" — ou seja, a suíte defendia o defeito.
 *
 * ⚠️ **Um teste que congela o valor errado não fica obsoleto de forma visível:
 * ele fica VERDE.** O que o denuncia é a asserção reprovar no dia do conserto,
 * e é por isso que a virada de veredito vale registro em vez de edição
 * silenciosa: quem ler o `git log` desta seção vê que o `NaN` foi decisão de
 * alguém, não descuido.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · ✅ os dois denominadores, guardados");

  /* ── n - 1 = 0 ─────────────────────────────────────────────────────────
     ⚠️ Uma versão minha escreveu "produz `Infinity`" e MEDIU depois: era
     `NaN`. Com um ponto só, o índice do único elemento é 0, então a conta é
     `0 / 0` — indeterminação, não divisão de não-zero por zero. Supor a forma
     do defeito é supor; a linha fica porque a asserção certa nasceu disso. */
  const umPonto = buildPoints([5], 10, W, H, PAD);
  ok(
    "✅ série de UM ponto sai FINITA — o `0 / 0` do x foi guardado",
    finitos(umPonto),
    JSON.stringify(umPonto) + " — antes: `NaN,y`, e o `<polyline>` não desenhava",
  );
  ok(
    "…e o ponto único mora na ORIGEM — não há vão para repartir",
    coords(umPonto)[0][0] === 0,
    "x = " + coords(umPonto)[0][0],
  );
  ok(
    "…e o y dele continua sendo o de sempre",
    coords(umPonto)[0][1] === H - PAD - (5 / 10) * (H - PAD * 2),
    "o guarda do x não podia mexer no y",
  );

  /* ── max = 0 — o estado NORMAL de conta nova ─────────────────────────── */
  const tudoZero = buildPoints([0, 0, 0], 0, W, H, PAD);
  ok(
    "✅ série toda ZERADA sai FINITA — o `0 / 0` do y foi guardado",
    finitos(tudoZero),
    JSON.stringify(tudoZero) + " — antes: o `retângulo cheio` que o CLAUDE.md mede",
  );
  ok(
    "…e ela deita no PISO, que é exatamente onde `v = 0` já plotava",
    coords(tudoZero).every(([, y]) => y === H - PAD),
    "piso = " + (H - PAD) + " — limite contínuo da conta, não número de conveniência",
  );
  ok(
    "…e uma série zerada é o estado NORMAL de conta nova",
    finitos(buildPoints([0, 0], 0, W, H, PAD)),
    "não é caso de borda: é o dia 1 de todo usuário",
  );

  /* ⛔ A CONTINUIDADE é o que prova que o piso não é invenção: a MESMA série,
     com `max` 0 e com `max` 10, desenha no MESMO y. Se um dia alguém trocar o
     piso por `h / 2`, por `0` ou por "esconder o ponto", este par cai. */
  ok(
    "⛔ CONTINUIDADE: `max = 0` e `max > 0` põem a série zerada no MESMO y",
    buildPoints([0, 0], 0, W, H, PAD) === buildPoints([0, 0], 10, W, H, PAD),
    JSON.stringify(buildPoints([0, 0], 0, W, H, PAD)),
  );

  /* `max` não-finito é o chamador com o máximo quebrado rio acima. O desenho
     vai para o piso em vez de para fora da tela — e o limite está escrito na
     guarda, para não virar promessa de que a série foi saneada. */
  ok(
    "…e `max` NÃO-FINITO também não vaza para o DOM",
    finitos(buildPoints([1, 2], NaN, W, H, PAD)) && finitos(buildPoints([1, 2], Infinity, W, H, PAD)),
    "o defeito é de quem calculou o máximo; o que a guarda impede é o `NaN` no atributo",
  );

  /* ⛔ O LIMITE, e ele é asserção para não virar promessa: a guarda cobre o
     DENOMINADOR, nunca os VALORES. Sanear `arr` aqui esconderia defeito de
     quem produziu a série — é a família do `?? 0`. */
  ok(
    "⛔ LIMITE ESCRITO: `NaN` DENTRO da série continua saindo `NaN`",
    !finitos(buildPoints([1, NaN, 3], 10, W, H, PAD)),
    "a guarda é do denominador; sanear valor seria o `?? 0` de novo",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2b · 🔑 A INVARIANTE QUE AUTORIZOU MEXER EM CÓDIGO CONGELADO
 *
 * `format.ts` é anterior a `4e6aa9e`, e o instrumento de janela está
 * indisponível nesta máquina — ou seja, **não dá para conferir o gráfico na
 * tela**. O que substitui a conferência visual não é confiança: é uma
 * invariante mais forte que "parece igual".
 *
 * > ## Toda entrada cuja saída ANTES era finita produz saída IDÊNTICA, caractere por caractere.
 *
 * Ou seja: nada que o usuário conseguia ver mudou de lugar. Só o que era `NaN`
 * — e `NaN` não desenha — passou a existir.
 *
 * ⛔ Por isso a implementação antiga vive AQUI, como referência. Sem ela a
 * afirmação seria uma opinião sobre álgebra: `(i * w) / (n - 1)` e
 * `i * (w / (n - 1))` são iguais no papel e diferentes no último bit, e é
 * exatamente esse tipo de troca "inofensiva" que move um pixel sem ninguém ver.
 *
 * ⚠️ **Semente FIXA.** Aleatório de verdade dá teste que falha uma vez por
 * semana e ninguém reproduz.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2b · 🔑 a invariante: finito antes ⇒ idêntico depois");

  /** A implementação ANTERIOR ao guarda, palavra por palavra. */
  const antigo = (arr, max, w, h, pad) => {
    const n = arr.length;
    return arr.map((v, i) => `${(i * w) / (n - 1)},${h - pad - (v / max) * (h - pad * 2)}`).join(" ");
  };

  /* ⚠️ Gerador com semente fixa — o mesmo conjunto em toda execução, e grande
     demais para alguém tê-lo escolhido a dedo. */
  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const escolha = (a) => a[Math.floor(rnd() * a.length)];

  let finitasAntes = 0;
  let divergentes = [];
  let naoFinitasAntes = 0;
  for (let t = 0; t < 400; t++) {
    const n = 1 + Math.floor(rnd() * 8);
    const arr = Array.from({ length: n }, () => escolha([0, 0, rnd() * 1000, rnd() * 5, Math.floor(rnd() * 90)]));
    const max = escolha([0, 1, Math.max(...arr), Math.max(...arr) * 1.15, rnd() * 2000]);
    const w = escolha([100, 600, 37]);
    const h = escolha([40, 180, 91]);
    const pad = escolha([0, 4, 12]);

    const a = antigo(arr, max, w, h, pad);
    const b = buildPoints(arr, max, w, h, pad);
    if (finitos(a)) {
      finitasAntes++;
      if (a !== b) divergentes.push({ arr, max, w, h, pad, a, b });
    } else {
      naoFinitasAntes++;
    }
  }

  /* ⛔ LINHA DE BASE: sem ela, `divergentes.length === 0` passaria com ZERO
     entradas finitas examinadas — que é o `=== 0` sobre coleção vazia de
     novo. O denominador vai na saída, sempre. */
  ok(
    "linha de base: houve entrada finita para comparar",
    finitasAntes > 100,
    finitasAntes + " de 400 finitas antes · " + naoFinitasAntes + " degeneradas",
  );
  ok(
    "🔑 INVARIANTE: onde a saída era finita, ela é IDÊNTICA",
    divergentes.length === 0,
    divergentes.length
      ? JSON.stringify(divergentes[0]).slice(0, 200)
      : finitasAntes + " entradas conferidas caractere por caractere",
  );
  /* E a outra metade: as degeneradas, que ANTES saíam `NaN`, agora saem
     finitas. Sem esta, a invariante acima passaria com um `buildPoints` que
     não mudou nada. */
  ok(
    "…e as DEGENERADAS, que saíam `NaN`, agora saem finitas",
    naoFinitasAntes > 20,
    naoFinitasAntes + " entradas — é o que o guarda passou a cobrir",
  );
  {
    semente = 7;
    let corrigidas = 0;
    for (let t = 0; t < 400; t++) {
      const n = 1 + Math.floor(rnd() * 8);
      const arr = Array.from({ length: n }, () => escolha([0, 0, rnd() * 1000, rnd() * 5, Math.floor(rnd() * 90)]));
      const max = escolha([0, 1, Math.max(...arr), Math.max(...arr) * 1.15, rnd() * 2000]);
      const w = escolha([100, 600, 37]);
      const h = escolha([40, 180, 91]);
      const pad = escolha([0, 4, 12]);
      if (!finitos(antigo(arr, max, w, h, pad)) && finitos(buildPoints(arr, max, w, h, pad))) corrigidas++;
    }
    ok(
      "…e TODAS elas — nenhuma degenerada sobrou",
      corrigidas === naoFinitasAntes,
      corrigidas + " de " + naoFinitasAntes,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · A LINHA DO CHAMADOR NÃO É MAIS GUARDA — ELA É DECISÃO DE DESENHO
 *
 * ## ⛔ E ESTA DISTINÇÃO É O QUE IMPEDE A PRÓXIMA FAXINA DE APAGÁ-LA
 *
 * Com o denominador guardado na função, a leitura natural de
 * `cr.length > 1 ? cr : [...cr, ...cr]` passa a ser *"guarda duplicada, some
 * com ela"* — e esta base tem a regra de que duas fontes da mesma conta se
 * resolvem APAGANDO uma. **Aqui não são a mesma conta**, e as duas saídas são
 * visíveis:
 *
 * | quem trata o ponto único | o que o `<polyline>` desenha |
 * |---|---|
 * | a FUNÇÃO (`n > 1`) | um par `0,y` — polilinha de um ponto **não desenha nada** |
 * | o CHAMADOR (duplica) | `0,y w,y` — uma **linha reta** de ponta a ponta |
 *
 * A função impede o `NaN`; a duplicação decide que um dia de dado ainda vira
 * uma linha visível em vez de um gráfico vazio. **Apagá-la é mudança de tela**,
 * não limpeza — e a pergunta certa antes de remover um órfão nunca foi "alguém
 * usa?", foi *"o que isto FAZIA?"*.
 *
 * ⚠️ O `Math.max(1, …)` do `combinedMax`, esse sim, virou redundante com o
 * `temEscala`: os dois põem a série zerada no piso. Fica porque também é o
 * máximo do EIXO, não só o denominador — mas se um dia alguém o remover, o
 * desenho não muda. A distinção está aqui para a decisão ser tomada com o
 * número na mão.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · a linha do chamador — decisão de desenho, não guarda");

  /* ⛔ O PAR QUE PROVA A DISTINÇÃO ACIMA. Sem ele, a tabela do cabeçalho seria
     prosa, e prosa não impede ninguém de apagar a duplicação. */
  const semDuplicar = buildPoints([5], 10, W, H, PAD);
  const duplicando = buildPoints([5, 5], 10, W, H, PAD);
  ok(
    "🔑 a duplicação do chamador NÃO é a mesma coisa que a guarda da função",
    semDuplicar !== duplicando && coords(semDuplicar).length === 1 && coords(duplicando).length === 2,
    JSON.stringify(semDuplicar) + "  ×  " + JSON.stringify(duplicando),
  );
  ok(
    "…e é ela que faz UM dia de dado virar uma LINHA de ponta a ponta",
    coords(duplicando)[0][0] === 0 && coords(duplicando)[1][0] === W,
    "apagá-la deixaria o gráfico vazio — é mudança de tela, não faxina",
  );

  const semCom = (s) =>
    s.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
  const hook = semCom(readFileSync("src/components/dashboard/useTraffikState.ts", "utf8"));

  ok("linha de base: o hook chama `buildPoints` no CÓDIGO", /buildPoints\(/.test(hook));
  ok(
    "🔑 ele duplica o ponto único antes de chamar",
    /length > 1 \? c[rs] : \[\.\.\.c[rs], \.\.\.c[rs]\]/.test(hook),
    "hoje isso não impede mais o `NaN` — decide que um dia de dado vira LINHA",
  );

  /* E os chamadores continuam sendo os que se conhece. Um terceiro é
     informação: ele não herda a guarda. */
  {
    const { globSync } = await import("node:fs");
    const chamadores = globSync("src/**/*.{ts,tsx}")
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("generated") && !f.endsWith("lib/format.ts"))
      .filter((f) => /buildPoints\(/.test(semCom(readFileSync(f, "utf8"))));
    /* ⚠️ A contagem de chamadores continua importando, e por outro motivo: um
       segundo chamador agora HERDA a guarda do denominador (ela é da função),
       e NÃO herda a decisão de desenho do §3 — ele desenharia vazio com um
       ponto só, sem nada acusar. */
    ok(
      "há UM arquivo chamador",
      chamadores.length === 1 && chamadores[0].endsWith("useTraffikState.ts"),
      chamadores.join(" · ") + " — um segundo herda a guarda, não a duplicação",
    );
  }

  console.log(
    "\n   \x1b[32m✅ CORRIGIDO em 17/08/2026. Os dois denominadores são guardados na\n" +
      "      FUNÇÃO, e o §2b congela a invariante que autorizou mexer em código\n" +
      "      anterior a `4e6aa9e` sem poder ver a tela: onde a saída era finita,\n" +
      "      ela é IDÊNTICA caractere por caractere.\x1b[0m",
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
