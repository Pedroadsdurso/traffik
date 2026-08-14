/**
 * A LINHA DECLARATIVA DO NÓ DE ICs — contra o CONSTRUTOR, não contra o desenho.
 *
 * 🔴 POR QUE ESTE ARQUIVO EXISTE
 *
 * `teste-desenho.mjs` tem uma asserção chamada *"as três parcelas do nó de ICs
 * moram em UMA linha, e ela FECHA o total"*. Ela **monta a string à mão** e a
 * passa pronta para o `FitaFunil` — mede o DESENHO de uma composição, nunca a
 * CONSTRUÇÃO dela.
 *
 * Provado em 14/08/2026: mudei a regra inteira da linha (o nó passou de
 * `icsNavegador` para `icsComJornada`, a soma final saiu, a entrada lateral
 * virou declaração de fora) e **as 38 asserções daquele arquivo seguiram
 * verdes**. É a família *FIXTURE QUE CRIA O REGISTRO FINAL DIRETO*: o estado
 * final fica certo, a suíte fica verde, e o código que deveria tê-lo produzido
 * nunca roda.
 *
 * ⛔ Por isso a construção saiu da IIFE do `catalogoRender` e virou
 * `lib/funil/composicao.ts`. Enquanto morava dentro do componente, nenhum teste
 * a alcançava — a mesma razão que tirou o preset do pixel de dentro do `.tsx`.
 */

import assert from "node:assert/strict";
import { composicaoDoNoDeICs } from "@/lib/funil/composicao";

let n = 0;
const eq = (nome, a, b) => {
  assert.equal(a, b, nome + "\n  obtido:   " + a + "\n  esperado: " + b);
  console.log("  ✓ " + nome);
  n++;
};
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

console.log("\nA linha do nó de ICs");

/* ---- 1. O caso do dev: 38 com jornada (14 + 24), 35 fora ---- */
{
  const linha = composicaoDoNoDeICs({ valor: 38, derivadosDaVenda: 24, entradaLateral: 35 });
  eq(
    "decompoe por dentro e declara a entrada lateral por fora",
    linha,
    "38 com jornada (14 vistos no navegador · 24 carimbados pelo gateway) · e 35 sem jornada, fora da cadeia",
  );

  /* 🔴 A REGRESSÃO DE 128,1%: a entrada lateral somada ao total. */
  ok("⛔ a entrada lateral NAO entra numa soma", !/=\s*73/.test(linha), "nao ha '= 73'");
  ok("⛔ e o texto nao afirma um total nenhum", !linha.includes("="), "nenhum '=' na linha");
  ok("a parcela de dentro fecha: 14 + 24 = 38", linha.includes("38 com jornada") && linha.includes("14 vistos") && linha.includes("24 carimbados"));
  ok("o separador da lateral e 'e', nao '·' sozinho", linha.includes("· e 35 sem jornada"));
}

/* ---- 2. Tudo do navegador, sem lateral: NAO ha linha ---- */
{
  const linha = composicaoDoNoDeICs({ valor: 38, derivadosDaVenda: 0, entradaLateral: 0 });
  eq("sem parcela nenhuma a linha SOME (nao vira '0 carimbados')", linha, undefined);
}

/* ---- 3. So lateral, nenhum derivado: sem decomposicao interna ---- */
{
  const linha = composicaoDoNoDeICs({ valor: 38, derivadosDaVenda: 0, entradaLateral: 35 });
  eq("so lateral: nao inventa decomposicao interna", linha, "38 com jornada · e 35 sem jornada, fora da cadeia");
  ok("nao menciona navegador nem gateway", !linha.includes("navegador") && !linha.includes("gateway"));
}

/* ---- 4. So derivados, nenhuma lateral ---- */
{
  const linha = composicaoDoNoDeICs({ valor: 38, derivadosDaVenda: 24 });
  eq("so derivados: decompoe e nao declara lateral", linha, "38 com jornada (14 vistos no navegador · 24 carimbados pelo gateway)");
  ok("nao fala em 'fora da cadeia' quando nao ha nada fora", !linha.includes("fora da cadeia"));
}

/* ---- 5. Separador de milhar, porque a tela nao formata de novo ---- */
{
  const linha = composicaoDoNoDeICs({ valor: 12500, derivadosDaVenda: 2500, entradaLateral: 1000 });
  ok("milhar formatado em pt-BR", linha.includes("12.500") && linha.includes("10.000") && linha.includes("2.500") && linha.includes("1.000"), linha);
}

/* ---- 6. INVARIANTE: a parcela do navegador nunca e negativa ---- */
{
  /* Derivados > valor nao deveria acontecer, mas se o servidor mandar, a linha
     nao pode imprimir "-4 vistos no navegador". */
  const linha = composicaoDoNoDeICs({ valor: 20, derivadosDaVenda: 24, entradaLateral: 0 });
  ok("linha de base: houve linha para examinar", typeof linha === "string" && linha.length > 0);
  ok("⚠️ derivados > valor NAO imprime parcela negativa", !/-\d/.test(linha), linha);
}

/* ---------------------------------------------------------------------------
 * 7. PROVA PELO LADO NEGATIVO
 *
 * PLANTIO: a regra ANTIGA — somar a entrada lateral e fechar com "= N
 * checkouts". E o defeito que produziu a pilula de 128,1%, e a assercao 1
 * precisa derrubar com ele.
 * ------------------------------------------------------------------------ */
{
  const antiga = ({ valor, derivadosDaVenda = 0, entradaLateral = 0 }) => {
    const f = (x) => x.toLocaleString("pt-BR");
    const partes = [`${f(valor)} vistos no navegador`];
    if (derivadosDaVenda > 0) partes.push(`${f(derivadosDaVenda)} derivados da venda`);
    if (entradaLateral > 0) partes.push(`${f(entradaLateral)} sem jornada`);
    return `${partes.join(" · ")} = ${f(valor + derivadosDaVenda + entradaLateral)} checkouts`;
  };
  const ruim = antiga({ valor: 38, derivadosDaVenda: 24, entradaLateral: 35 });

  ok("PLANTIO: a regra antiga SOMA a lateral", /=\s*97/.test(ruim), ruim);

  let caiu = false;
  try {
    assert.ok(!ruim.includes("="), "a linha nao pode afirmar um total");
  } catch {
    caiu = true;
  }
  ok("PLANTIO: a assercao 'nao afirma total' DERRUBA com a regra antiga", caiu);

  let caiu2 = false;
  try {
    assert.equal(
      ruim,
      "38 com jornada (14 vistos no navegador · 24 carimbados pelo gateway) · e 35 sem jornada, fora da cadeia",
    );
  } catch {
    caiu2 = true;
  }
  ok("PLANTIO: a assercao 1 DERRUBA com a regra antiga", caiu2);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
