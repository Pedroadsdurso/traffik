/**
 * QUEM ENVIA CADA EVENTO À META — a partição que impede a CONTAGEM DOBRADA.
 *
 * 🔴 O DEFEITO QUE ESTA PARTIÇÃO EXISTE PARA IMPEDIR É MUDO POR NATUREZA
 *
 * Com o pixel nativo do gateway na mesma jornada, o MESMO evento chega à Meta
 * por dois caminhos. Ela só junta os dois quando trazem o mesmo `event_id`, e
 * com o gateway isso é **impossível**: o `eid` dele é um UUID gerado no
 * navegador dele e não aparece em campo nenhum do webhook — verificado em 167
 * payloads reais.
 *
 * **Medido em produção em 31/07/2026: 1 venda real, o Gerenciador marcando 2.**
 *
 * ⛔ E o custo não é um número feio numa tela. É a Meta **otimizando a campanha
 * contra dado inflado** — ela passa a mirar o público que "converte o dobro", e
 * o dinheiro do usuário vai atrás de um fantasma. Ninguém percebe, porque a
 * ferramenta que denunciaria é o Gerenciador de Eventos da Meta, que é de outra
 * empresa e ninguém abre.
 *
 * ## A propriedade que se congela aqui
 *
 * > **Cada evento tem UM dono.** A ausência de duplicata vem de PARTIÇÃO, não
 * > de coordenação — ninguém manda o mesmo evento duas vezes porque só um lado
 * > o manda.
 *
 * Então o que se afirma não é "o `Purchase` é da Trackhub": é que
 * `traffikEnvia` é **verdadeiro para exatamente um** dos estados possíveis, e
 * que valor corrompido **nunca** vira `traffik` por acidente.
 */

import assert from "node:assert/strict";
import {
  EVENTOS_DO_PIXEL,
  lerDonos,
  donoDoEvento,
  padraoDoEvento,
  traffikEnvia,
} from "@/lib/pixel/donos";

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

console.log("\nQuem envia cada evento à Meta");

/* ⛔ LINHA DE BASE: sem ela, todo laço abaixo passaria sobre lista vazia. */
ok("linha de base: há eventos para examinar", EVENTOS_DO_PIXEL.length >= 5, EVENTOS_DO_PIXEL.join(", "));

/* ═══ 1 · `padraoDoEvento` — e o PageView é a exceção que tem motivo ═════ */
{
  eq("`PageView` NÃO é da Trackhub por padrão", padraoDoEvento("PageView"), "navegador");
  for (const e of EVENTOS_DO_PIXEL.filter((x) => x !== "PageView")) {
    eq(`\`${e}\` é da Trackhub por padrão`, padraoDoEvento(e), "traffik");
  }
  /* ⚠️ Evento desconhecido cai em `traffik` — é o lado que ENVIA. Está certo
     como escolha de produto (evento novo nosso já sai funcionando), e é
     exatamente por isso que precisa de asserção: alguém pode "consertar" para
     `ninguem` achando mais seguro, e aí um evento novo nasce mudo. */
  eq("evento desconhecido cai em `traffik` (decisão, não descuido)", padraoDoEvento("EventoQueNaoExiste"), "traffik");
}

/* ═══ 2 · `lerDonos` — o mapa vindo do banco é DADO NÃO CONFIÁVEL ═══════ */
{
  eq("mapa válido é lido inteiro", lerDonos({ Purchase: "gateway", Lead: "ninguem" }), { Purchase: "gateway", Lead: "ninguem" });
  eq("null vira mapa vazio", lerDonos(null), {});
  eq("array vira mapa vazio", lerDonos(["Purchase"]), {});
  eq("string vira mapa vazio", lerDonos("Purchase"), {});
  eq("número vira mapa vazio", lerDonos(42), {});

  /* 🔴 Valor INVÁLIDO é DESCARTADO, não aceito nem convertido. */
  eq("dono inválido é descartado", lerDonos({ Purchase: "meu-servidor" }), {});
  eq("dono não-string é descartado", lerDonos({ Purchase: 1 }), {});
  eq("evento desconhecido é descartado", lerDonos({ EventoInventado: "gateway" }), {});
  eq(
    "o válido sobrevive ao lado do inválido",
    lerDonos({ Purchase: "gateway", Lead: "xxx", Inventado: "traffik" }),
    { Purchase: "gateway" },
  );
}

/* ═══ 3 · 🔴 A PARTIÇÃO — a propriedade que impede a contagem dobrada ═══ */
{
  const DONOS = ["traffik", "navegador", "gateway", "ninguem"];

  /* ⛔ EXATAMENTE UM dos quatro estados faz a Trackhub enviar. Se dois
     enviassem, a duplicata voltaria — e é isso que se congela, não a
     identidade do vencedor. */
  for (const e of EVENTOS_DO_PIXEL) {
    const enviam = DONOS.filter((d) => traffikEnvia({ [e]: d }, e));
    eq(`\`${e}\`: EXATAMENTE um dono faz a Trackhub enviar`, enviam, ["traffik"]);
  }

  /* E o complemento: os outros três param o envio, cada um pelo seu motivo. */
  for (const d of ["navegador", "gateway", "ninguem"]) {
    ok(`\`${d}\` NÃO envia pela Trackhub`, traffikEnvia({ Purchase: d }, "Purchase") === false);
  }

  /* ⚠️ `gateway` e `ninguem` fazem a MESMA coisa do nosso lado — a diferença é
     de INTENÇÃO DECLARADA, e existe para o diagnóstico poder perguntar "você
     marcou que o gateway envia Purchase — ele tem CAPI mesmo?". A asserção
     existe para os dois não serem fundidos por parecerem redundantes. */
  ok(
    "⚠️ `gateway` e `ninguem` param o envio IGUAL, e continuam distintos",
    traffikEnvia({ Purchase: "gateway" }, "Purchase") === traffikEnvia({ Purchase: "ninguem" }, "Purchase") &&
      donoDoEvento({ Purchase: "gateway" }, "Purchase") !== donoDoEvento({ Purchase: "ninguem" }, "Purchase"),
    "mesmo efeito, intenções diferentes",
  );
}

/* ═══ 4 · DADO CORROMPIDO NUNCA VIRA `traffik` POR ACIDENTE ═════════════
 * 🔴 Esta é a direção que importa. Um mapa corrompido caindo em `traffik`
 * RELIGA o envio de um evento que o usuário desligou — e a duplicata volta,
 * muda. Cair no padrão é aceitável; cair em `traffik` CONTRA uma escolha
 * explícita, não. */
{
  const escolheu = { Purchase: "gateway" };
  ok("com escolha explícita, a Trackhub NÃO envia", traffikEnvia(escolheu, "Purchase") === false);

  /* Corrupções plausíveis do JSON gravado. */
  const corrompidos = [
    ["valor virou número", { Purchase: 1 }],
    ["valor virou objeto", { Purchase: { dono: "gateway" } }],
    ["chave em minúscula", { purchase: "gateway" }],
    ["dono com espaço", { Purchase: " gateway" }],
    ["dono em maiúscula", { Purchase: "GATEWAY" }],
  ];
  for (const [nome, bruto] of corrompidos) {
    /* ⚠️ Todos caem no PADRÃO (`traffik` para Purchase) — e isso É religar o
       envio. A asserção NÃO afirma que está certo: ela congela o
       comportamento para a decisão ser visível. */
    ok(
      `⚠️ ${nome} → cai no padrão \`${donoDoEvento(bruto, "Purchase")}\` (a escolha do usuário se perde)`,
      donoDoEvento(bruto, "Purchase") === "traffik",
      "registrado, não aprovado — ver a nota abaixo",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · PLANTIOS
 * ═════════════════════════════════════════════════════════════════════ */
console.log("\n5 · plantios");

/* ── A: aceitar qualquer string como dono ────────────────────────────────
   O "conserto" de quem vê o mapa vir vazio e conclui que a validação é chata.
   Com ele, `"traffick"` (com dois k) vira um dono válido que NÃO é `traffik` —
   e o evento silenciosamente para de ser enviado. Ou o contrário. */
{
  const frouxo = (bruto, evento) => {
    const v = bruto && typeof bruto === "object" ? bruto[evento] : undefined;
    return typeof v === "string" ? v : padraoDoEvento(evento);
  };
  const errado = { Purchase: "traffick" }; // erro de digitação
  ok("PLANTIO A: o frouxo aceita `traffick` como dono", frouxo(errado, "Purchase") === "traffick");
  ok("PLANTIO A: e o certo o descarta, caindo no padrão", donoDoEvento(errado, "Purchase") === "traffik");
  ok(
    "PLANTIO A: com o frouxo, `traffikEnvia` vira FALSO — o Purchase para de ir à Meta",
    frouxo(errado, "Purchase") !== "traffik" && traffikEnvia(errado, "Purchase") === true,
    "um typo apagaria o evento mais importante, em silêncio",
  );
  let caiu = false;
  try {
    assert.equal(frouxo(errado, "Purchase"), "traffik");
  } catch {
    caiu = true;
  }
  ok("PLANTIO A: a asserção do descarte DERRUBA", caiu);
}

/* ── B: `traffikEnvia` como NEGAÇÃO de "alguém mais envia" ───────────────
   O "conserto" natural de quem lê a doc: *"se o dono não é o gateway, somos
   nós"*. Ele parece equivalente e NÃO é — ele faz `navegador` e `ninguem`
   enviarem, e aí a duplicata volta pelos dois lados. */
{
  const porNegacao = (bruto, evento) => donoDoEvento(bruto, evento) !== "gateway";

  /* ⛔ PAR NEGATIVO: nos dois estados mais comuns os dois concordam — é por
     isso que o defeito passaria em revisão. */
  ok(
    "PLANTIO B (par negativo): com `traffik` e com `gateway`, os dois CONCORDAM",
    porNegacao({ Purchase: "traffik" }, "Purchase") === traffikEnvia({ Purchase: "traffik" }, "Purchase") &&
      porNegacao({ Purchase: "gateway" }, "Purchase") === traffikEnvia({ Purchase: "gateway" }, "Purchase"),
    "← os dois casos que alguém testaria à mão",
  );

  /* E divergem exatamente onde dói. */
  const divergem = ["navegador", "ninguem"].filter(
    (d) => porNegacao({ Purchase: d }, "Purchase") !== traffikEnvia({ Purchase: d }, "Purchase"),
  );
  eq("PLANTIO B: divergem em `navegador` e `ninguem`", divergem, ["navegador", "ninguem"]);
  ok(
    "PLANTIO B: e com `PageView` a duplicata volta — o padrão dele é `navegador`",
    porNegacao({}, "PageView") === true && traffikEnvia({}, "PageView") === false,
    "o código da Meta já dispara PageView; enviar de novo é contagem dobrada",
  );

  let caiu = false;
  try {
    assert.equal(porNegacao({}, "PageView"), false);
  } catch {
    caiu = true;
  }
  ok("PLANTIO B: a asserção do PageView DERRUBA", caiu);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: " + EVENTOS_DO_PIXEL.length + " eventos × 4 donos possíveis\n");
