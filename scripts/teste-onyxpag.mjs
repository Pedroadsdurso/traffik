/**
 * Passo 5 do roteiro de gateway novo: **rodar os payloads no testador**.
 *
 * O testador tem três estados por campo, e o terceiro é a razão de ele existir:
 *
 *   lido        — o parser extraiu o valor
 *   ausente     — o gateway não mandou nada parecido
 *   🔴 nao_mapeado — o dado VEIO, com outro nome, e o parser o DESCARTOU
 *
 * Campo vazio parece igual nos dois últimos casos. Sem o âmbar, um gateway que
 * manda o IP como `buyer_ip_address` passaria como "não envia IP", e a
 * geolocalização de todas as vendas dele viraria estimativa sem ninguém saber
 * por quê.
 *
 * **Âmbar sobrando = parser incompleto.** Este teste falha se sobrar.
 *
 * ⚠️ Ele roda sobre os exemplos da DOCUMENTAÇÃO. Passar aqui não substitui
 * rodar um payload REAL na aba Testes — a doc pode estar incompleta, e no caso
 * da OnyxPag há suspeita concreta disso (o `tracking` da criação não aparece no
 * webhook documentado).
 *
 * Puro: sem banco, sem rede.
 */
import { analisarPayload } from "@/lib/gateways/testador";
import { REGISTRO } from "@/lib/gateways/registro";
import { EXEMPLOS_ONYXPAG } from "@/lib/gateways/exemplos/onyxpag";
import { parseOnyxPag } from "@/lib/gateways/parsers/onyxpag";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

console.log("\n\x1b[1mO gateway está no REGISTRO\x1b[0m");
{
  const g = REGISTRO.ONYXPAG;
  eq("existe e está ativo", !!g && g.ativo, true);
  eq("usa o receptor UNIVERSAL, sem rota própria", g.urlDoWebhook("TOKEN", "https://x"), "https://x/api/webhook/sale/TOKEN");
  eq("tem exemplos para o testador", g.exemplos.length > 0, true);
  eq("tem passos de instalação", g.instalacao.length > 0, true);
  // 🔴 A única do projeto, junto de CUSTOM, que não exige segredo — precisa ser
  // escolha declarada, não descuido.
  eq("auth não exige segredo (a OnyxPag não manda nenhum)", g.auth.exigir, false);
  eq("  …mas confere se um for configurado", g.auth.onde.length > 0, true);
}

console.log("\n\x1b[1m🐛 A chave é obrigatória? O BOTÃO tem de ler isto\x1b[0m");
{
  // O "Adicionar" da gaveta checava `!gatewaySecret.trim()` incondicionalmente,
  // escrito quando Kirvano e Cakto eram os únicos gateways e os dois exigiam
  // chave. O campo dizia "(opcional)" e o botão travava do mesmo jeito.
  // Agora ele deriva DAQUI — a mesma fonte de onde sai o rótulo "(opcional)".
  const exige = (id) => REGISTRO[id].campos.some((c) => c.chave === "secret" && c.obrigatorio);
  eq("KIRVANO exige chave", exige("KIRVANO"), true);
  eq("CAKTO exige chave", exige("CAKTO"), true);
  eq("🐛 ONYXPAG NÃO exige", exige("ONYXPAG"), false);
  // Este estava quebrado desde sempre, e ninguém tinha esbarrado.
  eq("🐛 CUSTOM NÃO exige (bug antigo, mesmo caminho)", exige("CUSTOM"), false);
  // O rótulo e a trava saem do mesmo campo: não há como divergirem.
  const campo = (id) => REGISTRO[id].campos.find((c) => c.chave === "secret");
  eq("todo gateway declara o campo secret", ["KIRVANO", "CAKTO", "ONYXPAG", "CUSTOM"].every((id) => !!campo(id)), true);
}

console.log("\n\x1b[1m🔴 NENHUM campo em ÂMBAR nos exemplos\x1b[0m");
for (const [i, ex] of EXEMPLOS_ONYXPAG.entries()) {
  const d = analisarPayload("ONYXPAG", ex.payload);
  const ambar = d.vendas.flatMap((v) =>
    v.campos.filter((c) => c.estado === "nao_mapeado").map((c) => `${c.campo}←${c.chaveNoPayload}`),
  );
  eq(`[${i}] ${ex.nome}`, ambar, []);
}

console.log("\n\x1b[1mLeitura do payload literal da documentação\x1b[0m");
{
  const d = analisarPayload("ONYXPAG", EXEMPLOS_ONYXPAG[0].payload);
  const v = d.vendas[0];
  const campo = (c) => v.campos.find((x) => x.campo === c);
  eq("o parser aceitou", d.ok, true);
  eq("1 item", d.itens, 1);
  eq("1 pedido (1 conversão)", d.pedidos, 1);
  eq("sem avisos", d.avisos, []);
  eq("status APROVADA", v.status, "APROVADA");
  // ⚠️ "25.90" com PONTO decimal. Um parser de vírgula caseiro leria 2590.
  eq("valor 25.9 (não 2590)", campo("valor").valor, "25.9");
  eq("taxa do gateway 1.3", campo("taxaGateway").valor, "1.3");
  eq("produto veio de items[0].title", campo("produto").valor, "Nome do produto");
  eq("e-mail", campo("email").valor, "joao.silva@email.com");
  eq("telefone nacional, como veio", campo("telefone").valor, "11999999999");
  eq("forma de pagamento PIX", campo("formaDePagamento").valor, "PIX");
}

console.log("\n\x1b[1mOs 5 eventos → status\x1b[0m");
{
  const status = (evento, extra = {}) =>
    analisarPayload("ONYXPAG", {
      event: evento,
      data: { transaction_id: "T1", amount: "10.00", payment_method: "pix", ...extra },
    }).vendas[0].status;
  eq("transaction.paid → APROVADA", status("transaction.paid"), "APROVADA");
  eq("transaction.created → PENDENTE", status("transaction.created"), "PENDENTE");
  eq("transaction.failed → CANCELADA", status("transaction.failed"), "CANCELADA");
  // 🔴 EXPIRADA e não CANCELADA: terminal impediria o `paid` de um PIX gerado
  // de novo de sobrescrever, e a venda paga sumiria do faturamento.
  eq("transaction.expired → EXPIRADA (não CANCELADA)", status("transaction.expired"), "EXPIRADA");
  eq("transaction.refunded → REEMBOLSADA", status("transaction.refunded"), "REEMBOLSADA");
}

console.log("\n\x1b[1mFunil: só a cobrança criada é checkout\x1b[0m");
{
  // `gerouCheckout` não é campo do diagnóstico (o testador lista o que veio do
  // payload; este é uma decisão do parser). Vai direto na saída do parse.
  const gerou = (evento) =>
    parseOnyxPag({ event: evento, data: { transaction_id: "T1", amount: "10.00" } }).vendas[0].gerouCheckout;
  eq("transaction.created gera InitiateCheckout", gerou("transaction.created"), true);
  eq("transaction.paid NÃO gera", gerou("transaction.paid"), false);
  eq("transaction.expired NÃO gera", gerou("transaction.expired"), false);
}

console.log("\n\x1b[1m⛔ Evento desconhecido NUNCA passa em silêncio\x1b[0m");
{
  const d = analisarPayload("ONYXPAG", EXEMPLOS_ONYXPAG[4].payload);
  eq("gera aviso", d.avisos.length, 1);
  eq("  …nomeando o evento", d.avisos[0].includes("transaction.chargeback_opened"), true);
  // Fallback pelo texto: "contestada" → CHARGEBACK.
  eq("  …e cai no status pelo texto", d.vendas[0].status, "CHARGEBACK");
}

console.log("\n\x1b[1mBordas\x1b[0m");
{
  eq("payload que não é objeto", analisarPayload("ONYXPAG", "oi").ok, false);
  eq("sem `data`", analisarPayload("ONYXPAG", { event: "transaction.paid" }).ok, false);
  const lista = analisarPayload("ONYXPAG", {
    event: "transaction.paid",
    data: [
      { transaction_id: "A", amount: "10.00" },
      { transaction_id: "B", amount: "20.00" },
    ],
  });
  eq("`data` como LISTA também funciona", lista.itens, 2);
  eq("  …e vira 2 pedidos distintos", lista.pedidos, 2);
}

console.log("\n\x1b[1mCapacidades declaradas × observadas\x1b[0m");
{
  const d = analisarPayload("ONYXPAG", EXEMPLOS_ONYXPAG[0].payload);
  const div = d.capacidades.filter((c) => c.divergente).map((c) => c.nome);
  // "veio e não estava previsto" é erro do REGISTRO — a capacidade declarada
  // está mentindo para o usuário na tela.
  eq("nenhuma capacidade divergente", div, []);
}


console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
