/**
 * `gerouCheckout` deriva do STATUS quando o evento e desconhecido.
 *
 * ## O que este teste protege
 *
 * Cada parser tinha um `Set` fechado de eventos que significam "chegou ao
 * pagamento", e um evento fora dele devolvia `false` **sem fallback** — enquanto
 * o STATUS ja tinha ganho o seu (`statusPeloTexto`, depois do `PIX_EXPIRED` da
 * Kirvano).
 *
 * A assimetria e o que faz o bug passar despercebido: a venda aparece com o
 * status CERTO e o `InitiateCheckout` **nao e criado**. O funil perde uma etapa
 * inteira, sem erro em lugar nenhum. Observado em producao com a OnyxPag em
 * 05/08/2026.
 *
 * ⚠️ O caso ERRADO e o caso CERTO produzem resultados diferentes aqui — o
 * evento conhecido continua obedecendo a lista, e so o desconhecido cai no
 * status. Sem esse par, o teste nao provaria que o fallback e seletivo.
 */
import { chegouAoCheckout } from "@/lib/gateways/campos";
import { parseOnyxPag } from "@/lib/gateways/parsers/onyxpag";

let ok = 0, mau = 0;
const eq = (n, a, b) => {
  const bom = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${bom ? "\x1b[32m ok \x1b[0m" : "\x1b[31m FALHOU \x1b[0m"} ${n}`);
  if (!bom) console.log(`      obtido ${JSON.stringify(a)} | esperado ${JSON.stringify(b)}`);
  if (bom) ok++; else mau++;
};

console.log("\nO fallback e SELETIVO\n");

const LISTA = new Set(["transaction.created"]);

eq("evento conhecido E na lista: gera", chegouAoCheckout("transaction.created", true, LISTA, "PENDENTE"), true);
// 🔴 O par que importa: conhecido e FORA da lista continua fora, mesmo com
// status pendente. Sem isto o fallback reverteria decisao tomada de proposito.
eq("evento conhecido FORA da lista: NAO gera, mesmo pendente", chegouAoCheckout("transaction.x", true, LISTA, "PENDENTE"), false);
eq("evento DESCONHECIDO com status pendente: gera", chegouAoCheckout("transaction.pending", false, LISTA, "PENDENTE"), true);
eq("evento DESCONHECIDO abandonado: gera (chegou e desistiu)", chegouAoCheckout("cart.x", false, LISTA, "ABANDONADA"), true);
eq("evento DESCONHECIDO aprovado: NAO gera", chegouAoCheckout("x.paid", false, LISTA, "APROVADA"), false);
eq("evento DESCONHECIDO expirado: NAO gera", chegouAoCheckout("x.exp", false, LISTA, "EXPIRADA"), false);

console.log("\nPonta a ponta no parser da OnyxPag\n");

const novo = parseOnyxPag({
  event: "transaction.pending",
  data: { id: "T-NOVO", amount: "10.00", status: "pending", payment_method: "pix" },
});
eq("evento novo vira PENDENTE pelo texto", novo.vendas[0].status, "PENDENTE");
eq("e GERA o checkout (o funil nao perde a etapa)", novo.vendas[0].gerouCheckout, true);

const pago = parseOnyxPag({
  event: "transaction.paid",
  data: { id: "T-PG", amount: "10.00", status: "paid", payment_method: "pix" },
});
eq("evento conhecido e pago NAO gera checkout", pago.vendas[0].gerouCheckout, false);

const criado = parseOnyxPag({
  event: "transaction.created",
  data: { id: "T-CR", amount: "10.00", status: "pending", payment_method: "pix" },
});
eq("o caminho antigo continua funcionando", criado.vendas[0].gerouCheckout, true);

console.log(`\n${ok + mau} assercoes, ${mau} falha(s)\n`);
process.exitCode = mau ? 1 : 0;
