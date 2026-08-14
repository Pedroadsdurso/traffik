/**
 * A PARTIÇÃO DA FITA — `segmentosDaFita`, sob asserção.
 *
 * 🔴 POR QUE ESTE ARQUIVO NASCEU DEPOIS DO RECURSO
 *
 * A fita passou a se PARTIR onde a fonte muda em 13/08/2026 (`444ce75`). O
 * `teste-desenho.mjs` importava `calcularFluxo` e `segmentosDaFita` **e não
 * chamava nenhum dos dois** — os imports ficaram como marca de uma asserção
 * planejada e nunca escrita. O lint os acusou como órfãos em 14/08.
 *
 * ⛔ Isso é a família *SCRIPT DE TESTE FORA DO AGREGADO*, numa forma pior: não
 * era um teste fora do agregado, era um teste **inexistente** atrás de um
 * import que dava a aparência de cobertura. Quem abrisse o arquivo veria
 * `segmentosDaFita` na lista de imports e concluiria que a partição estava
 * coberta.
 *
 * ⚠️ E a razão de a asserção não ter sido escrita no `teste-desenho` é real: lá
 * a fita é medida pelo MARKUP, e a geometria dela mora atrás de `largura > 0`,
 * que no `renderToStaticMarkup` é sempre 0. A saída é não medir a partição pelo
 * desenho — `segmentosDaFita` é PURA, e é nela que a partição vive.
 */

import assert from "node:assert/strict";
import { calcularFluxo, segmentosDaFita } from "@/lib/funil/fita";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};
const eq = (nome, a, b) => {
  assert.deepEqual(a, b, nome + " — obtido " + JSON.stringify(a));
  console.log("  ✓ " + nome + " — " + JSON.stringify(a));
  n++;
};

/** Monta um fluxo pelo caminho de produção, não à mão. */
const fluxoDe = (valores, opcoes = {}) =>
  calcularFluxo(valores, { largura: 1000, faixa: 200, margem: 24, ...opcoes });

const formato = (segs) => segs.map((s) => s.length);

console.log("\nA fita se parte onde a FONTE muda");

/* ---- 1. Sem corte nenhum: UMA fita, como antes da mudanca ---- */
{
  const f = fluxoDe([100, 80, 60, 40]);
  const segs = segmentosDaFita(f);
  eq("sem corte: um segmento so", formato(segs), [4]);
  ok("linha de base: havia etapas para segmentar", f.etapas.length === 4);
}

/* ---- 2. Um corte no meio parte em DOIS ---- */
{
  const f = fluxoDe([100, 80, 60, 40]);
  f.cortes = [false, false, true, false];
  const segs = segmentosDaFita(f);
  eq("corte no indice 2 parte em 2+2", formato(segs), [2, 2]);
  ok("nenhuma etapa se perde na particao", segs.flat().length === 4);
}

/* ---- 3. Etapa FORA da fita encerra o segmento e NAO entra em nenhum ----
   E o comportamento que o `etapasDaFita` do componente fazia por fora e que
   migrou para ca. A asserção existe para que a migração não se desfaça. */
{
  const f = fluxoDe([100, 80, 60, 40], { naFita: [false, true, true, true] });
  const segs = segmentosDaFita(f);
  eq("etapa fora da fita nao entra em segmento", formato(segs), [3]);
  ok(
    "e a etapa excluida e mesmo a de indice 0",
    segs.flat().every((e) => e.naFita),
    "todas as etapas segmentadas tem naFita true",
  );
}

/* ---- 4. Fora-da-fita NO MEIO parte a fita — ela nao salta a coluna ---- */
{
  const f = fluxoDe([100, 80, 60, 40], { naFita: [true, false, true, true] });
  const segs = segmentosDaFita(f);
  eq("fora-da-fita no meio parte em 1+2", formato(segs), [1, 2]);
  ok("a fita NAO salta por cima da coluna que nao participa", segs.length === 2);
}

/* ---- 5. A INVARIANTE: todo segmento e contiguo e so tem naFita ---- */
{
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let casos = 0;
  let viuParticao = 0;
  let viuForaDaFita = 0;
  for (let t = 0; t < 200; t++) {
    const k = 2 + Math.floor(rnd() * 5);
    const vals = [];
    let v = 100 + Math.floor(rnd() * 900);
    for (let i = 0; i < k; i++) {
      vals.push(v);
      v = Math.max(1, Math.floor(v * (0.3 + rnd() * 0.7)));
    }
    const naFita = vals.map(() => rnd() > 0.2);
    const f = fluxoDe(vals, { naFita });
    f.cortes = vals.map(() => rnd() > 0.75);
    const segs = segmentosDaFita(f);

    assert.ok(
      segs.every((seg) => seg.every((e) => e.naFita)),
      "segmento com etapa fora da fita — vals " + JSON.stringify(vals),
    );
    assert.ok(
      segs.every((seg) => seg.length > 0),
      "segmento vazio — vals " + JSON.stringify(vals),
    );
    const totalSeg = segs.flat().length;
    const totalNaFita = f.etapas.filter((e) => e.naFita).length;
    assert.equal(totalSeg, totalNaFita, "etapa naFita perdida — vals " + JSON.stringify(vals));

    if (segs.length > 1) viuParticao++;
    if (naFita.some((x) => !x)) viuForaDaFita++;
    casos++;
  }
  ok("fuzz(200, semente 7): nenhum segmento vazio, nenhuma etapa perdida", casos === 200);
  /* ⛔ LINHA DE BASE. Sem elas o fuzz passaria com 200 fluxos de um segmento e
     nenhuma etapa fora da fita — a coleção que satisfaz tudo sem exercer nada. */
  ok("linha de base: o fuzz produziu particao de verdade (" + viuParticao + ")", viuParticao > 0);
  ok("linha de base: o fuzz produziu etapa fora da fita (" + viuForaDaFita + ")", viuForaDaFita > 0);
}

/* ---------------------------------------------------------------------------
 * 6. PROVA PELO LADO NEGATIVO
 *
 * PLANTIO: reimplementar `segmentosDaFita` SEM o ramo de `naFita` — que e
 * exatamente o comportamento que o `etapasDaFita` do componente carregava antes
 * de ser removido em 14/08. Se as assercoes acima nao caissem com isso, elas
 * nao estariam medindo a migracao daquele recorte.
 * ------------------------------------------------------------------------ */
{
  const semNaFita = (fluxo) => {
    const segs = [];
    let atual = [];
    fluxo.etapas.forEach((e, i) => {
      if (fluxo.cortes[i] && atual.length) {
        segs.push(atual);
        atual = [];
      }
      atual.push(e);
    });
    if (atual.length) segs.push(atual);
    return segs;
  };

  const f = fluxoDe([100, 80, 60, 40], { naFita: [false, true, true, true] });
  const bom = segmentosDaFita(f);
  const ruim = semNaFita(f);

  ok("PLANTIO: sem o ramo naFita, a etapa excluida VOLTA para a fita", ruim.flat().length === 4);
  ok("PLANTIO: e o formato diverge do correto", JSON.stringify(formato(ruim)) !== JSON.stringify(formato(bom)),
     JSON.stringify(formato(ruim)) + " != " + JSON.stringify(formato(bom)));

  let caiu = false;
  try {
    assert.deepEqual(formato(ruim), [3]);
  } catch {
    caiu = true;
  }
  ok("PLANTIO: a assercao 3 DERRUBA com o defeito", caiu);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
