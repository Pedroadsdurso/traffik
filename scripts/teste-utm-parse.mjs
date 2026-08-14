/**
 * O PARSER DE CÓDIGOS DE RASTREIO — a atribuição venda→campanha, sob asserção.
 *
 * 🔴 `parseXcod`, `parseTrackingCodes` E `splitPipe` NÃO ERAM NOMEADOS EM
 * NENHUM TESTE — achado pela varredura de 14/08/2026.
 *
 * ⛔ É o núcleo do **Bloco 11**, que existe para tornar a atribuição confiável.
 * A dívida técnica nº 3 desta base diz que atribuir por NOME é ambíguo quando
 * dois anúncios se chamam igual; o `id` é o que resolve. Quem decide se o `id`
 * existe é `splitPipe`, e ele não tinha uma asserção.
 *
 * ## O comportamento que mais custou, e que aqui fica congelado
 *
 * `splitPipe` **descarta id não numérico** — de propósito: a Meta usa inteiros
 * longos, e um `camp-dev-A` é indistinguível de um placeholder não substituído.
 * Isso está certo, e teve um efeito que o `CLAUDE.md` registra como
 * *SEED QUE PRODUZ ESTADO INCOMPLETO*: o `seed-dev` gravava exatamente
 * `fbCampaignId = "camp-dev-A"`, então `camp.id` saía `null` e **toda**
 * atribuição do dev caía no ramo do NOME. O ramo do ID — o que roda em
 * produção — nunca foi percorrido, e ninguém sabia.
 *
 * ⚠️ Estas asserções não impedem aquele seed de existir. Elas impedem que
 * alguém "conserte" o descarte do id não numérico sem entender por que ele
 * está lá — que seria trocar um placeholder por um id de verdade na conta do
 * cliente.
 */

import assert from "node:assert/strict";
import { parseXcod, parseTrackingCodes, splitPipe } from "@/lib/utm/parse";

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

console.log("\nO parser de códigos de rastreio");

/* ---- 1. `splitPipe`: nome|id ------------------------------------------- */
eq("nome e id separados pelo ÚLTIMO pipe", splitPipe("Campanha X|123456"), { name: "Campanha X", id: "123456" });
eq("nome COM pipe dentro: só o último separa", splitPipe("Promo | Verão|987"), { name: "Promo | Verão", id: "987" });
eq("sem pipe: é nome, e o id é nulo", splitPipe("Campanha sem id"), { name: "Campanha sem id", id: null });
eq("vazio devolve os dois nulos", splitPipe(""), { name: null, id: null });
eq("nulo devolve os dois nulos", splitPipe(null), { name: null, id: null });

/* ---- 2. 🔴 O ID NÃO NUMÉRICO É DESCARTADO — e é decisão, não descuido ---
   A Meta usa inteiros longos. Um id que não é dígito puro é placeholder não
   substituído, e tratá-lo como id atribuiria venda à campanha errada. */
eq("id não numérico VIRA NULO, o nome fica", splitPipe("Campanha|camp-dev-A"), { name: "Campanha", id: null });
eq("placeholder do Facebook vira nulo", splitPipe("Campanha|{{campaign.id}}"), { name: "Campanha", id: null });
eq("id com espaços em volta é aparado", splitPipe("Campanha|  123  "), { name: "Campanha", id: "123" });
eq("id misto (dígito + letra) vira nulo", splitPipe("Campanha|123abc"), { name: "Campanha", id: null });
ok("id só de dígitos, bem longo, PASSA", splitPipe("C|120000000000012345").id === "120000000000012345");

/* ---- 3. NOME que ainda é placeholder não é nome ------------------------ */
{
  const r = splitPipe("{{campaign.name}}|123");
  ok("nome-placeholder vira nulo", r.name === null, JSON.stringify(r));
  ok("…e o id continua valendo", r.id === "123");
}

/* ---- 4. `parseXcod` ----------------------------------------------------
 * ⚠️ Havia aqui uma asserção com `|| true` — ela NÃO PODIA FALHAR, que é
 * exatamente o defeito que este arquivo existe para não cometer. Apagada em vez
 * de "corrigida": uma asserção que passa por construção não vira boa mudando o
 * texto. */
{
  /* O formato real: segmentos separados pelo separador, cada um `nome|id`. */
  const x = parseXcod("FB~Camp X|111~Conj Y|222~Anun Z|333~feed", "~");
  eq(
    "xcod completo: campanha, conjunto, anúncio e posicionamento",
    [x.campaignName, x.campaignId, x.adsetName, x.adsetId, x.adName, x.adId, x.placement],
    ["Camp X", "111", "Conj Y", "222", "Anun Z", "333", "feed"],
  );
}
{
  const x = parseXcod("FB~Camp~Conj~Anun", "~");
  eq("sem posicionamento: `placement` é nulo, o resto vale", [x.campaignName, x.adName, x.placement], ["Camp", "Anun", null]);
}

/* ---- 4b. ⛔ MENOS DE 4 PARTES NÃO É xcod — devolve VAZIO ----------------
   Um xcod truncado atribuiria a campanha errada, e "quase certo" aqui é pior
   que nada: a venda entra numa campanha que não a gerou. */
{
  const x = parseXcod("FB~Camp~Conj", "~");
  ok("xcod com 3 partes devolve tudo nulo", x.campaignName === null && x.adName === null, JSON.stringify(x));
}
eq("xcod nulo devolve vazio", parseXcod(null, "~").campaignName, null);
eq("separador nulo devolve vazio", parseXcod("FB~a~b~c", null).campaignName, null);
eq("separador vazio devolve vazio", parseXcod("FB~a~b~c", "").campaignName, null);

/* ---- 5. `parseTrackingCodes`: os UTMs, e o xcod por cima --------------- */
{
  const r = parseTrackingCodes({ utmCampaign: "Camp UTM|555", utmContent: "Anun UTM|777" });
  ok("sem xcod, os UTMs respondem", r.campaignName === "Camp UTM" && r.campaignId === "555", JSON.stringify(r));
  ok("…e o anúncio também", r.adName === "Anun UTM" && r.adId === "777");
}
{
  /* O xcod é a fonte mais específica: quando existe, ele manda. */
  const r = parseTrackingCodes(
    { utmCampaign: "Camp UTM|555", xcod: "FB~Camp XCOD|111~Conj|222~Anun|333" },
    "~",
  );
  ok("com xcod, ele PREVALECE sobre o utm_campaign", r.campaignName === "Camp XCOD", JSON.stringify(r.campaignName));
  ok("…e traz o id do xcod", r.campaignId === "111");
}
{
  const r = parseTrackingCodes({});
  ok("entrada vazia não estoura e devolve nulos", r.campaignName === null && r.campaignId === null);
}

/* ---------------------------------------------------------------------------
 * 6. PROVA PELO LADO NEGATIVO
 *
 * PLANTIO: aceitar id NÃO NUMÉRICO — o "conserto" que alguém faria ao ver o
 * dev atribuindo tudo por nome, e que atribuiria venda a um placeholder.
 * ------------------------------------------------------------------------ */
{
  const splitPipeFrouxo = (v) => {
    if (!v) return { name: null, id: null };
    const i = v.lastIndexOf("|");
    if (i === -1) return { name: v.trim() || null, id: null };
    return { name: v.slice(0, i).trim() || null, id: v.slice(i + 1).trim() || null };
  };

  const certo = splitPipe("Campanha|{{campaign.id}}");
  const ruim = splitPipeFrouxo("Campanha|{{campaign.id}}");

  ok("PLANTIO: o frouxo aceita o PLACEHOLDER como id", ruim.id === "{{campaign.id}}", JSON.stringify(ruim.id));
  ok("PLANTIO: e o certo o recusa", certo.id === null);

  let caiu = false;
  try {
    assert.deepEqual(ruim, { name: "Campanha", id: null });
  } catch {
    caiu = true;
  }
  ok("PLANTIO: a asserção do placeholder DERRUBA com o frouxo", caiu);

  /* E o efeito prático: duas vendas de campanhas DIFERENTES cairiam no mesmo
     "id", que é a atribuição errada silenciosa. */
  const a = splitPipeFrouxo("Camp A|{{campaign.id}}").id;
  const b = splitPipeFrouxo("Camp B|{{campaign.id}}").id;
  ok("PLANTIO: duas campanhas distintas colidiriam no mesmo id", a === b && a !== null, String(a));
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
