/**
 * `dtoParaForm` — O CAMINHO DE VOLTA DA GAVETA DO PIXEL, e o único sem asserção.
 *
 * `test:pixel-preset` cobre oito símbolos de `lib/pixel/formulario.ts`
 * (`responderPreset`, `formParaInput`, `presetDoForm`, `problemasDoForm`…).
 * **`dtoParaForm` não está entre eles** — conferido na lista de import daquele
 * arquivo, não pelo nome do módulo.
 *
 * ### 🔴 POR QUE ELE IMPORTA, e é a razão que a fila deu para o espelho
 *
 * Ele é o que a `GavetaPixel` chama ao ABRIR um pixel existente
 * (`GavetaPixel.tsx:180`). O que ele deixa cair não vira erro: vira **o valor
 * padrão do formulário**. E o campo mais caro que ele carrega é `donos` — o
 * mapa de quem envia cada evento à Meta.
 *
 * > ## Se `donos` se perdesse aqui, abrir a gaveta e salvar reverteria a escolha do usuário para o padrão — e para o `Purchase` o padrão é a Trackhub. O envio duplo volta, sem ninguém tocar em nada.
 *
 * ⛔ E o defeito seria MUDO nos dois sentidos: a gaveta abriria bonita (o
 * padrão é um estado válido) e a Meta é quem contaria em dobro, semanas depois.
 *
 * ### 🔑 A PROPRIEDADE CONGELADA É A IDA E VOLTA, não os campos
 *
 * `dtoParaForm` e `formParaInput` são as duas pontas do mesmo caminho:
 *
 * ```
 *   PixelConfigDTO  --dtoParaForm-->  FormPixel  --formParaInput-->  PixelFormInput
 * ```
 *
 * Uma lista de campos escrita à mão aqui envelheceria no primeiro campo novo —
 * em silêncio, que é exatamente a família que a asserção existe para fechar. O
 * que se exige é que **tudo que entrou volte a sair**.
 *
 * ⚠️ Dois campos NÃO voltam, e é correto: `accessToken` (a gaveta nunca
 * re-exibe o segredo — ela guarda `savedToken` e manda string vazia) e o
 * `preset`, que é RECALCULADO em vez de transportado. Os dois têm asserção
 * própria, senão "não voltou" e "não devia voltar" seriam a mesma coisa.
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { dtoParaForm, formParaInput, presetDoForm } = await import("@/lib/pixel/formulario");

/** Um DTO com TODO campo preenchido com valor distinguível do padrão. */
const DTO = {
  id: "px1",
  name: "Pixel da Loja",
  metaPixels: [
    { pixelId: "111", nickname: "principal", hasToken: true },
    { pixelId: "222", nickname: "", hasToken: false },
  ],
  preset: { temPixelNativo: true, outroEnviaPurchase: true },
  eventOwners: {
    PageView: "navegador",
    ViewContent: "traffik",
    AddToCart: "traffik",
    InitiateCheckout: "traffik",
    Purchase: "gateway",
  },
  rules: [
    { eventType: "LEAD", enabled: true },
    { eventType: "ADD_TO_CART", enabled: true },
    { eventType: "INITIATE_CHECKOUT", enabled: true, detectionType: "url_contem", detectionValue: "/obrigado" },
    {
      eventType: "PURCHASE",
      enabled: true,
      sendMode: "TODAS",
      valueMode: "VALOR_FIXO",
      fixedValue: 49.9,
      targetProduct: "curso-x",
    },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — o DTO é DISTINGUÍVEL do padrão
 *
 * ⛔ Esta é a asserção sem a qual o arquivo inteiro não mede nada. Se o DTO
 * fixasse os mesmos valores que `dtoParaForm` usa como fallback, um
 * `dtoParaForm` que ignorasse a entrada e devolvesse só padrões passaria em
 * TODA asserção de ida e volta abaixo.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — o DTO difere do padrão em todo campo");

  const vazio = dtoParaForm({
    id: "z",
    name: "",
    metaPixels: [],
    preset: { temPixelNativo: false, outroEnviaPurchase: false },
    eventOwners: {},
    rules: [],
  });
  const cheio = dtoParaForm(DTO);

  const iguais = Object.keys(cheio).filter((k) => JSON.stringify(cheio[k]) === JSON.stringify(vazio[k]));
  ok(
    "os " + Object.keys(cheio).length + " campos do form diferem entre o DTO cheio e o vazio",
    iguais.length === 0,
    iguais.length ? "IGUAIS (não distinguem): " + iguais.join(", ") : "",
  );
  ok(
    "e o form do DTO vazio tem os padrões documentados",
    vazio.purchase.enabled === true && vazio.ic.enabled === false,
    "`purchase` nasce LIGADO e `ic` desligado — é o padrão do produto",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · 🔴 O MAPA DE DONOS ATRAVESSA INTACTO — o campo que custa dinheiro
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · 🔴 os donos");

  const f = dtoParaForm(DTO);

  ok(
    "o mapa de donos chega ao form sem perder chave",
    JSON.stringify(f.donos) === JSON.stringify(DTO.eventOwners),
    Object.keys(f.donos).length + " eventos",
  );
  ok(
    "…e sem TROCAR nenhum dono",
    Object.entries(DTO.eventOwners).every(([k, v]) => f.donos[k] === v),
    "`Purchase` → `" + f.donos.Purchase + "`",
  );

  /* E a outra ponta: o que a gaveta manda de volta ao servidor. */
  const input = formParaInput(f);
  ok(
    "e a IDA E VOLTA devolve o mesmo mapa ao servidor",
    JSON.stringify(input.eventOwners) === JSON.stringify(DTO.eventOwners),
    "DTO → form → input, sem perda",
  );

  /* ── PLANTIO: `donos` esquecido no retorno. É o campo mais fácil de perder,
     porque ele não tem par no `rules` — ele vem de `px.eventOwners`, sozinho. */
  {
    /* ⚠️ NADA de desestruturar para descartar — este lint não tem
       `varsIgnorePattern`, então tanto `{ donos, ...resto }` quanto
       `{ donos: _, ...resto }` deixam binding sem uso e quebram o piso de ZERO
       WARNINGS. Errei as duas vezes, e na segunda ainda commitei dizendo que
       estava resolvido: eu li o exit do `eslint` (que é 0 com warnings) em vez
       de ler a SAÍDA. É a mesma família do exit de wrapper, uma camada abaixo.

       O jeito sem binding é sobrescrever a chave. */
    const semDonos = (px) => ({ ...dtoParaForm(px), donos: {} });
    const inputPlantio = formParaInput(semDonos(DTO));
    ok(
      "PLANTIO: sem `donos`, o form abre com o mapa VAZIO",
      Object.keys(semDonos(DTO).donos).length === 0,
      "e a gaveta desenharia os padrões, que é um estado válido — nada acusa",
    );
    ok(
      "PLANTIO: e salvar mandaria o mapa vazio ao servidor",
      JSON.stringify(inputPlantio.eventOwners) !== JSON.stringify(DTO.eventOwners),
      "a escolha do usuário sobre QUEM envia cada evento seria revogada",
    );
    ok(
      "PLANTIO: a asserção da ida e volta DERRUBA",
      JSON.stringify(inputPlantio.eventOwners) === "{}",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · AS REGRAS POR EVENTO — cada uma no seu campo, e o `find` é por TIPO
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · as regras por evento");

  const f = dtoParaForm(DTO);

  ok("`LEAD` vira o booleano `lead`", f.lead === true);
  ok("`ADD_TO_CART` vira `addToCart`", f.addToCart === true);
  ok("`INITIATE_CHECKOUT` leva tipo E valor", f.ic.type === "url_contem" && f.ic.value === "/obrigado");
  ok("`PURCHASE` leva os quatro campos", f.purchase.sendMode === "TODAS" && f.purchase.valueMode === "VALOR_FIXO" && f.purchase.targetProduct === "curso-x");

  /* ⚠️ `fixedValue` muda de TIPO na travessia: número no DTO, string no form
     (o `<input>` é texto). Uma asserção de igualdade estrita aqui reprovaria
     por um comportamento correto — o que se exige é que o VALOR sobreviva. */
  ok(
    "`fixedValue` vira string sem perder o valor",
    f.purchase.fixedValue === "49.9" && parseFloat(f.purchase.fixedValue) === DTO.rules[3].fixedValue,
    typeof DTO.rules[3].fixedValue + " → " + typeof f.purchase.fixedValue,
  );

  /* A ordem das regras não pode importar: o `find` é por `eventType`. */
  {
    const invertido = { ...DTO, rules: [...DTO.rules].reverse() };
    ok(
      "a ORDEM das regras no DTO não muda o form",
      JSON.stringify(dtoParaForm(invertido)) === JSON.stringify(f),
      "o `find` é por tipo — o servidor não promete ordem",
    );
  }

  /* Regra AUSENTE cai no padrão, e o padrão de `purchase` é LIGADO. É a
     distinção ausência × zero: sem regra de Purchase, o pixel ainda envia. */
  {
    const semPurchase = { ...DTO, rules: DTO.rules.filter((r) => r.eventType !== "PURCHASE") };
    const g = dtoParaForm(semPurchase);
    ok("sem regra de `PURCHASE`, o form nasce LIGADO", g.purchase.enabled === true);
    ok("…e sem regra de `LEAD`, DESLIGADO", dtoParaForm({ ...DTO, rules: [] }).lead === false);
    ok(
      "os dois padrões são OPOSTOS de propósito",
      dtoParaForm({ ...DTO, rules: [] }).purchase.enabled !== dtoParaForm({ ...DTO, rules: [] }).lead,
      "`Purchase` é a razão de o pixel existir; `Lead` é opcional",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · O QUE NÃO VOLTA, E É CORRETO — asserção própria para cada
 *
 * ⛔ Sem isto, "o campo não voltou" e "o campo não devia voltar" seriam a mesma
 * observação, e a ida e volta da §1 teria de abrir exceção sem dizer por quê.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · o que NÃO volta, e por quê");

  const f = dtoParaForm(DTO);

  ok(
    "o `accessToken` volta VAZIO — o segredo não é re-exibido",
    f.metaPixels.every((m) => m.accessToken === ""),
    "a gaveta nunca mostra de novo um token já gravado",
  );
  ok(
    "…e no lugar dele vem `savedToken`, que diz se EXISTE um",
    f.metaPixels[0].savedToken === true && f.metaPixels[1].savedToken === false,
    "é o que permite a tela dizer `Já cadastrado — deixe em branco`",
  );
  ok(
    "o `nickname` nulo vira string vazia",
    f.metaPixels[1].nickname === "",
    "o campo do formulário é texto; `null` renderizaria `null`",
  );

  /* O preset não é transportado: ele é RECALCULADO a partir do form. */
  ok(
    "`temPixelNativo` e `outroEnviaPurchase` chegam do preset do DTO",
    f.temPixelNativo === true && f.outroEnviaPurchase === true,
  );
  ok(
    "mas o preset que vai ao servidor é RECALCULADO do form",
    JSON.stringify(formParaInput(f).preset) === JSON.stringify(presetDoForm(f)),
    "não é o `px.preset` transportado — o form é a fonte",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · O META PIXEL SEM ID É DESCARTADO NA IDA, não na volta
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · a linha em branco do meta pixel");

  const comVazio = { ...DTO, metaPixels: [...DTO.metaPixels, { pixelId: "  ", nickname: "", hasToken: false }] };
  const f = dtoParaForm(comVazio);

  ok(
    "`dtoParaForm` PRESERVA a linha em branco",
    f.metaPixels.length === 3,
    "ela é uma linha do formulário, e some se o form a apagar",
  );
  ok(
    "e `formParaInput` é quem a DESCARTA",
    formParaInput(f).metaPixels.length === 2,
    "o servidor não recebe pixel sem id",
  );
  ok(
    "…sem mexer nos que têm id",
    formParaInput(f).metaPixels.map((m) => m.pixelId).join(",") === "111,222",
  );
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 1 DTO cheio × 1 vazio · " + Object.keys(DTO.eventOwners).length + " donos · " + DTO.rules.length + " regras\n");
