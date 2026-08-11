/**
 * `montarUrl` — a montagem da URL de rastreamento.
 *
 * ## Por que este teste existe, e por que ele é sobre PROPRIEDADE
 *
 * Esta função produz um texto que o usuário **cola num anúncio**. Um caractere
 * errado não deixa a tela feia: manda tráfego pago para o lugar errado, ou
 * quebra a atribuição de uma campanha inteira sem nada acusar.
 *
 * O bug que nomeou o arquivo foi o `[object Object]`, e ele passou por `tsc`:
 * o valor atravessou uma fronteira (estado de formulário, modelo salvo,
 * `JSON.parse`) onde o tipo é uma promessa e não uma medição. Por isso o guarda
 * é de runtime — e por isso a asserção dele **passa um objeto de verdade**.
 *
 * ⛔ Contagem `=== 0` passa com a coleção vazia. Onde há "não deve conter", há
 * antes uma linha de base afirmando que houve o que examinar.
 *
 * Puro: sem banco, sem rede, sem DOM.
 *
 *   npm run test:utm-url
 */
import assert from "node:assert/strict";

const { montarUrl, valorDeTexto, CHAVES_UTM, ROTULO_UTM, AJUDA_UTM } = await import(
  "../src/lib/utm/construir.ts"
);

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

const BASE = "https://seudominio.com/checkout";

console.log("\n\x1b[1mO guarda do [object Object]\x1b[0m");

checar("valorDeTexto recusa objeto, array, número e função", () => {
  assert.equal(valorDeTexto({ a: 1 }), null);
  assert.equal(valorDeTexto([1, 2]), null);
  assert.equal(valorDeTexto(42), null);
  assert.equal(valorDeTexto(() => "x"), null);
  // A linha de base: com string ele DEVOLVE, senão "recusa tudo" também passaria.
  assert.equal(valorDeTexto("  facebook  "), "facebook");
});

checar("🔴 objeto num campo NÃO vira texto na URL — o guarda DISPARA", () => {
  const r = montarUrl({ base: BASE, utm_source: { toString: () => "facebook" } });
  // O caso ERRADO produziria isto. É o valor que o defeito original gerava.
  assert.ok(!r.url.includes("[object Object]"), "o objeto vazou para a URL");
  assert.ok(!r.url.includes("utm_source"), "o campo descartado ainda entrou");
  // E ele é DENUNCIADO, não engolido em silêncio.
  assert.deepEqual(r.descartados, ["utm_source"]);
  assert.equal(r.estado, "invalida");
});

checar("um campo válido ao lado de um inválido não é contaminado", () => {
  const r = montarUrl({ base: BASE, utm_source: {}, utm_medium: "cpc" });
  assert.deepEqual(r.descartados, ["utm_source"]);
  assert.equal(r.parametros.length, 1);
  assert.ok(r.url.includes("utm_medium=cpc"));
});

console.log("\n\x1b[1mA URL montada\x1b[0m");

checar("os seis parâmetros saem na ordem canônica", () => {
  const entrada = { base: BASE };
  for (const c of CHAVES_UTM) entrada[c] = `v-${c}`;
  const r = montarUrl(entrada);
  assert.equal(r.estado, "valida");
  assert.deepEqual(
    r.parametros.map((p) => p.chave),
    [...CHAVES_UTM],
  );
});

checar("valor com espaço e acento é codificado", () => {
  const r = montarUrl({ base: BASE, utm_campaign: "lançamento pro" });
  assert.ok(r.url.includes("utm_campaign=lan%C3%A7amento+pro"), r.url);
  // O chip mostra o valor CRU — ele é para ler, não para colar.
  assert.equal(r.parametros[0].valor, "lançamento pro");
});

checar("campo em branco não vira parâmetro vazio", () => {
  const r = montarUrl({ base: BASE, utm_source: "fb", utm_medium: "   " });
  assert.equal(r.parametros.length, 1);
  assert.ok(!r.url.includes("utm_medium"));
  assert.deepEqual(r.descartados, [], "espaço em branco não é descarte, é campo vazio");
});

checar("🔴 parâmetro que já existe na base é SUBSTITUÍDO, nunca duplicado", () => {
  const r = montarUrl({ base: `${BASE}?utm_source=antigo&pid=9`, utm_source: "facebook" });
  assert.equal(r.url.match(/utm_source=/g).length, 1, "saiu duplicado");
  assert.ok(r.url.includes("utm_source=facebook"));
  // O que já estava e não é nosso continua lá.
  assert.ok(r.url.includes("pid=9"), "parâmetro alheio da base foi comido");
});

checar("🔴 o fragmento fica DEPOIS dos parâmetros, não os engole", () => {
  const r = montarUrl({ base: "https://x.com/p#oferta", utm_source: "fb" });
  // O caso errado produz `.../p#oferta?utm_source=fb` — os parâmetros entram no
  // fragmento, que nunca sai do navegador, e a atribuição some em silêncio.
  assert.ok(r.url.indexOf("utm_source") < r.url.indexOf("#"), r.url);
  assert.equal(r.url, "https://x.com/p?utm_source=fb#oferta");
});

console.log("\n\x1b[1mOs três estados\x1b[0m");

checar("sem base = incompleta, e a URL sai VAZIA (nunca pela metade)", () => {
  const r = montarUrl({ utm_source: "fb" });
  assert.equal(r.estado, "incompleta");
  assert.equal(r.url, "", "ofereceu para copiar uma URL sem destino");
  assert.ok(r.problemas.length > 0);
});

checar("base sem esquema = invalida", () => {
  const r = montarUrl({ base: "seudominio.com/checkout", utm_source: "fb" });
  assert.equal(r.estado, "invalida");
  assert.equal(r.url, "");
});

checar("🔴 javascript: não é base utilizável", () => {
  const r = montarUrl({ base: "javascript:alert(1)", utm_source: "fb" });
  assert.equal(r.estado, "invalida");
  assert.equal(r.url, "");
});

checar("base ok e zero parâmetros = incompleta", () => {
  const r = montarUrl({ base: BASE });
  assert.equal(r.estado, "incompleta");
  assert.ok(r.problemas.some((p) => p.includes("Nenhum parâmetro")));
});

checar("o caminho feliz é 'valida' e sem problemas", () => {
  const r = montarUrl({ base: BASE, utm_source: "facebook", utm_medium: "cpc" });
  assert.equal(r.estado, "valida");
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.descartados, []);
});

console.log("\n\x1b[1mOs rótulos acompanham as chaves\x1b[0m");

checar("toda chave tem rótulo e ajuda — chave nova sem texto não passa", () => {
  for (const c of CHAVES_UTM) {
    assert.ok(ROTULO_UTM[c], `sem rótulo: ${c}`);
    assert.ok(AJUDA_UTM[c], `sem ajuda: ${c}`);
  }
  assert.equal(Object.keys(ROTULO_UTM).length, CHAVES_UTM.length);
  assert.equal(Object.keys(AJUDA_UTM).length, CHAVES_UTM.length);
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
