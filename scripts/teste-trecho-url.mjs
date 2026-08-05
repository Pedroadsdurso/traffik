/**
 * O trecho da URL do checkout próprio: aceitar o que dá para corrigir, recusar
 * o que casaria com tudo.
 *
 * ⛔ O caso `largo` é o que motiva o módulo: `/` e o próprio domínio produzem
 * exatamente o mesmo estrago que a string vazia — `location.href` sempre
 * contém o host —, e a trava antiga só via `!trim()`.
 */
import { analisarTrecho } from "@/lib/pixel/trechoUrl";

let ok = 0, falhas = 0;
const eq = (n, o, e) => {
  const a = JSON.stringify(o), b = JSON.stringify(e);
  if (a === b) { ok++; console.log(`  ✓ ${n}`); }
  else { falhas++; console.log(`  ✗ ${n}\n      obtido:   ${a}\n      esperado: ${b}`); }
};
const g = (v) => analisarTrecho(v).grau;
const val = (v) => analisarTrecho(v).valor;

console.log("\nCaminho simples");
eq("/checkout", g("/checkout"), "ok");
eq("/finalizar-compra", g("/finalizar-compra"), "ok");
eq("espaços em volta são aparados", val("  /checkout  "), "/checkout");

console.log("\nURL inteira — aceita e extrai");
eq("https://meusite.com/checkout", g("https://meusite.com/checkout"), "corrigido");
eq("  …guardando só o caminho", val("https://meusite.com/checkout"), "/checkout");
eq("querystring sai (muda por visitante)", val("https://m.com/pay?produto=x"), "/pay");
eq("barra final sai", val("https://m.com/checkout/"), "/checkout");

console.log("\nLargo demais — casaria com TODAS as páginas");
eq("barra sozinha", g("/"), "largo");
eq("dominio nu", g("meusite.com"), "largo");
eq("dominio com www", g("www.meusite.com"), "largo");
eq("dominio com esquema e sem caminho", g("https://meusite.com"), "largo");
eq("asterisco", g("*"), "largo");

console.log("\nVazio");
eq("string vazia", g(""), "vazio");
eq("só espaços", g("   "), "vazio");

console.log("\nO que NÃO pode virar 'largo' (contraste)");
// Se a regra de domínio fosse frouxa, estes seriam recusados — e são válidos.
eq("caminho que contém ponto", g("/checkout.php"), "ok");
eq("subcaminho do domínio", g("meusite.com/checkout"), "ok");
eq("caminho de uma letra ainda é caminho", g("/c"), "ok");

console.log(`\n${ok} asserções, ${falhas} falha(s).\n`);
process.exit(falhas > 0 ? 1 : 0);
