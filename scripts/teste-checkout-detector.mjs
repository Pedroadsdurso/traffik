/**
 * O detector de checkout do `px.js` vê o botão de compra?
 *
 * ## O caso do testador (Cakto), 05/08/2026
 *
 * Ele recolou o snippet e o InitiateCheckout continuou não aparecendo. O domínio
 * **não** era o problema: `pay.cakto.com.br` casa com `cakto`, que está na lista
 * padrão. O problema era o detector.
 *
 * A versão anterior subia a árvore procurando **só `<a>` com `href`**. Construtor
 * de página moderno raramente entrega isso — o botão de compra costuma ser
 * `<button>`, um `<a>` sem `href`, `href="#"` com navegação por JS, ou um
 * `<div data-href>`. Em todos esses casos o detector desistia e **nada era
 * registrado nem logado**: o usuário só via "nunca recebido", sem causa.
 *
 * ## O que este teste protege, e são os dois lados
 *
 * | Risco | Asserções |
 * |---|---|
 * | **Cegueira** — não disparar num botão de compra real | as de `disparou: true` |
 * | **Ruído** — disparar em link que não é checkout | as de `disparou: false` |
 *
 * O segundo lado é o que impede a correção de virar um detector que dispara em
 * tudo: ampliar de ONDE a URL vem não pode afrouxar o teste de QUAL URL conta.
 *
 * Puro: um DOM falso, sem navegador, sem banco, sem rede.
 *
 *   npm run test:checkout-detector
 */
import assert from "node:assert/strict";

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

/** Elemento mínimo com a API que o detector usa. */
function el(tag, attrs = {}, texto = "") {
  return {
    tagName: tag.toUpperCase(),
    _attrs: attrs,
    textContent: texto,
    className: attrs.class || "",
    id: attrs.id || "",
    parentElement: null,
    getAttribute(n) {
      return Object.prototype.hasOwnProperty.call(this._attrs, n) ? this._attrs[n] : null;
    },
    matches() { return false; },
  };
}
function dentro(filho, pai) { filho.parentElement = pai; return filho; }

/**
 * Roda o script gerado num DOM falso e devolve os eventos que ele despachou.
 *
 * ⚠️ Executa o SCRIPT GERADO, não uma reimplementação da lógica. Reescrever o
 * detector aqui provaria que o teste está certo, não que o snippet está.
 */
function rodar(alvoDoClique, cfg = {}) {
  const enviados = [];
  const ouvintes = [];
  const body = el("body");
  const documento = {
    body,
    cookie: "",
    addEventListener: (tipo, fn) => ouvintes.push({ tipo, fn }),
    querySelector: () => null,
  };
  const janela = {
    document: documento,
    location: { href: "https://loja.exemplo/pagina", search: "", origin: "https://loja.exemplo" },
    fetch: (_u, o) => { enviados.push(JSON.parse(o.body)); return Promise.resolve({ ok: true, json: () => ({}) }); },
    navigator: { sendBeacon: () => false },
    setTimeout: () => 0,
    URLSearchParams: global.URLSearchParams,
    JSON,
    Math,
    Date,
    console: { warn() {}, log() {} },
  };
  janela.window = janela;

  const src = pixelScript({
    configId: "cfg-teste",
    apiBase: "https://api.exemplo",
    lead: false,
    addToCart: false,
    temPixelNativo: false,
    initiateCheckout: { enabled: true, ...cfg },
  });
  new Function("window", "document", "location", "fetch", "navigator", "setTimeout", "URLSearchParams", "console", src)(
    janela, documento, janela.location, janela.fetch, janela.navigator, janela.setTimeout, global.URLSearchParams, janela.console,
  );

  enviados.length = 0; // descarta o PageView do carregamento
  for (const o of ouvintes) if (o.tipo === "click") o.fn({ target: alvoDoClique });
  return enviados.filter((e) => e.event === "InitiateCheckout");
}

const CAKTO = "https://pay.cakto.com.br/abc123";

console.log("\n\x1b[1m1. DEVE disparar — é um botão de compra de verdade\x1b[0m\n");

checar("<a href> para a Cakto (o caso que já funcionava)", () => {
  assert.equal(rodar(el("a", { href: CAKTO }, "Comprar")).length, 1);
});

checar("clique num <span> DENTRO do link (sobe a árvore)", () => {
  const a = el("a", { href: CAKTO }, "Comprar");
  assert.equal(rodar(dentro(el("span", {}, "Comprar"), a)).length, 1);
});

checar("<button data-href> — construtor de página, sem <a>", () => {
  // Era o caso CEGO: sem <a href>, o detector antigo desistia em silêncio.
  assert.equal(rodar(el("button", { "data-href": CAKTO }, "Comprar agora")).length, 1);
});

checar("<div data-url>", () => {
  assert.equal(rodar(el("div", { "data-url": CAKTO }, "Quero")).length, 1);
});

checar("<div data-link>", () => {
  assert.equal(rodar(el("div", { "data-link": CAKTO }, "Quero")).length, 1);
});

checar("<form action> apontando para o checkout", () => {
  const f = el("form", { action: CAKTO });
  assert.equal(rodar(dentro(el("button", {}, "Finalizar"), f)).length, 1);
});

checar("Kirvano, Hotmart, Kiwify e Monetizze seguem casando", () => {
  for (const u of [
    "https://pay.kirvano.com/x", "https://pay.hotmart.com/y",
    "https://x.kiwify.com.br/z", "https://monetizze.com.br/w",
  ]) {
    assert.equal(rodar(el("a", { href: u }, "Comprar")).length, 1, u);
  }
});

checar("o destino vai no payload, para o diagnóstico saber para onde foi", () => {
  const [ev] = rodar(el("a", { href: CAKTO }, "Comprar"));
  assert.equal(ev.destino, CAKTO);
});

checar("manda o click_id da jornada (null aqui: cookie vazio no DOM falso)", () => {
  const [ev] = rodar(el("a", { href: CAKTO }, "Comprar"));
  // O que importa é a CHAVE existir no payload: sem ela o servidor não resolve a
  // jornada e o checkout volta a duplicar.
  assert.ok("click_id" in ev, `payload sem click_id: ${JSON.stringify(Object.keys(ev))}`);
});

console.log("\n\x1b[1m2. NÃO deve disparar — ampliar a origem da URL não afrouxa o critério\x1b[0m\n");

checar("link comum do site não é checkout", () => {
  assert.equal(rodar(el("a", { href: "https://loja.exemplo/sobre" }, "Sobre nós")).length, 0);
});

checar("âncora (#) é navegação na página, não destino", () => {
  assert.equal(rodar(el("a", { href: "#comprar" }, "Comprar")).length, 0);
});

checar("javascript: é no-op, não destino", () => {
  assert.equal(rodar(el("a", { href: "javascript:void(0)" }, "Comprar")).length, 0);
});

checar("elemento sem nenhum atributo de URL não dispara", () => {
  assert.equal(rodar(el("button", {}, "Comprar agora")).length, 0);
});

checar("texto 'comprar' sozinho NÃO basta — precisa de URL de checkout", () => {
  // O detector é de DESTINO, não de intenção. Disparar por texto encheria o
  // funil de cliques em qualquer botão escrito "comprar".
  assert.equal(rodar(el("div", { "data-href": "https://loja.exemplo/blog" }, "Comprar")).length, 0);
});

checar("IC desligado não dispara nem com link de checkout", () => {
  assert.equal(rodar(el("a", { href: CAKTO }, "Comprar"), { enabled: false }).length, 0);
});

console.log("\n\x1b[1m3. Lista de domínios do usuário substitui a padrão\x1b[0m\n");

checar("domínio próprio do usuário casa", () => {
  assert.equal(rodar(el("a", { href: "https://meucheck.com.br/x" }, "Ir"), { value: "meucheck.com.br" }).length, 1);
});

checar("e a padrão deixa de valer quando ele lista a dele", () => {
  // Comportamento antigo e deliberado: quem lista assume a lista.
  assert.equal(rodar(el("a", { href: CAKTO }, "Ir"), { value: "meucheck.com.br" }).length, 0);
});

console.log(`\n\x1b[1m${ok} asserções, ${falhas.length} falha(s)\x1b[0m\n`);
if (falhas.length) console.log("Falharam:\n  - " + falhas.join("\n  - ") + "\n");
process.exit(falhas.length === 0 ? 0 : 1);
