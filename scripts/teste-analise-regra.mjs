/**
 * Asserções de `lib/rules/analise.ts` — os avisos ESTÁTICOS de condição.
 *
 * ⚠️ O que este teste protege é a **fronteira** do módulo, não os textos: o que
 * ele pode afirmar (álgebra) e o que ele NÃO pode (chute). O aviso que disse
 * demais é pior que o ausente — um aviso que às vezes mente treina o usuário a
 * ignorar todos, inclusive os certos.
 *
 * O caso que originou tudo: `gasto ≤ 999999` (pega tudo) contra
 * `gasto ≥ 999999` (não pega nada). **Nenhum dos dois gera aviso aqui, de
 * propósito** — não há como provar por álgebra que 999999 é grande. Quem
 * responde isso é a PRÉVIA, contando entidades reais.
 *
 * Puro: sem banco, sem rede.
 */
import { analisarCondicoes } from "@/lib/rules/analise";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  // ⚠️ Comparação por VALOR: quase toda asserção aqui devolve um array, e `===`
  // compararia identidade de referência — falharia sempre, com "obtido" e
  // "esperado" impressos idênticos na tela. Foi o que aconteceu na 1ª versão.
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}
const c = (metrica, operador, valor) => ({ metrica, operador, valor });
const graus = (conds) => analisarCondicoes(conds).map((a) => a.gravidade);

console.log("\n\x1b[1m🔴 A FRONTEIRA: o que NÃO se pode afirmar\x1b[0m");
eq("`gasto <= 999999` (o erro real) NÃO gera aviso", graus([c("gasto", "<=", 999999)]), []);
eq("`gasto >= 999999` também NÃO gera aviso", graus([c("gasto", ">=", 999999)]), []);
eq("`roas > 1000` NÃO gera aviso", graus([c("roas", ">", 1000)]), []);
eq("`ctr > 100` NÃO gera aviso (CTR acima de 100% é raro, não impossível)", graus([c("ctr", ">", 100)]), []);

console.log("\n\x1b[1mCondição normal não incomoda\x1b[0m");
eq("`cpa > 50` é silencioso", graus([c("cpa", ">", 50)]), []);
eq("duas métricas diferentes são silenciosas", graus([c("cpa", ">", 50), c("roas", "<", 1)]), []);
eq("faixa coerente na MESMA métrica é silenciosa", graus([c("gasto", ">", 50), c("gasto", "<", 500)]), []);
eq("`>= 50 E <= 50` é satisfazível (valor exato)", graus([c("gasto", ">=", 50), c("gasto", "<=", 50)]), []);

console.log("\n\x1b[1mContradição — demonstrável por álgebra\x1b[0m");
eq("`gasto > 100 E gasto < 50`", graus([c("gasto", ">", 100), c("gasto", "<", 50)]), ["impossivel"]);
eq("`gasto >= 100 E gasto <= 50`", graus([c("gasto", ">=", 100), c("gasto", "<=", 50)]), ["impossivel"]);
eq("`gasto > 50 E gasto < 50` (limite aberto dos dois lados)", graus([c("gasto", ">", 50), c("gasto", "<", 50)]), ["impossivel"]);
eq("`gasto > 50 E gasto <= 50`", graus([c("gasto", ">", 50), c("gasto", "<=", 50)]), ["impossivel"]);
eq("`= 10 E = 20` (dois valores exatos diferentes)", graus([c("cpa", "=", 10), c("cpa", "=", 20)]), ["impossivel"]);
eq("`= 10 E > 50` (exato fora da faixa)", graus([c("cpa", "=", 10), c("cpa", ">", 50)]), ["impossivel"]);
eq("`= 50 E > 50` (exato no limite ABERTO)", graus([c("cpa", "=", 50), c("cpa", ">", 50)]), ["impossivel"]);
eq("`= 50 E >= 50` NÃO é contradição", graus([c("cpa", "=", 50), c("cpa", ">=", 50)]), []);
eq(
  "contradição numa métrica não contamina a outra",
  graus([c("gasto", ">", 100), c("gasto", "<", 50), c("cpa", ">", 10)]),
  ["impossivel"],
);
eq(
  "três condições, contradição só entre a 1ª e a 3ª",
  graus([c("gasto", ">", 100), c("cpa", ">", 5), c("gasto", "<", 20)]),
  ["impossivel"],
);

console.log("\n\x1b[1mPiso das métricas — todas são ≥ 0\x1b[0m");
eq("`gasto >= 0` é SEMPRE verdadeira", graus([c("gasto", ">=", 0)]), ["sempre"]);
eq("`gasto >= -5` idem", graus([c("gasto", ">=", -5)]), ["sempre"]);
eq("`gasto > -1` idem", graus([c("gasto", ">", -1)]), ["sempre"]);
eq("`gasto > 0` NÃO é sempre verdadeira (zero é possível)", graus([c("gasto", ">", 0)]), []);
eq("`gasto < 0` NUNCA é verdadeira", graus([c("gasto", "<", 0)]), ["impossivel"]);
eq("`gasto <= -1` NUNCA é verdadeira", graus([c("gasto", "<=", -1)]), ["impossivel"]);
eq("`gasto <= 0` NÃO é impossível (zero é possível)", graus([c("gasto", "<=", 0)]), []);
eq("`vendas = -1` NUNCA é verdadeira", graus([c("vendas", "=", -1)]), ["impossivel"]);

console.log("\n\x1b[1mSempre-verdadeira acompanhada: aviso mais fraco\x1b[0m");
{
  // Com uma condição que de fato filtra ao lado, a regra NÃO age em tudo —
  // então o aviso precisa ser "esta não filtra", não "vai pegar tudo".
  const g = graus([c("gasto", ">=", 0), c("cpa", ">", 50)]);
  eq("vira 'atencao', não 'sempre'", g, ["atencao"]);
}
eq(
  "todas sempre-verdadeiras → 'sempre'",
  graus([c("gasto", ">=", 0), c("vendas", ">=", 0)]),
  ["sempre"],
);

console.log("\n\x1b[1mLista vazia — o motor não dispara\x1b[0m");
eq("nenhuma condição é 'impossivel'", graus([]), ["impossivel"]);
{
  const a = analisarCondicoes([]);
  eq("e o texto diz o que fazer", a[0].texto.includes("Acrescente"), true);
}

console.log("\n\x1b[1mTexto\x1b[0m");
{
  const casos = [
    [c("gasto", ">", 100), c("gasto", "<", 50)],
    [c("gasto", "<", 0)],
    [c("gasto", ">=", 0)],
    [],
  ];
  const vazios = casos.flatMap((k) => analisarCondicoes(k)).filter((a) => !a.texto.trim()).length;
  eq("todo aviso tem texto", vazios, 0);
  // O rótulo da métrica vai para a tela: "Gasto", não "gasto".
  eq(
    "usa o rótulo da métrica, não a chave crua",
    analisarCondicoes([c("gasto", "<", 0)])[0].texto.startsWith("Gasto"),
    true,
  );
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
