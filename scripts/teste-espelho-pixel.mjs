/**
 * Exercita o espelho do script de pixel num DOM falso, sem navegador.
 *
 * O que ele prova, e que nenhum tsc/lint/build acusaria:
 *  1. o script gerado é JS válido (node --check equivalente, via new Function);
 *  2. com `fbq` presente, o espelho sai NA HORA e com o mesmo id do POST;
 *  3. com `fbq` AUSENTE (o bug real), o espelho é enfileirado e sai quando o
 *     fbq aparece — o cenário em que a versão antiga falhava calada;
 *  4. se o fbq nunca aparece, há console.warn E relato `sem-fbq` ao servidor;
 *  5. evento de outro dono não é espelhado.
 */
import { pixelScript } from "../src/lib/pixel/script.ts";

let ok = 0;
const falhas = [];
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome}\n        obtido:   ${a}\n        esperado: ${b}`); }
}

function montarAmbiente({ comFbq }) {
  const posts = [];
  const tr = [];
  const warns = [];
  const timers = new Map();
  let seq = 0;
  let agora = 1_000_000_000_000;

  const win = {
    location: { href: "https://loja.exemplo/pagina", search: "?fbclid=ABC123" },
    console: { warn: (m) => warns.push(String(m)) },
  };
  if (comFbq) win.fbq = (...a) => tr.push(a);

  const ambiente = {
    window: win,
    document: { cookie: "", addEventListener() {} },
    location: win.location,
    URLSearchParams,
    JSON,
    Date: { now: () => agora },
    fetch: (url, init) => { posts.push(JSON.parse(init.body)); return Promise.resolve(); },
    setInterval: (fn) => { const id = ++seq; timers.set(id, fn); return id; },
    clearInterval: (id) => timers.delete(id),
    decodeURIComponent,
  };

  return {
    ambiente, posts, tr, warns, win,
    /** Roda um tique de todos os intervalos ativos, avançando o relógio. */
    tique(ms = 200) { agora += ms; for (const fn of [...timers.values()]) fn(); },
    ativos: () => timers.size,
  };
}

function rodar(cfg, env) {
  const codigo = pixelScript(cfg);
  const nomes = Object.keys(env.ambiente);
  // `new Function` valida a sintaxe do script gerado — se a template string
  // tiver quebrado, isto lança aqui em vez de quebrar a página do cliente.
  const f = new Function(...nomes, codigo);
  f(...nomes.map((n) => env.ambiente[n]));
  return codigo;
}

const base = {
  configId: "cfg_1",
  apiBase: "https://app.traffik.io",
  lead: true,
  addToCart: false,
  initiateCheckout: { enabled: false },
  // Explícito: quem NÃO tem pixel nativo na página escolhe Traffik e volta ao
  // envio server-side. É o caso em que o espelho do PageView é exercido.
  eventOwners: { PageView: "traffik" },
};

console.log("\n1) fbq PRESENTE — espelho imediato");
{
  const env = montarAmbiente({ comFbq: true });
  rodar(base, env);
  eq("1 POST enviado", env.posts.length, 1);
  eq("1 requisicao de navegador (espelho)", env.tr.length, 1);
  eq("estado reportado", env.posts[0].espelho, "ok");
  eq("evento espelhado", env.tr[0][1], "PageView");
  eq("eid do espelho == eventId do POST", env.tr[0][3].eventID, env.posts[0].eventId);
  eq("nenhum poller pendurado", env.ativos(), 0);
}

console.log("\n2) fbq AUSENTE no disparo — o bug real, agora enfileirado");
{
  const env = montarAmbiente({ comFbq: false });
  rodar(base, env);
  eq("POST saiu mesmo assim", env.posts.length, 1);
  eq("estado reportado", env.posts[0].espelho, "adiado");
  eq("nada foi para o navegador ainda", env.tr.length, 0);
  const idOriginal = env.posts[0].eventId;

  // o codigo da Meta so agora define o fbq (snippet colado depois do nosso)
  env.win.fbq = (...a) => env.tr.push(a);
  env.tique();

  eq("espelho saiu depois", env.tr.length, 1);
  eq("id preservado (nao recalculado)", env.tr[0][3].eventID, idOriginal);
  eq("relato tardio enviado", env.posts.length, 2);
  eq("relato diz adiado-ok", env.posts[1].espelho, "adiado-ok");
  eq("relato e somenteEspelho", env.posts[1].somenteEspelho, true);
  eq("poller encerrado", env.ativos(), 0);
}

console.log("\n3) fbq NUNCA aparece — nao falha em silencio");
{
  const env = montarAmbiente({ comFbq: false });
  rodar(base, env);
  for (let i = 0; i < 60; i++) env.tique(200); // 12s > teto de 10s
  eq("nenhuma requisicao de navegador", env.tr.length, 0);
  eq("console.warn emitido", env.warns.length, 1);
  eq("warn cita o fbq", env.warns[0].includes("fbq"), true);
  eq("warn diz o que fazer", env.warns[0].includes("DEPOIS"), true);
  eq("relato de falha enviado", env.posts.length, 2);
  eq("relato diz sem-fbq", env.posts[1].espelho, "sem-fbq");
  eq("poller encerrado", env.ativos(), 0);
}

console.log("\n4) evento de outro dono — nao espelha, mas registra");
{
  const env = montarAmbiente({ comFbq: true });
  rodar({ ...base, eventOwners: { PageView: "navegador" } }, env);
  eq("POST saiu", env.posts.length, 1);
  eq("nada foi para o navegador", env.tr.length, 0);
  eq("estado reportado", env.posts[0].espelho, "alheio");
  eq("nenhum poller pendurado", env.ativos(), 0);
}

console.log("\n5) PADRAO NOVO — sem eventOwners, PageView e do pixel nativo");
{
  const env = montarAmbiente({ comFbq: true });
  const codigo = rodar({ ...base, eventOwners: undefined }, env);
  eq("PageView entra na lista de alheios", codigo.includes('var ALHEIOS = ["PageView"]'), true);
  eq("registrado no nosso banco assim mesmo", env.posts.length, 1);
  eq("nenhum segundo PageView no navegador", env.tr.length, 0);
  eq("estado reportado", env.posts[0].espelho, "alheio");
}

console.log(`\n${ok} assercoes, ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log("  - " + f)); process.exit(1); }
