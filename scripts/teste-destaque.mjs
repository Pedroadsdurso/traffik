/**
 * `destacar` — o realce de sintaxe dos snippets.
 *
 * ## A INVARIANTE, e por que ela é o teste inteiro
 *
 * O código realçado aqui é um artefato que o usuário **copia e instala no site
 * dele**. Um realce que perde, reordena ou duplica um caractere não deixa o
 * código feio: deixa o código DIFERENTE do que a ferramenta gerou, e não há como
 * o usuário saber.
 *
 *   > concatenar o texto de todos os tokens devolve a entrada, exata.
 *
 * ⛔ Isto é uma PROPRIEDADE, não um conjunto de casos: ela não conhece nenhuma
 * cor, nenhuma classe e nenhum trecho. Cai sozinha no dia em que alguém
 * acrescentar uma palavra-chave e comer um espaço, sem ninguém ter previsto a
 * entrada nova. Um teste que congelasse a lista de tokens defenderia o bug.
 *
 * ## Entrada adversária, e por que ela não é enfeite
 *
 * Aspas sem fechar, comentário sem fim e `<script>` sem `</script>` são o que
 * quebra scanner escrito à mão — e os três aparecem de verdade quando o gerador
 * de script é interrompido no meio. A saída aceitável ali é **código sem cor**;
 * a inaceitável é código alterado. As asserções cobram a primeira.
 *
 * ⚠️ Roda com `tsx` (lê `.tsx`), não com `--experimental-strip-types`.
 *
 *   npm run test:destaque
 */
import assert from "node:assert/strict";

const { destacar, adivinharLinguagem } = await import("../src/components/tk/CodigoDestacado.tsx");
const { utmScript, backRedirectScript } = await import("../src/lib/utm/scripts.ts");
const { pixelScript } = await import("../src/lib/pixel/script.ts");

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try {
    fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

/** A invariante, aplicada. */
function refaz(codigo, ling) {
  return destacar(codigo, ling)
    .map((t) => t.t)
    .join("");
}

const SCRIPT_UTM = utmScript("conta-1", "https://app.exemplo.com", "ws-A");
const SCRIPT_BACK = backRedirectScript("https://exemplo.com/oferta");
const SCRIPT_PIXEL = pixelScript({
  configId: "px-1",
  apiBase: "https://app.exemplo.com",
  lead: true,
  addToCart: true,
  initiateCheckout: { enabled: true, type: "clique_checkout" },
});

console.log("\n\x1b[1mA invariante nos artefatos REAIS\x1b[0m");

for (const [nome, codigo] of [
  ["script de UTM", SCRIPT_UTM],
  ["script de back redirect", SCRIPT_BACK],
  ["script de pixel", SCRIPT_PIXEL],
]) {
  checar(`${nome}: o texto sai idêntico ao que entrou`, () => {
    // Linha de base: se o gerador devolvesse "", a invariante passaria sem medir.
    assert.ok(codigo.length > 200, `entrada curta demais (${codigo.length})`);
    assert.equal(refaz(codigo, "js"), codigo);
  });

  checar(`${nome}: houve o que classificar (não caiu tudo em 'texto')`, () => {
    const classes = new Set(destacar(codigo, "js").map((t) => t.c));
    classes.delete("texto");
    assert.ok(classes.size >= 3, `só classificou ${[...classes].join(", ")}`);
  });
}

console.log("\n\x1b[1mA invariante nas três linguagens\x1b[0m");

const HTML = `<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s){ if(f.fbq) return; }(window, document);
  fbq('init', '1234567890');
  fbq('track', 'PageView'); // dispara
</script>
<noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=123&ev=PageView" /></noscript>`;

const JSON_TXT = `{
  "evento": "Purchase",
  "valor": 197.50,
  "aprovada": true,
  "cupom": null,
  "utms": ["utm_source", "utm_medium"]
}`;

checar("HTML com <script> dentro: texto idêntico", () => {
  assert.equal(refaz(HTML, "html"), HTML);
});

checar("🔴 o miolo do <script> é tokenizado como JS, não como texto corrido", () => {
  const dentro = destacar(HTML, "html");
  // `fbq('init', ...)` — a cadeia está DENTRO do script. Se o delegador não
  // rodasse, ela sairia como `texto` junto do resto.
  const cadeias = dentro.filter((t) => t.c === "cadeia").map((t) => t.t);
  assert.ok(cadeias.includes("'init'"), `cadeias vistas: ${cadeias.join(" | ")}`);
  assert.ok(cadeias.includes("'PageView'"));
  // E a tag continua sendo tag.
  assert.ok(dentro.some((t) => t.c === "tag" && t.t === "script"));
  assert.ok(dentro.some((t) => t.c === "comentario" && t.t.startsWith("<!--")));
});

checar("JSON: texto idêntico, e CHAVE se distingue de valor", () => {
  assert.equal(refaz(JSON_TXT, "json"), JSON_TXT);
  const t = destacar(JSON_TXT, "json");
  const chaves = t.filter((x) => x.c === "chave").map((x) => x.t);
  const cadeias = t.filter((x) => x.c === "cadeia").map((x) => x.t);
  assert.ok(chaves.includes('"evento"'), `chaves: ${chaves.join(" | ")}`);
  // `"Purchase"` é VALOR — o caso errado o classificaria como chave também.
  assert.ok(cadeias.includes('"Purchase"'), `cadeias: ${cadeias.join(" | ")}`);
  assert.ok(!chaves.includes('"Purchase"'), "valor foi lido como chave");
  assert.ok(t.some((x) => x.c === "numero" && x.t === "197.50"));
  assert.ok(t.some((x) => x.c === "palavra" && x.t === "true"));
});

console.log("\n\x1b[1mEntrada adversária — a saída segura é SEM COR, nunca alterada\x1b[0m");

const ADVERSARIAS = [
  ["aspa simples sem fechar", `var a = "isto nunca fecha;\nvar b = 2;`, "js"],
  ["comentário de bloco sem fim", `var a = 1; /* começou e não terminou`, "js"],
  ["<script> sem </script>", `<div><script>var x = "a";`, "html"],
  ["tag sem fechar o >", `<div class="x"`, "html"],
  ["JSON truncado no meio da cadeia", `{ "a": "val`, "json"],
  ["barra invertida no fim da cadeia", `var s = "escapa \\\\";`, "js"],
  ["template literal com quebra de linha", "var s = `linha 1\nlinha 2`;", "js"],
  ["só espaços em branco", "   \n\t  ", "js"],
  ["caractere solto", "<", "html"],
  ["unicode e emoji", 'var s = "olá 🎯 mundo";', "js"],
];

for (const [nome, entrada, ling] of ADVERSARIAS) {
  checar(`${nome}: nenhum caractere perdido`, () => {
    assert.equal(refaz(entrada, ling), entrada);
  });
}

checar("entrada vazia e não-string não explodem", () => {
  assert.deepEqual(destacar("", "js"), []);
  assert.deepEqual(destacar(null, "js"), []);
  assert.deepEqual(destacar(undefined, "html"), []);
});

console.log("\n\x1b[1mFuzz: a invariante contra entrada montada ao acaso\x1b[0m");

checar("🎲 300 entradas com semente fixa, nas três linguagens", () => {
  /* Semente FIXA: aleatório de verdade dá teste que falha uma vez por semana e
     ninguém reproduz. Com semente, o conjunto é sempre o mesmo e continua sendo
     grande demais para alguém tê-lo escolhido a dedo. */
  let semente = 7;
  const rnd = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  const PECAS = [
    '"', "'", "`", "\\", "/*", "*/", "//", "\n", "<", ">", "</script>", "<script>",
    "{", "}", ":", ",", "function", "var", "true", "null", "123", "4.5", " ", "\t",
    "fbq", "=", "<!--", "-->", "#", "&", "utm_source", "é", "🎯",
  ];
  const LINGS = ["js", "html", "json"];

  for (let n = 0; n < 300; n++) {
    let s = "";
    const pedacos = 3 + Math.floor(rnd() * 14);
    for (let i = 0; i < pedacos; i++) s += PECAS[Math.floor(rnd() * PECAS.length)];
    const ling = LINGS[Math.floor(rnd() * LINGS.length)];
    assert.equal(refaz(s, ling), s, `perdeu caractere em ${ling}: ${JSON.stringify(s)}`);
  }
});

console.log("\n\x1b[1mAdivinhação de linguagem\x1b[0m");

checar("adivinha pelo primeiro caractere significativo", () => {
  assert.equal(adivinharLinguagem("  <div>x</div>"), "html");
  assert.equal(adivinharLinguagem('\n{ "a": 1 }'), "json");
  assert.equal(adivinharLinguagem("(function(){})()"), "js");
  assert.equal(adivinharLinguagem(SCRIPT_UTM), "js");
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
