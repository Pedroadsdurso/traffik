/**
 * Parser da Cakto e o testador de payload.
 *
 * Cobre, um a um, os riscos levantados antes de escrever o parser — cada
 * asserção existe por causa de um deles, e não por completude.
 *
 * Puro: nenhum banco, nenhuma rede.
 *
 * Uso: npm run test:cakto
 */
import assert from "node:assert/strict";

import { REGISTRO } from "@/lib/gateways/registro";
import { analisarPayload } from "@/lib/gateways/testador";
import { EXEMPLOS_CAKTO } from "@/lib/gateways/exemplos/cakto";

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

const cakto = REGISTRO.CAKTO;
const individual = EXEMPLOS_CAKTO[0].payload;
const agrupado = EXEMPLOS_CAKTO[1].payload;
const um = (p) => cakto.parse(p).vendas;

console.log("\n\x1b[1mRisco: `data` pode ser OBJETO ou ARRAY\x1b[0m\n");

checar("disparo individual (objeto) → 1 venda", () => {
  assert.equal(um(individual).length, 1);
});

checar("disparo agrupado (array) → 2 vendas", () => {
  // ⚠️ Um parser que assumisse objeto processaria 1 item ou nenhum — e o
  // gateway receberia 200, sem nada denunciar.
  assert.equal(um(agrupado).length, 2);
});

checar("`data` ausente não vira venda fantasma, e diz o motivo", () => {
  const r = cakto.parse({ event: "purchase_approved" });
  assert.equal(r.vendas.length, 0);
  assert.match(r.ignorado ?? "", /sem itens/i);
});

console.log("\n\x1b[1mRisco: order bump inflando a contagem\x1b[0m\n");

checar("2 itens do mesmo checkout = 1 PEDIDO", () => {
  const vendas = um(agrupado);
  assert.equal(new Set(vendas.map((v) => v.pedidoId)).size, 1, "os itens não ficaram no mesmo pedido");
  assert.equal(vendas[0].pedidoId, "cakto:12345");
});

checar("faturamento soma as LINHAS: 90 + 27 = 117", () => {
  assert.equal(um(agrupado).reduce((a, v) => a + v.valor, 0), 117);
});

checar("o tipo de cada item vem de `offer_type`", () => {
  const [principal, bump] = um(agrupado);
  assert.equal(principal.itemTipo, "principal");
  assert.equal(bump.itemTipo, "orderbump");
  assert.equal(bump.itemPaiExternalId, "9vbgfmg");
});

checar("cada item mantém o PRÓPRIO produto (não some do ranking)", () => {
  const [a, b] = um(agrupado);
  assert.equal(a.produto, "Produto Teste");
  assert.equal(b.produto, "E-book Bônus");
});

console.log("\n\x1b[1mRisco: não manda IP do comprador\x1b[0m\n");

checar("o registro DECLARA que não manda IP", () => {
  assert.equal(cakto.capacidades.ipDoComprador, false);
});

checar("nenhuma venda traz IP — a geografia vai depender do clique", () => {
  assert.equal(um(individual)[0].ipDoComprador, null);
});

checar("a instalação AVISA que a localização é estimada", () => {
  // O aviso é preventivo por causa da capacidade declarada — o usuário lê antes
  // de instalar, não depois de olhar um mapa errado.
  const avisa = cakto.instalacao.some((p) => /estimad|localiza/i.test(p.titulo + p.texto));
  assert.ok(avisa, "nenhum passo da instalação menciona a localização estimada");
});

console.log("\n\x1b[1mCompensação: fbc, fbp e UTMs\x1b[0m\n");

checar("fbc, fbp e UTMs são lidos quando vêm preenchidos", () => {
  const item = { ...individual.data, fbc: "fb.1.1780000000.AbC", fbp: "fb.1.999.123", utm_source: "ig", sck: "x1" };
  const v = um({ ...individual, data: item })[0];
  assert.equal(v.fbc, "fb.1.1780000000.AbC");
  assert.equal(v.fbp, "fb.1.999.123");
  assert.equal(v.utm.source, "ig");
  assert.equal(v.utm.sck, "x1");
});

console.log("\n\x1b[1mRisco: commissions[] de estrutura desconhecida\x1b[0m\n");

checar("só `producer` → coproducao NULL, nunca zero", () => {
  // ⛔ `0` afirmaria "não há coprodução" e o líquido apareceria MAIOR que a
  // realidade. `null` diz "não sabemos" e cai na taxa cadastrada.
  assert.equal(um(individual)[0].comissoes, null);
});

checar("um tipo diferente entra na lista E vira aviso", () => {
  const item = {
    ...individual.data,
    commissions: [
      { user: "p@x.com", totalAmount: 70, type: "producer", percentage: 70 },
      { user: "a@x.com", totalAmount: 20, type: "affiliate", percentage: 20 },
    ],
  };
  const r = cakto.parse({ ...individual, data: item });
  assert.equal(r.vendas[0].comissoes.length, 1, "o afiliado não entrou");
  assert.equal(r.vendas[0].comissoes[0].valor, 20);
});

checar("tipo NUNCA visto gera aviso para o usuário conferir", () => {
  const item = { ...individual.data, commissions: [{ user: "x", totalAmount: 5, type: "tipo_novo" }] };
  const r = cakto.parse({ ...individual, data: item });
  assert.ok((r.avisos ?? []).some((a) => /tipo_novo/.test(a)), "não avisou sobre o tipo desconhecido");
});

console.log("\n\x1b[1mRisco: os 14 eventos, e o que não está entre eles\x1b[0m\n");

const ESPERADO = {
  purchase_approved: "APROVADA",
  purchase_refused: "CANCELADA",
  refund: "REEMBOLSADA",
  chargeback: "CHARGEBACK",
  pix_gerado: "PENDENTE",
  boleto_gerado: "PENDENTE",
  picpay_gerado: "PENDENTE",
  openfinance_nubank_gerado: "PENDENTE",
  initiate_checkout: "ABANDONADA",
  checkout_abandonment: "ABANDONADA",
  subscription_canceled: "CANCELADA",
  subscription_renewed: "APROVADA",
  subscription_renewal_refused: "CANCELADA",
};

for (const [evento, esperado] of Object.entries(ESPERADO)) {
  checar(`${evento} → ${esperado}`, () => {
    // Sem datas de estorno, para o mapa de evento ser quem decide.
    const data = { ...individual.data, refundedAt: null, chargedbackAt: null, canceledAt: null };
    assert.equal(cakto.parse({ event: evento, data }).vendas[0].status, esperado);
  });
}

checar("subscription_created lê o campo `status` (a doc não define)", () => {
  const pago = cakto.parse({ event: "subscription_created", data: { ...individual.data, status: "paid" } });
  assert.equal(pago.vendas[0].status, "APROVADA");
  // E NÃO avisa: é evento documentado, só ambíguo. Avisar seria ruído.
  assert.equal((pago.avisos ?? []).length, 0);
});

checar("evento DESCONHECIDO nunca é ignorado em silêncio", () => {
  const r = cakto.parse({ event: "evento_que_nao_existe", data: { ...individual.data, status: "refunded" } });
  assert.equal(r.vendas[0].status, "REEMBOLSADA", "não usou o campo status como fallback");
  assert.ok((r.avisos ?? []).some((a) => /desconhecido/i.test(a)), "não avisou");
});

checar("data de estorno vence um evento que diz APROVADA", () => {
  // Reentrega do evento original já com o estorno marcado — a Cakto reentrega.
  const data = { ...individual.data, refundedAt: "2026-06-27T10:00:00Z" };
  assert.equal(cakto.parse({ event: "purchase_approved", data }).vendas[0].status, "REEMBOLSADA");
});

console.log("\n\x1b[1mTestador de payload\x1b[0m\n");

checar("reconhece a forma do `data` e conta itens × pedidos", () => {
  const d = analisarPayload("CAKTO", agrupado);
  assert.equal(d.forma, "lista");
  assert.equal(d.itens, 2);
  assert.equal(d.pedidos, 1, "não juntou os itens no mesmo pedido");
  assert.equal(analisarPayload("CAKTO", individual).forma, "objeto");
});

checar("distingue 'gateway não enviou' de 'parser não leu'", () => {
  const d = analisarPayload("CAKTO", individual);
  const campo = (n) => d.vendas[0].campos.find((c) => c.campo === n);
  // O IP realmente não existe no payload da Cakto.
  assert.equal(campo("ipDoComprador").estado, "ausente");
  // O valor foi lido.
  assert.equal(campo("valor").estado, "lido");
  assert.equal(campo("valor").valor, "90");
});

checar("🔴 denuncia campo que EXISTE no payload e o parser ignorou", () => {
  // É o achado que salva uma integração: o campo está lá, com outro nome, e
  // numa inspeção normal ninguém liga o vazio ao payload.
  const item = { ...individual.data, buyer_ip_address: "179.1.2.3" };
  const d = analisarPayload("CAKTO", { ...individual, data: item });
  const ip = d.vendas[0].campos.find((c) => c.campo === "ipDoComprador");
  assert.equal(ip.estado, "nao_mapeado", "não percebeu o IP com outro nome");
  assert.match(ip.chaveNoPayload ?? "", /buyer_ip_address/);
});

checar("compara capacidade DECLARADA × observada no payload", () => {
  const d = analisarPayload("CAKTO", individual);
  const fbc = d.capacidades.find((c) => /_fbc/.test(c.nome));
  // O registro declara que a Cakto manda `fbc`; este exemplo vem com null.
  assert.equal(fbc.declarada, true);
  assert.equal(fbc.observada, false);
  assert.equal(fbc.divergente, true, "a divergência não foi sinalizada");
});

checar("os avisos do parser chegam ao diagnóstico", () => {
  const d = analisarPayload("CAKTO", EXEMPLOS_CAKTO[3].payload);
  assert.ok(d.avisos.some((a) => /desconhecido/i.test(a)));
});

checar("gateway inexistente não quebra o testador", () => {
  const d = analisarPayload("NAO_EXISTE", individual);
  assert.equal(d.ok, false);
  assert.match(d.erro ?? "", /não existe/i);
});

checar("payload que não é objeto não quebra o testador", () => {
  for (const lixo of [null, 42, "texto", []]) {
    const d = analisarPayload("CAKTO", lixo);
    assert.equal(d.ok, false);
  }
});

const total = ok + falhas.length;
if (falhas.length) {
  console.error(`\n\x1b[31m✗ ${falhas.length} de ${total} falharam\x1b[0m\n`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓ ${total} asserções, 0 falhas\x1b[0m\n`);
