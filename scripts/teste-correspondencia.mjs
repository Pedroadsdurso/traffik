/**
 * Sinais de correspondência que a CAPI recebe: `_fbc`, `_fbp` e telefone.
 *
 * ## Por que existe
 *
 * Dois sinais estavam sendo perdidos em silêncio, na mesma categoria do
 * telefone sem DDI que já foi corrigido:
 *
 * | Sinal | O que acontecia |
 * |---|---|
 * | `_fbp` | **nunca era enviado** — o campo não existia no `user_data`, e a Kirvano manda em 45 de 46 eventos |
 * | `_fbc` | **fabricado com `Date.now()`** — o timestamp era o do PROCESSAMENTO da venda, não o do clique no anúncio |
 *
 * Nenhum dos dois faz a chamada falhar. Eles degradam a correspondência, que é
 * o que alimenta a otimização das campanhas — dinheiro real, sem erro e sem log.
 *
 * ## Como ele prova
 *
 * Intercepta o `fetch` e lê o `user_data` que SERIA enviado à Meta. Nenhuma
 * requisição sai da máquina e nenhum banco é tocado.
 *
 * Uso: npm run test:correspondencia
 */
import assert from "node:assert/strict";

import { sendPurchaseEvent } from "@/lib/facebook/capi";
import { fbclidDoFbc } from "@/lib/gateways/campos";

let ok = 0;
const falhas = [];
async function checar(nome, fn) {
  try {
    await fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

/** Dispara um Purchase e devolve o `user_data` que iria para a Meta. */
async function userDataDe(extra) {
  let capturado = null;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturado = JSON.parse(init.body);
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  };
  try {
    await sendPurchaseEvent({
      pixelId: "1", accessToken: "t", value: 100, currency: "BRL", eventId: "evt-1",
      ...extra,
    });
  } finally {
    globalThis.fetch = original;
  }
  return capturado?.data?.[0]?.user_data ?? {};
}

const CLIQUE_EM = 1_780_000_000; // epoch do clique no anúncio
const AGORA = Math.floor(Date.now() / 1000);

console.log("\n\x1b[1mSinais de correspondência da CAPI\x1b[0m\n");

await checar("o `_fbp` chega à Meta (antes, nem existia no user_data)", async () => {
  const ud = await userDataDe({ fbp: "fb.1.1782430196829.195374873210583538" });
  assert.equal(ud.fbp, "fb.1.1782430196829.195374873210583538");
});

await checar("o `_fbc` REAL do gateway vence a reconstrução", async () => {
  const real = "fb.1.1780000000.AbCd_fbclid";
  const ud = await userDataDe({ fbc: real, fbclid: "outro" });
  assert.equal(ud.fbc, real, "reconstruiu por cima do cookie real");
});

await checar("sem cookie real, reconstrói com o instante do CLIQUE", async () => {
  const ud = await userDataDe({ fbclid: "AbCd", fbclidEm: CLIQUE_EM });
  assert.equal(ud.fbc, `fb.1.${CLIQUE_EM}.AbCd`);
  // ⚠️ O bug: com `Date.now()` o terceiro segmento era o instante em que a VENDA
  // foi processada. Num Pix pago 2 dias depois, a string não batia com a do
  // navegador do comprador.
  assert.notEqual(ud.fbc, `fb.1.${AGORA}.AbCd`);
});

await checar("sem instante do clique, ainda envia (não deixa de mandar o sinal)", async () => {
  const ud = await userDataDe({ fbclid: "AbCd" });
  assert.ok(String(ud.fbc).startsWith("fb.1."), ud.fbc);
  assert.ok(String(ud.fbc).endsWith(".AbCd"));
});

await checar("sem fbclid e sem fbc, o campo simplesmente não vai", async () => {
  const ud = await userDataDe({});
  assert.equal(ud.fbc, undefined);
  assert.equal(ud.fbp, undefined);
});

await checar("e-mail e telefone continuam HASHEADOS; ip e user agent, em claro", async () => {
  // A Meta RECUSA `client_ip_address` e `client_user_agent` hasheados — são os
  // dois únicos campos em claro, e trocar isso degradaria tudo em silêncio.
  const ud = await userDataDe({
    email: "a@b.com", phone: "34999999999", country: "BR",
    clientIp: "179.1.2.3", clientUserAgent: "Mozilla/5.0",
  });
  assert.match(ud.em[0], /^[a-f0-9]{64}$/, "e-mail não hasheado");
  assert.match(ud.ph[0], /^[a-f0-9]{64}$/, "telefone não hasheado");
  assert.equal(ud.client_ip_address, "179.1.2.3");
  assert.equal(ud.client_user_agent, "Mozilla/5.0");
});

await checar("o telefone nacional ganha DDI antes do hash (E.164)", async () => {
  const { createHash } = await import("node:crypto");
  const sha = (v) => createHash("sha256").update(v).digest("hex");
  const ud = await userDataDe({ phone: "34999999999", country: "BR" });
  assert.equal(ud.ph[0], sha("5534999999999"), "hash não bate com o número em E.164");
});

console.log("\n\x1b[1mExtração do fbclid\x1b[0m\n");

await checar("o fbclid é extraído do `_fbc` mesmo contendo pontos", () => {
  // `split(".")[3]` truncaria — e o match procuraria um clique que existe, com
  // a chave errada.
  assert.equal(fbclidDoFbc("fb.1.1782430196829.AQY.AAQ.IB"), "AQY.AAQ.IB");
  assert.equal(fbclidDoFbc("fb.2.999.simples"), "simples");
  assert.equal(fbclidDoFbc("lixo"), null);
  assert.equal(fbclidDoFbc(null), null);
});

const total = ok + falhas.length;
if (falhas.length) {
  console.error(`\n\x1b[31m✗ ${falhas.length} de ${total} falharam\x1b[0m\n`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓ ${total} asserções, 0 falhas\x1b[0m\n`);
