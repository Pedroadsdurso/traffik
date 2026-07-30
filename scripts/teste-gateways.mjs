/**
 * # Teste de regressão da CAMADA DE GATEWAYS
 *
 * ## O que ele prova
 *
 * Que mover `parseKirvano`/`normalizeSale` para dentro de
 * `lib/gateways/parsers/` **não mudou nada**. A etapa 1 da arquitetura universal
 * é um refactor, e num refactor qualquer divergência é bug, não melhoria.
 *
 * ## Por que contra um snapshot de payloads REAIS
 *
 * `scripts/fixtures/parsers-esperado.json` foi gerado pelo código ANTIGO, em
 * 30/07/2026, a partir do backup de produção: 167 casos vindos de 115 linhas de
 * `WebhookLog` e 26 `Sale.rawPayload`. Payload sintético provaria que o parser
 * concorda comigo; payload real prova que ele concorda com o gateway.
 *
 * O snapshot é a única testemunha que sobra depois que a implementação antiga é
 * apagada — por isso ele é commitado.
 *
 * ⚠️ **Nunca regenere o snapshot para "fazer o teste passar".** Ele existe
 * exatamente para recusar isso. Regenerar só quando a mudança de comportamento
 * for DELIBERADA, e aí o diff do arquivo tem de ser lido linha a linha.
 *
 * Uso: npm run test:gateways
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { fbclidDoFbc } from "../src/lib/gateways/campos.ts";
import { REGISTRO } from "../src/lib/gateways/registro.ts";

let ok = 0;
const falhas = [];

function checar(nome, fn) {
  try {
    fn();
    ok++;
  } catch (e) {
    falhas.push({ nome, erro: e.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Paridade com o comportamento congelado
// ─────────────────────────────────────────────────────────────────────────────

const fixture = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", "parsers-esperado.json"), "utf8"),
);

/**
 * Projeta a `VendaNormalizada` de hoje nos campos que o formato ANTIGO tinha.
 *
 * ⚠️ A comparação é só sobre esses campos, de propósito: os que entraram agora
 * (`pedidoId`, `fbp`, `taxaGateway`, `comissoes`, `utm`) não existiam no
 * snapshot, e exigir que fossem iguais tornaria impossível acrescentar campo
 * nenhum. O que não pode mudar é o que já era lido.
 */
function comoFormatoAntigo(v) {
  return {
    externalId: v.externalId,
    value: v.valor,
    currency: v.moeda,
    product: v.produto,
    productId: v.produtoId,
    status: v.status,
    paymentMethod: v.formaDePagamento,
    buyerEmail: v.email,
    buyerName: v.nome,
    buyerPhone: v.telefone,
    country: v.pais,
    clickId: v.clickId,
    ip: v.ipDoComprador,
  };
}

const PARSER = {
  kirvano: REGISTRO.KIRVANO.parse,
  generico: REGISTRO.CUSTOM.parse,
};

const divergencias = [];
for (const caso of fixture) {
  const r = PARSER[caso.parser](caso.payload);
  if (r.vendas.length !== 1) {
    divergencias.push(`${caso.origem}: ${r.vendas.length} vendas (esperado 1)`);
    continue;
  }
  const atual = comoFormatoAntigo(r.vendas[0]);
  for (const campo of Object.keys(caso.saida)) {
    const antes = caso.saida[campo] ?? null;
    const agora = atual[campo] ?? null;
    if (antes !== agora) {
      divergencias.push(`${caso.origem}.${campo}: era ${JSON.stringify(antes)}, virou ${JSON.stringify(agora)}`);
    }
  }
}

checar(`paridade em ${fixture.length} payloads reais`, () => {
  assert.deepEqual(divergencias, [], `\n  ${divergencias.slice(0, 12).join("\n  ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Invariantes do contrato — valem para TODO gateway, inclusive os futuros
// ─────────────────────────────────────────────────────────────────────────────

for (const def of Object.values(REGISTRO)) {
  checar(`${def.id}: id bate com a chave do registro`, () => {
    assert.equal(REGISTRO[def.id].id, def.id);
  });

  checar(`${def.id}: parse devolve sempre uma LISTA`, () => {
    // A REGRA 3 do contrato. Um parser que devolvesse objeto quebraria o
    // receptor no dia do primeiro order bump — e quebraria em silêncio.
    for (const entrada of [null, undefined, 42, "texto", [], {}, { event: "?" }]) {
      const r = def.parse(entrada);
      assert.ok(Array.isArray(r.vendas), `parse(${JSON.stringify(entrada)}) não devolveu lista`);
    }
  });

  checar(`${def.id}: payload inválido não lança e não inventa venda`, () => {
    // Payload malformado chega de verdade: nos logs reais há `{"ping":"diag2"}`
    // e corpos que nem são objeto. Lançar aqui viraria 500 sem diagnóstico.
    for (const entrada of [null, "texto", 42, []]) {
      assert.equal(def.parse(entrada).vendas.length, 0);
    }
  });

  checar(`${def.id}: ausência é null, nunca zero`, () => {
    // A REGRA 1. `taxaGateway: 0` afirmaria que o gateway não cobrou nada, e o
    // faturamento líquido apareceria maior que a realidade — plausível e falso.
    const r = def.parse({ event: "x" });
    if (r.vendas.length === 0) return;
    const v = r.vendas[0];
    assert.equal(v.taxaGateway, null, "taxaGateway deveria ser null num payload vazio");
    assert.equal(v.comissoes, null, "comissoes deveria ser null num payload vazio");
    assert.equal(v.valorBruto, null);
  });

  checar(`${def.id}: URL do webhook é absoluta e carrega o token`, () => {
    const url = def.urlDoWebhook("TOKEN123", "https://exemplo.com");
    assert.ok(url.startsWith("https://exemplo.com/"), url);
    assert.ok(url.includes("TOKEN123"), url);
  });

  checar(`${def.id}: gateway ativo declara como o usuário o instala`, () => {
    // Gateway ativo sem passo de instalação é uma tela vazia para quem está
    // tentando conectar o checkout dele.
    if (!def.ativo) return;
    assert.ok(def.instalacao.length > 0, "sem passos de instalação");
    assert.ok(def.campos.length > 0, "sem campos de cadastro");
  });

  checar(`${def.id}: estratégia de autenticação sabe onde procurar`, () => {
    if (def.auth.tipo !== "segredo") return;
    assert.ok(def.auth.onde.length > 0, "auth por segredo sem nenhuma fonte declarada");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. O que o snapshot NÃO cobre: os campos novos, lidos de payload real
// ─────────────────────────────────────────────────────────────────────────────

const kirvanoReal = fixture.find(
  (c) => c.parser === "kirvano" && c.payload?.event === "PIX_GENERATED" && c.payload?.fiscal,
);

checar("Kirvano: campos novos saem de payload REAL, não de suposição", () => {
  assert.ok(kirvanoReal, "nenhum PIX_GENERATED com bloco fiscal no snapshot");
  const v = REGISTRO.KIRVANO.parse(kirvanoReal.payload).vendas[0];

  // `fee` e `fiscal` estavam no payload e eram descartados pelo parser antigo.
  assert.equal(typeof v.taxaGateway, "number", "taxaGateway não foi lida");
  assert.equal(v.taxaGateway, kirvanoReal.payload.fee);
  assert.ok(Array.isArray(v.comissoes), "comissoes não foi lida");

  // `cookies.fbp` idem.
  assert.equal(v.fbp, kirvanoReal.payload.cookies?.fbp ?? null);

  // A Kirvano não separa order bump em linhas: cada venda é o próprio pedido.
  assert.equal(v.pedidoId, v.externalId);
  assert.equal(v.itemTipo, "principal");
});

checar("fbclid é extraído do _fbc mesmo contendo pontos", () => {
  // `split(".")[3]` truncaria o fbclid, que pode ter pontos — e o match ficaria
  // procurando um clique que existe, com a chave errada.
  assert.equal(fbclidDoFbc("fb.1.1782430196829.AQY.AAQ.IB"), "AQY.AAQ.IB");
  assert.equal(fbclidDoFbc("fb.1.123.abc"), "abc");
  assert.equal(fbclidDoFbc(null), null);
  assert.equal(fbclidDoFbc("lixo"), null);
});

// ─────────────────────────────────────────────────────────────────────────────

const total = ok + falhas.length;
if (falhas.length) {
  console.error(`\n\x1b[31m✗ ${falhas.length} de ${total} falharam\x1b[0m\n`);
  for (const f of falhas) console.error(`  \x1b[31m✗\x1b[0m ${f.nome}\n    ${f.erro}\n`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓ ${total} asserções, 0 falhas\x1b[0m`);
console.log(`  ${fixture.length} payloads reais de produção, comportamento idêntico ao anterior.\n`);
