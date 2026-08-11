/**
 * O PRESET DO PIXEL — a proteção contra a Meta contar conversão em dobro.
 *
 * > ### 🔴 O QUE ESTE ARQUIVO EXISTE PARA PROVAR
 * >
 * >   **Responder a pergunta muda o DONO e o ESPELHO juntos, e não existe
 * >   caminho que mude um sem o outro.**
 * >
 * > Os dois lados vivem em lugares diferentes e são lidos por sistemas
 * > diferentes:
 * >
 * > | Lado | Onde mora | Quem lê |
 * > |---|---|---|
 * > | dono do evento | `PixelConfig.eventOwners` | o SERVIDOR, ao vivo |
 * > | espelho no `fbq` | `setup.temPixelNativo` → `var NATIVO` | o NAVEGADOR, ASSADO no snippet |
 * >
 * > Separados, divergem. E a divergência não dá erro: dá conversão contada duas
 * > vezes, com alguém otimizando campanha em cima por semanas.
 *
 * ## Por que a asserção olha o SCRIPT, e não o campo
 *
 * Comparar `form.temPixelNativo` com `form.donos` provaria só que dois campos do
 * mesmo objeto concordam — o que é quase uma tautologia. O que importa é que o
 * **artefato instalado no site** muda junto com o que o servidor vai decidir.
 * Por isso o lado do espelho é lido do texto que `scriptDoPixel` gera.
 *
 * Puro: sem banco, sem rede, sem DOM.
 *
 *   npm run test:pixel-preset
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  FORM_VAZIO,
  responderPreset,
  responderOndePaga,
  formParaInput,
  presetDoForm,
  problemasDoForm,
  ondePaga,
  regraManual,
} = await import("../src/lib/pixel/formulario.ts");
const { donosDoPreset, lerPreset, seguePreset, REGRA_DE_CHECKOUT } = await import(
  "../src/lib/pixel/preset.ts"
);
const { scriptDoPixel } = await import("../src/lib/pixel/script.ts");
const { EVENTOS_DO_PIXEL } = await import("../src/lib/pixel/donos.ts");

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

/** O script que ESTE formulário produziria, como o site do cliente o receberia. */
function scriptDe(form) {
  const input = formParaInput(form);
  return scriptDoPixel(
    {
      id: "px-teste",
      eventOwners: input.eventOwners,
      preset: input.preset,
      rules: [
        { eventType: "LEAD", enabled: input.lead, detectionType: null, detectionValue: null },
        { eventType: "ADD_TO_CART", enabled: input.addToCart, detectionType: null, detectionValue: null },
        {
          eventType: "INITIATE_CHECKOUT",
          enabled: input.initiateCheckout.enabled,
          detectionType: input.initiateCheckout.detectionType ?? null,
          detectionValue: input.initiateCheckout.detectionValue ?? null,
        },
      ],
    },
    "https://app.exemplo.com",
  );
}

/** O espelho, lido do artefato — não do campo. */
const espelhoDoScript = (s) => /var NATIVO = (true|false)/.exec(s)?.[1];
const alheiosDoScript = (s) => JSON.parse(/var ALHEIOS = (\[[^\]]*\])/.exec(s)?.[1] ?? "null");

console.log("\n\x1b[1m🔴 A resposta muda DONO e ESPELHO juntos\x1b[0m");

const comNativo = responderPreset(FORM_VAZIO, { temPixelNativo: true });
const semNativo = responderPreset(FORM_VAZIO, { temPixelNativo: false });

checar("linha de base: os dois formulários produzem script de verdade", () => {
  // Sem isto, tudo abaixo poderia comparar duas strings vazias.
  assert.ok(scriptDe(comNativo).length > 500);
  assert.ok(scriptDe(semNativo).length > 500);
});

checar("🔴 o DONO do PageView vira com a resposta", () => {
  assert.equal(comNativo.donos.PageView, "navegador");
  assert.equal(semNativo.donos.PageView, "traffik");
});

checar("🔴 o ESPELHO vira JUNTO — lido do script, não do campo", () => {
  assert.equal(espelhoDoScript(scriptDe(comNativo)), "true");
  assert.equal(espelhoDoScript(scriptDe(semNativo)), "false");
});

checar("🔴 e o ARTEFATO inteiro difere — não é só uma variável", () => {
  assert.notEqual(scriptDe(comNativo), scriptDe(semNativo));
});

checar("o par é coerente em TODAS as combinações do preset, não só nas duas", () => {
  let vistos = 0;
  for (const nativo of [true, false]) {
    for (const outro of [true, false]) {
      const f = responderPreset(responderPreset(FORM_VAZIO, { temPixelNativo: nativo }), {
        outroEnviaPurchase: outro,
      });
      const s = scriptDe(f);
      // dono e espelho contam a MESMA história sobre o pixel nativo
      assert.equal(espelhoDoScript(s), String(nativo), `nativo=${nativo} outro=${outro}`);
      assert.equal(f.donos.PageView, nativo ? "navegador" : "traffik");
      // e o Purchase responde à segunda pergunta, sozinho
      assert.equal(f.donos.Purchase, outro ? "gateway" : "traffik");
      vistos++;
    }
  }
  assert.equal(vistos, 4, "as quatro combinações precisam ter sido exercidas");
});

console.log("\n\x1b[1m⛔ Não existe caminho que mude UM sem o outro\x1b[0m");

checar("🔴 provado pelo lado negativo: mexer no campo À MÃO deixa o dono para trás", () => {
  /* Isto é o que o código FARIA se alguém escrevesse `setForm({...f,
     temPixelNativo: x})` num handler, em vez de chamar o redutor. A asserção
     documenta o estado errado para que ele seja reconhecível. */
  const naMao = { ...comNativo, temPixelNativo: false };
  assert.equal(naMao.donos.PageView, "navegador", "o dono ficou no valor antigo");
  assert.equal(espelhoDoScript(scriptDe(naMao)), "false", "e o espelho já mudou");
  // Ou seja: o par DIVERGIU. É exatamente o estado que o redutor impede.
  assert.notEqual(naMao.donos.PageView === "navegador", espelhoDoScript(scriptDe(naMao)) === "true");
});

checar("🔴 o redutor NÃO produz esse estado — em nenhum patch", () => {
  const patches = [
    { temPixelNativo: true },
    { temPixelNativo: false },
    { outroEnviaPurchase: true },
    { outroEnviaPurchase: false },
    { temPixelNativo: true, outroEnviaPurchase: true },
    { temPixelNativo: false, outroEnviaPurchase: false },
  ];
  for (const p of patches) {
    const f = responderPreset(FORM_VAZIO, p);
    const nativoNoScript = espelhoDoScript(scriptDe(f)) === "true";
    const donoDizNativo = f.donos.PageView === "navegador";
    assert.equal(nativoNoScript, donoDizNativo, `divergiu em ${JSON.stringify(p)}`);
  }
});

checar("a GAVETA só mexe no preset pelo redutor — guarda estática", () => {
  const gaveta = readFileSync(
    new URL("../src/components/dashboard/views/pixel/GavetaPixel.tsx", import.meta.url),
    "utf8",
  );
  /* ⚠️ A PRIMEIRA VERSÃO DESTA GUARDA REPROVOU O CÓDIGO CERTO.
     Ela proibia `temPixelNativo:\s*(true|false)` — e a chamada legítima
     `responderPreset(f, { temPixelNativo: true })` casa com isso. Mirar a
     sintaxe do ERRADO não basta quando o CERTO a contém.

     O que separa os dois é o contexto: toda atribuição precisa estar DENTRO de
     uma chamada ao redutor. Como isso é por linha no código real, a guarda
     verifica linha a linha — e reporta a linha ofensora, não só que existe. */
  const ofensoras = gaveta
    .split(/\r?\n/)
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /temPixelNativo\s*:/.test(l) && !/responderPreset\(/.test(l));
  assert.deepEqual(
    ofensoras,
    [],
    `atribuição de temPixelNativo fora do redutor: ${ofensoras.map(([n]) => `linha ${n}`).join(", ")}`,
  );
  // Linha de base ×2: houve o que examinar, e o redutor É usado. Sem elas, a
  // guarda passa num arquivo vazio e numa gaveta que não configura preset nenhum.
  assert.ok(/temPixelNativo\s*:/.test(gaveta), "nenhuma atribuição examinada");
  assert.ok(/responderPreset\(/.test(gaveta), "a gaveta não chama o redutor");
});

console.log("\n\x1b[1m🕳️ O trecho vazio: toda visita viraria checkout\x1b[0m");

checar("🔴 `contem_url` sem trecho é BARRADO antes de salvar", () => {
  const f = responderOndePaga({ ...FORM_VAZIO, name: "P", metaPixels: [{ pixelId: "1", accessToken: "", nickname: "" }] }, "proprio_site");
  assert.equal(f.ic.type, "contem_url");
  assert.equal(f.ic.value, "");
  const p = problemasDoForm(f);
  assert.ok(p.some((x) => x.includes("trecho da URL")), `problemas: ${p.join(" | ")}`);
});

checar("com o trecho preenchido ele passa — a guarda não bloqueia o caso bom", () => {
  const base = { ...FORM_VAZIO, name: "P", metaPixels: [{ pixelId: "1", accessToken: "", nickname: "" }] };
  const f = responderOndePaga(base, "proprio_site");
  const cheio = { ...f, ic: { ...f.ic, value: "/pagamento" } };
  assert.deepEqual(problemasDoForm(cheio), []);
});

checar("trocar a resposta LIMPA o valor — regra antiga não vaza para a nova", () => {
  const base = { ...FORM_VAZIO, ic: { enabled: true, type: "contem_url", value: "/pagamento" } };
  const volta = responderOndePaga(base, "gateway");
  assert.equal(volta.ic.type, REGRA_DE_CHECKOUT.gateway);
  assert.equal(volta.ic.value, "", "o trecho antigo sobreviveu à troca");
});

console.log("\n\x1b[1m🧭 `ondeSePaga` é DERIVADO, nunca um campo próprio\x1b[0m");

checar("o preset salvo lê a resposta da REGRA gravada", () => {
  const f = responderOndePaga(FORM_VAZIO, "proprio_site");
  assert.equal(presetDoForm(f).ondeSePaga, "proprio_site");
  assert.equal(formParaInput(f).preset.ondeSePaga, "proprio_site");
});

checar("os modos manuais do avançado não fingem uma resposta", () => {
  // `contem_texto` não é nenhuma das duas opções da pergunta.
  assert.equal(regraManual("contem_texto"), true);
  assert.equal(regraManual("contem_css"), true);
  assert.equal(regraManual("clique_checkout"), false);
  assert.equal(regraManual("contem_url"), false);
  // E caem em `gateway`, que é o que `clique_checkout` significa.
  assert.equal(ondePaga("contem_texto"), "gateway");
});

console.log("\n\x1b[1m🔁 Ida e volta: o que foi salvo volta igual\x1b[0m");

checar("`lerPreset` devolve o preset que `formParaInput` gravou", () => {
  for (const nativo of [true, false]) {
    for (const outro of [true, false]) {
      const f = responderPreset(responderPreset(FORM_VAZIO, { temPixelNativo: nativo }), {
        outroEnviaPurchase: outro,
      });
      const salvo = formParaInput(f);
      const lido = lerPreset(salvo.preset, salvo.eventOwners, salvo.initiateCheckout.detectionType);
      assert.equal(lido.temPixelNativo, nativo);
      assert.equal(lido.outroEnviaPurchase, outro);
    }
  }
});

checar("`seguePreset` reconhece o estado do redutor como PADRÃO", () => {
  const f = responderPreset(FORM_VAZIO, { temPixelNativo: false });
  assert.equal(seguePreset(presetDoForm(f), f.donos), true);
  // E reconhece o ajuste à mão — senão o selo e o `voltar ao padrão` nunca apareceriam.
  const mexido = { ...f, donos: { ...f.donos, Lead: "ninguem" } };
  assert.equal(seguePreset(presetDoForm(mexido), mexido.donos), false);
});

checar("todo evento do mapa tem dono — evento novo sem dono não passa", () => {
  const mapa = donosDoPreset(presetDoForm(FORM_VAZIO));
  for (const e of EVENTOS_DO_PIXEL) assert.ok(mapa[e], `sem dono: ${e}`);
  assert.equal(Object.keys(mapa).length, EVENTOS_DO_PIXEL.length);
});

console.log("\n\x1b[1m🪞 O espelho ignora evento de outro dono\x1b[0m");

checar("evento rebaixado entra em ALHEIOS, e o espelho o pula", () => {
  const f = responderPreset(FORM_VAZIO, { outroEnviaPurchase: true });
  const alheios = alheiosDoScript(scriptDe(f));
  assert.ok(Array.isArray(alheios), "não achei ALHEIOS no script");
  // Linha de base: com tudo da Trackhub a lista muda — senão o teste não mede nada.
  const todos = responderPreset(FORM_VAZIO, { outroEnviaPurchase: false, temPixelNativo: false });
  assert.notDeepEqual(alheios, alheiosDoScript(scriptDe(todos)));
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
