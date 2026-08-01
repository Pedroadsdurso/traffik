/**
 * As propriedades do `eid` do script de pixel, num DOM falso.
 *
 * ## Por que existe
 *
 * O gerador de id foi reescrito em 01/08/2026 depois de DUAS causas medidas em
 * produção (ver `npm run pixel:duplicados`):
 *
 * - **causa 1** — dois POSTs a 4 ms com `location.href` diferente
 *   (`/checkout?qty=1` × `/checkout?product=…&qty=1`);
 * - **causa 3** — dois POSTs a 921 ms cruzando a fronteira do balde fixo de 10 s.
 *
 * Id diferente = linha duplicada no banco e evento contado duas vezes na Meta.
 * `tsc`, `lint` e `build` passam com o gerador errado — só um teste que compara
 * ids acusa.
 *
 * ⚠️ Não basta "o script executa" (isso o `teste-espelho-pixel` já prova). O
 * que precisa ser exercitado é **quando dois ids são iguais e quando não são**.
 */
import { pixelScript } from "../src/lib/pixel/script.ts";

let ok = 0;
const falhas = [];
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome}\n        obtido:   ${a}\n        esperado: ${b}`); }
}
function diferente(nome, a, b) {
  if (a !== b) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome}\n        os dois vieram: ${a}`); }
}

/**
 * Um "carregamento de página": cada chamada devolve um ambiente novo, com
 * relógio e URL controláveis. A ÂNCORA nasce aqui — dois carregamentos nunca
 * compartilham id, e é isso que faz recarregar a página continuar contando.
 */
function carregar({ pathname = "/checkout", search = "", agora = 1_700_000_000_000, cfg = {} } = {}) {
  const posts = [];
  const loc = { href: "https://loja.exemplo" + pathname + search, pathname, search };
  const win = { location: loc, console: { warn() {} }, fbq: () => {} };
  let relogio = agora;

  const ambiente = {
    window: win,
    document: { cookie: "", addEventListener() {} },
    location: loc,
    URLSearchParams,
    JSON,
    Date: { now: () => relogio },
    fetch: (_u, init) => { posts.push(JSON.parse(init.body)); return Promise.resolve(); },
    setInterval: () => 1,
    clearInterval: () => {},
    decodeURIComponent,
  };

  const codigo = pixelScript({
    configId: "cfg_1",
    apiBase: "https://app.traffik.io",
    lead: true,
    addToCart: false,
    initiateCheckout: { enabled: false },
    eventOwners: { PageView: "traffik" },
    ...cfg,
  });
  const nomes = Object.keys(ambiente);
  new Function(...nomes, codigo)(...nomes.map((n) => ambiente[n]));

  return {
    posts,
    /** Muda a URL DENTRO do mesmo carregamento — é a causa 1. */
    irPara(p, s = "") { loc.pathname = p; loc.search = s; loc.href = "https://loja.exemplo" + p + s; },
    avancar(ms) { relogio += ms; },
    disparar(evento) { win.traffikPixel.track(evento); },
    ids: () => posts.map((p) => p.eventId),
  };
}

console.log("\n1) PageView — a causa 1 medida em produção (4 ms, query diferente)");
{
  const p = carregar({ pathname: "/checkout", search: "?qty=1" });
  eq("o carregamento já disparou 1 PageView", p.posts.length, 1);
  const primeiro = p.ids()[0];

  p.avancar(4);
  p.irPara("/checkout", "?product=snow-foam-sgt-9939&qty=1");
  p.disparar("PageView");

  eq("2 POSTs", p.posts.length, 2);
  eq("🔴 MESMO id apesar da querystring ter mudado", p.ids()[1], primeiro);
}

console.log("\n2) PageView — a causa 3 (921 ms, cruzando a fronteira do balde de 10s)");
{
  // 1_699_999_999_591 e +921ms caem em baldes de 10s DIFERENTES.
  const p = carregar({ agora: 1_699_999_999_591 });
  const primeiro = p.ids()[0];
  p.avancar(921);
  p.disparar("PageView");
  eq("🔴 MESMO id apesar de cruzar a fronteira do balde", p.ids()[1], primeiro);
}

console.log("\n3) PageView — carregamentos DIFERENTES continuam sendo eventos diferentes");
{
  // É o caso legítimo que o script NÃO pode deduplicar: recarregar a página.
  const a = carregar({ pathname: "/checkout" });
  const b = carregar({ pathname: "/checkout" });
  diferente("recarregar gera id novo (âncora por carregamento)", a.ids()[0], b.ids()[0]);
}

console.log("\n4) PageView — rotas de SPA continuam distintas");
{
  const p = carregar({ pathname: "/" });
  const primeiro = p.ids()[0];
  p.irPara("/obrigado");
  p.disparar("PageView");
  diferente("pathname diferente = evento diferente", p.ids()[1], primeiro);
}

console.log("\n5) Evento de AÇÃO — dois disparos quase simultâneos são UM");
{
  const p = carregar();
  p.disparar("Lead");
  p.avancar(120); // duplo POST de framework: instantâneo
  p.disparar("Lead");
  const leads = p.posts.filter((x) => x.event === "Lead").map((x) => x.eventId);
  eq("2 POSTs de Lead", leads.length, 2);
  eq("mesmo id — o servidor deduplica", leads[1], leads[0]);
}

console.log("\n6) Evento de AÇÃO — dois cliques REAIS são DUAS intenções");
{
  const p = carregar();
  p.disparar("Lead");
  p.avancar(3000); // pessoa clicou de novo, 3s depois
  p.disparar("Lead");
  const leads = p.posts.filter((x) => x.event === "Lead").map((x) => x.eventId);
  diferente("id novo — a 2ª intenção não é apagada", leads[1], leads[0]);
}

console.log("\n7) Evento de AÇÃO — a janela é DESLIZANTE, não um balde fixo");
{
  // Mesmo cenário do item 2 (cruzando a fronteira dos 10s), agora num evento
  // de ação: o balde antigo os separaria; a janela deslizante não.
  const p = carregar({ agora: 1_699_999_999_591 });
  p.disparar("Lead");
  p.avancar(400);
  p.disparar("Lead");
  const leads = p.posts.filter((x) => x.event === "Lead").map((x) => x.eventId);
  eq("mesmo id atravessando a fronteira dos 10s", leads[1], leads[0]);
}

console.log("\n8) Eventos de nomes diferentes nunca colidem");
{
  const p = carregar();
  p.disparar("Lead");
  p.disparar("InitiateCheckout");
  const ids = p.posts.map((x) => x.eventId);
  eq("todos distintos", new Set(ids).size, ids.length);
}

console.log(
  falhas.length
    ? `\n\x1b[1m\x1b[31m${ok} asserções passaram, ${falhas.length} falharam:\x1b[0m\n  - ${falhas.join("\n  - ")}\n`
    : `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
