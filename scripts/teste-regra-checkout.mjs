/**
 * A regra de InitiateCheckout dispara mesmo? — exercitada num DOM falso.
 *
 * # O bug que este teste existe para não deixar voltar
 *
 * `rulesFromForm` só gravava `detection` quando havia **valor**, e o valor
 * vazio é a configuração RECOMENDADA (`clique_checkout` sem domínios — a tela
 * diz "vazio já cobre Kirvano, Cakto, Hotmart…"). Então o caso comum chegava ao
 * gerador como `type: undefined` e o script saía com:
 *
 *     var IC = { type: "", value: "" };
 *     var CHECKOUT = [];
 *
 * `""` não casa com nenhum ramo do `if` do script. **Todo pixel criado com os
 * padrões nunca disparou InitiateCheckout pelo clique** — e o diagnóstico da
 * gaveta dizia "ok", porque `conferirSnippet` e `assinatura()` aplicavam os
 * dois o mesmo `?? "clique_checkout"` ao calcular o hash. Um default aplicado
 * no verificador e não no verificado torna o verificador cego exatamente ao que
 * ele existe para pegar.
 *
 * ⚠️ Nenhum `tsc`/`lint`/`build` acusa isso: o script é uma string.
 *
 * Por isso as asserções centrais aqui **executam o script gerado** e observam o
 * POST, em vez de conferir o texto dele.
 */
import { pixelScript, TIPO_IC_PADRAO } from "../src/lib/pixel/script.ts";
import { assinaturaDetectores } from "../src/lib/pixel/detectores.ts";
import { REGRA_DE_CHECKOUT, lerPreset } from "../src/lib/pixel/preset.ts";

let ok = 0;
const falhas = [];
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome}\n        obtido:   ${a}\n        esperado: ${b}`); }
}

// ───────────────────────────── DOM falso ─────────────────────────────

/** Um elemento mínimo: só o que o script realmente toca. */
function el(tag, { href, texto = "", classe = "", pai = null } = {}) {
  return {
    tagName: tag.toUpperCase(),
    textContent: texto,
    className: classe,
    id: "",
    parentElement: pai,
    getAttribute: (k) => (k === "href" ? (href ?? null) : null),
    matches: () => false,
  };
}

function montar({ url = "https://loja.exemplo/oferta" } = {}) {
  const posts = [];
  const cliques = [];
  const body = el("body");
  const win = {
    location: { href: url, search: "" },
    console: { warn() {} },
    // Com `fbq` presente o espelho sai na hora e nada fica pendurado — este
    // teste é sobre a REGRA, não sobre o espelho (esse é o teste:espelho).
    fbq: () => {},
  };
  const ambiente = {
    window: win,
    document: {
      cookie: "",
      body,
      addEventListener: (tipo, fn) => { if (tipo === "click") cliques.push(fn); },
    },
    location: win.location,
    URLSearchParams,
    JSON,
    Date: { now: () => 1_700_000_000_000 },
    fetch: (_u, init) => { posts.push(JSON.parse(init.body)); return Promise.resolve(); },
    setInterval: () => 1,
    clearInterval: () => {},
    decodeURIComponent,
  };
  return {
    ambiente, posts, body,
    /** Clica num alvo, propagando pela captura como o navegador faria. */
    clicar(alvo) { for (const fn of cliques) fn({ target: alvo }); },
    /** Só os InitiateCheckout — o PageView sempre sai e não interessa aqui. */
    ics: () => posts.filter((p) => p.event === "InitiateCheckout"),
  };
}

function rodar(cfg, env) {
  const codigo = pixelScript(cfg);
  const nomes = Object.keys(env.ambiente);
  // `new Function` também valida a sintaxe do script gerado.
  new Function(...nomes, codigo)(...nomes.map((n) => env.ambiente[n]));
  return codigo;
}

const base = { configId: "cfg_1", apiBase: "https://app.traffik.io", lead: false, addToCart: false };

/** Um `<span>` dentro de um `<a href>` — o alvo real de quase todo clique. */
function linkCom(href, body) {
  const a = el("a", { href, pai: body });
  return el("span", { texto: "Comprar agora", pai: a });
}

// ─────────────── 1. O caso que estava morto: padrão da gaveta ───────────────

console.log("\n1) REGRA PADRAO como a gaveta a gravava (type e value ausentes)");
{
  const env = montar();
  const codigo = rodar({ ...base, initiateCheckout: { enabled: true } }, env);
  eq("o script materializa o tipo", /var IC = \{ type: "clique_checkout"/.test(codigo), true);
  eq("a lista de dominios NAO fica vazia", /var CHECKOUT = \["pay\.kirvano\.com"/.test(codigo), true);

  env.clicar(linkCom("https://pay.cakto.com.br/abc123", env.body));
  eq("clique no checkout da Cakto dispara IC", env.ics().length, 1);
  eq("o destino viaja no evento", env.ics()[0].destino, "https://pay.cakto.com.br/abc123");
}

console.log("\n2) O MESMO clique, com o tipo explicito — comportamento identico");
{
  const env = montar();
  rodar({ ...base, initiateCheckout: { enabled: true, type: "clique_checkout", value: "" } }, env);
  env.clicar(linkCom("https://pay.cakto.com.br/abc123", env.body));
  eq("dispara igual", env.ics().length, 1);
}

// ─────────────── 3. Os domínios que o padrão tem de cobrir ───────────────

console.log("\n3) DOMINIOS DE CHECKOUT cobertos pelo padrao (lista vazia)");
{
  const casos = [
    ["Cakto", "https://pay.cakto.com.br/xyz", true],
    ["Kirvano", "https://pay.kirvano.com/abc", true],
    ["Hotmart", "https://pay.hotmart.com/X999", true],
    ["Kiwify", "https://pay.kiwify.com.br/abc", true],
    ["Cartpanda", "https://loja.cartpanda.com/checkout/1", true],
    ["Monetizze", "https://app.monetizze.com.br/checkout/x", true],
    ["gateway novo com pay.", "https://pay.qualquer.io/z", true],
    ["link comum do proprio site", "https://loja.exemplo/sobre", false],
    ["ancora interna", "#depoimentos", false],
  ];
  for (const [nome, href, esperado] of casos) {
    const env = montar();
    rodar({ ...base, initiateCheckout: { enabled: true } }, env);
    env.clicar(linkCom(href, env.body));
    eq(`${nome} -> ${esperado ? "dispara" : "nao dispara"}`, env.ics().length === 1, esperado);
  }
}

// ─────────────── 4. "No meu próprio site" — contem_url ───────────────

console.log("\n4) CONTEM_URL — a regra de quem paga no proprio site");
{
  const env = montar({ url: "https://loja.exemplo/checkout?p=1" });
  rodar({ ...base, initiateCheckout: { enabled: true, type: "contem_url", value: "/checkout" } }, env);
  eq("URL que casa dispara no carregamento", env.ics().length, 1);
}
{
  const env = montar({ url: "https://loja.exemplo/oferta" });
  rodar({ ...base, initiateCheckout: { enabled: true, type: "contem_url", value: "/checkout" } }, env);
  eq("URL que nao casa nao dispara", env.ics().length, 0);
}
{
  // 🔴 O erro OPOSTO, e tão mudo quanto: "".indexOf("") é 0, então sem o guarda
  // toda visita ao site viraria checkout iniciado e inflaria o topo do funil.
  const env = montar({ url: "https://loja.exemplo/qualquer-pagina" });
  rodar({ ...base, initiateCheckout: { enabled: true, type: "contem_url", value: "" } }, env);
  eq("SEM trecho de URL nao dispara em pagina nenhuma", env.ics().length, 0);
}
{
  // Mesmo guarda para os modos manuais do avançado.
  const env = montar();
  rodar({ ...base, initiateCheckout: { enabled: true, type: "contem_texto", value: "" } }, env);
  env.clicar(linkCom("https://loja.exemplo/sobre", env.body));
  eq("contem_texto sem valor nao dispara em clique nenhum", env.ics().length, 0);
}
{
  const env = montar();
  rodar({ ...base, initiateCheckout: { enabled: true, type: "contem_texto", value: "comprar agora" } }, env);
  env.clicar(linkCom("https://loja.exemplo/sobre", env.body));
  eq("contem_texto COM valor dispara", env.ics().length, 1);
}

console.log("\n5) DESLIGADO nao dispara de jeito nenhum");
{
  const env = montar({ url: "https://loja.exemplo/checkout" });
  rodar({ ...base, initiateCheckout: { enabled: false } }, env);
  env.clicar(linkCom("https://pay.cakto.com.br/abc", env.body));
  eq("nenhum IC", env.ics().length, 0);
  eq("mas o PageView continua saindo", env.posts.filter((p) => p.event === "PageView").length, 1);
}

// ─────────────── 6. A assinatura deixou de mentir ───────────────

console.log("\n6) ASSINATURA — o diagnostico enxerga o tipo que o script tem");
{
  const codigo = pixelScript({ ...base, initiateCheckout: { enabled: true } });
  const doScript = codigo.match(/var DET = "([^"]+)"/)[1];
  const donos = {
    PageView: "navegador", Lead: "traffik", AddToCart: "traffik",
    InitiateCheckout: "traffik", Purchase: "traffik",
  };
  // O que `conferirSnippet` calcula para a MESMA regra gravada.
  const doServidor = assinaturaDetectores({
    lead: false, addToCart: false, ic: TIPO_IC_PADRAO, icValor: null, nativo: true, donos,
  });
  eq("script e servidor concordam", doScript, doServidor);

  // E a prova de que o "ok" agora significa alguma coisa: uma regra REALMENTE
  // diferente tem de produzir assinatura diferente.
  const outra = assinaturaDetectores({
    lead: false, addToCart: false, ic: "contem_url", icValor: "/checkout", nativo: true, donos,
  });
  eq("regra diferente -> assinatura diferente", doScript === outra, false);
}

// ─────────────── 7. A pergunta e a regra são a MESMA coisa ───────────────

console.log("\n7) PRESET — 'onde o comprador paga' e derivado da regra gravada");
{
  eq("gateway -> clique_checkout", REGRA_DE_CHECKOUT.gateway, "clique_checkout");
  eq("proprio site -> contem_url", REGRA_DE_CHECKOUT.proprio_site, "contem_url");

  const donos = { PageView: "navegador", Purchase: "traffik" };
  eq("regra de clique -> paga no gateway",
    lerPreset({}, donos, "clique_checkout").ondeSePaga, "gateway");
  eq("regra de URL -> paga no proprio site",
    lerPreset({}, donos, "contem_url").ondeSePaga, "proprio_site");
  // Pixel anterior ao campo, sem regra gravada: cai no padrão de sempre.
  eq("sem regra gravada -> gateway (o padrao de sempre)",
    lerPreset({}, donos, null).ondeSePaga, "gateway");
  // ⚠️ O `setup` NÃO manda aqui: se mandasse, um ajuste pelo avançado deixaria
  // a pergunta mostrando a resposta antiga. Duas fontes divergem sempre.
  eq("setup contradizendo a regra NAO vence",
    lerPreset({ ondeSePaga: "proprio_site" }, donos, "clique_checkout").ondeSePaga, "gateway");

  // Os dois campos que PRECISAM do setup, porque não têm outra coluna.
  eq("outroEnviaPurchase gravado e respeitado",
    lerPreset({ outroEnviaPurchase: true }, donos, null).outroEnviaPurchase, true);
  eq("temPixelNativo gravado e respeitado",
    lerPreset({ temPixelNativo: false }, donos, null).temPixelNativo, false);
}

console.log(`\n${ok} asserções ok, ${falhas.length} falhas`);
if (falhas.length) { console.log("FALHOU:", falhas.join(" · ")); process.exit(1); }
