/**
 * A assinatura dos detectores pega o snippet defasado?
 *
 * ## O que este teste protege
 *
 * A divergência que custa dinheiro é MUDA: regra ligada na gaveta + script velho
 * no site = nenhum evento, e nada denuncia. A assinatura é o que a torna
 * visível — então ela tem de:
 *
 * 1. **mudar** quando qualquer detector muda (senão diz "igual" para snippets
 *    que já não são, e o diagnóstico vira teatro);
 * 2. **não mudar** por diferença cosmética (senão avisa sem motivo, e um aviso
 *    que às vezes mente treina o usuário a ignorar todos);
 * 3. **distinguir as duas direções** — perder evento em silêncio não é a mesma
 *    coisa que mandar evento a mais e ser recusado.
 *
 * Também exercita o script GERADO: a assinatura tem de chegar ao snippet e ao
 * payload. Uma assinatura correta que não viaja é o 7º caso do PROCEDIMENTO.
 *
 *   npm run test:detectores
 */
import {
  assinaturaDetectores,
  avisoDeVersao,
  diferencasDeDetectores,
  lerAssinatura,
} from "@/lib/pixel/detectores";
import { donosDoPreset, lerPreset, seguePreset } from "@/lib/pixel/preset";
import { pixelScript } from "@/lib/pixel/script";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${a}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${a}\n      esperado: ${b}`);
  }
}
function verdade(nome, cond, detalhe = "") {
  if (cond) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

const DONOS_PADRAO = donosDoPreset({ temPixelNativo: true });
const BASE = { lead: false, addToCart: false, ic: null, icValor: null, nativo: true, donos: DONOS_PADRAO };
const a = (d) => assinaturaDetectores({ ...BASE, ...d });

// ───────────────────────── 1. A assinatura MUDA ─────────────────────────

console.log("\n\x1b[1m1. Todo detector entra na assinatura\x1b[0m\n");

verdade("ligar o Lead muda", a({}) !== a({ lead: true }), `${a({})} → ${a({ lead: true })}`);
verdade("ligar o AddToCart muda", a({}) !== a({ addToCart: true }));
verdade("ligar o IC muda", a({}) !== a({ ic: "clique_checkout" }));
verdade(
  "trocar o TIPO da regra de IC muda",
  a({ ic: "clique_checkout" }) !== a({ ic: "contem_texto" }),
);
verdade(
  "trocar o VALOR da regra de IC muda",
  a({ ic: "contem_texto", icValor: "COMPRAR AGORA" }) !==
    a({ ic: "contem_texto", icValor: "COMPRE JA" }),
);
eq("a mesma configuração dá a mesma assinatura", a({ lead: true }), a({ lead: true }));

// 🔴 Os dois campos da v2. Eles são ASSADOS no snippet e a v1 não os cobria —
// mudar qualquer um sem reinstalar gerava script defasado que o aviso não pegava.
verdade("trocar o pixel nativo muda", a({}) !== a({ nativo: false }));
verdade(
  "trocar o DONO de um evento muda",
  a({}) !== a({ donos: { ...DONOS_PADRAO, PageView: "traffik" } }),
);
verdade(
  "trocar o dono de OUTRO evento também muda",
  a({}) !== a({ donos: { ...DONOS_PADRAO, Purchase: "gateway" } }),
);

// ───────────────────── 2. A assinatura NÃO muda à toa ─────────────────────

console.log("\n\x1b[1m2. Diferença cosmética não vira alarme falso\x1b[0m\n");

eq(
  "espaço em volta das vírgulas dos domínios",
  a({ ic: "clique_checkout", icValor: "pay.kirvano.com, hotmart" }),
  a({ ic: "clique_checkout", icValor: "pay.kirvano.com,hotmart" }),
);
eq(
  "maiúsculas nos domínios (o script já compara em minúsculas)",
  a({ ic: "clique_checkout", icValor: "PAY.Kirvano.com" }),
  a({ ic: "clique_checkout", icValor: "pay.kirvano.com" }),
);
eq(
  "valor irrelevante quando o IC está desligado",
  a({ ic: null, icValor: "sobra de um valor antigo" }),
  a({ ic: null, icValor: null }),
);
// ⚠️ CSS é sensível a maiúsculas: `.btnCheckout` ≠ `.btncheckout`. Normalizar
// aqui esconderia uma mudança que quebra a detecção de verdade.
verdade(
  "seletor CSS NÃO é normalizado para minúsculas",
  a({ ic: "contem_css", icValor: ".btnCheckout" }) !== a({ ic: "contem_css", icValor: ".btncheckout" }),
);

// ───────────────────── 3. As duas direções, com textos diferentes ─────────

console.log("\n\x1b[1m3. A direção silenciosa é dita como silenciosa\x1b[0m\n");

const ligadoAqui = diferencasDeDetectores(a({ lead: false }), a({ lead: true }));
eq("regra ligada + script velho: uma frase", ligadoAqui.length, 1);
verdade(
  "e ela diz que NENHUM evento chega",
  /nenhum evento chega/i.test(ligadoAqui[0]),
  ligadoAqui[0],
);

const ligadoLa = diferencasDeDetectores(a({ lead: true }), a({ lead: false }));
verdade(
  "regra desligada + script antigo: diz que são recusados",
  /recusados/i.test(ligadoLa[0]),
  ligadoLa[0],
);

eq("assinaturas iguais → nenhuma divergência", diferencasDeDetectores(a({ lead: true }), a({ lead: true })), []);

const doisDetectores = diferencasDeDetectores(a({}), a({ lead: true, addToCart: true }));
eq("dois detectores divergentes → duas frases", doisDetectores.length, 2);

const tipoIc = diferencasDeDetectores(
  a({ ic: "contem_texto", icValor: "X" }),
  a({ ic: "clique_checkout", icValor: "X" }),
);
verdade("troca de tipo de IC é nomeada nas duas pontas", /clique no link/.test(tipoIc[0]) && /contém texto/.test(tipoIc[0]), tipoIc[0]);

const valorIc = diferencasDeDetectores(
  a({ ic: "contem_texto", icValor: "COMPRAR" }),
  a({ ic: "contem_texto", icValor: "COMPRE" }),
);
verdade("troca de valor é reportada como valor", /valor da regra/i.test(valorIc[0]), valorIc[0]);

// Snippet de uma versão futura/anterior que não sabemos ler.
const antigo = diferencasDeDetectores("formato-que-nao-existe", a({}));
eq("formato irreconhecível → uma frase, nunca silêncio", antigo.length, 1);
verdade("e ela fala em versão anterior", /vers/i.test(antigo[0]), antigo[0]);

const dono = diferencasDeDetectores(a({}), a({ donos: { ...DONOS_PADRAO, PageView: "traffik" } }));
verdade("troca de dono é reportada", /quem envia/i.test(dono[0]), dono[0]);

const semNativo = diferencasDeDetectores(a({ nativo: false }), a({ nativo: true }));
verdade(
  "script sem espelho + resposta 'tenho pixel' avisa da contagem em dobro",
  /dobro/i.test(semNativo[0]),
  semNativo[0],
);
const comNativo = diferencasDeDetectores(a({ nativo: true }), a({ nativo: false }));
verdade(
  "e o inverso avisa da espera inútil",
  /esperando/i.test(comNativo[0]),
  comNativo[0],
);

// ───────── 3b. Script v1: comparar SÓ o que ele sabe reportar ─────────

console.log("\n\x1b[1m3b. Script v1 não é acusado de divergir no que nunca soube reportar\x1b[0m\n");

// Assinatura v1 real, do formato antigo: 5 partes.
const v1 = (d = {}) => {
  const p = a(d).split(".");
  return ["v1", p[1], p[2], p[3], p[4]].join(".");
};

eq(
  "v1 com os detectores iguais → NENHUMA divergência",
  diferencasDeDetectores(v1(), a({})),
  [],
);
eq(
  "v1 não acusa divergência quando só os DONOS mudaram",
  diferencasDeDetectores(v1(), a({ donos: { ...DONOS_PADRAO, PageView: "traffik" } })),
  [],
);
eq(
  "mas v1 AINDA acusa o que ele sabe reportar",
  diferencasDeDetectores(v1(), a({ lead: true })).length,
  1,
);
verdade("v1 ganha nota de versão", Boolean(avisoDeVersao(v1())), String(avisoDeVersao(v1())).slice(0, 60));
eq("v2 não ganha nota nenhuma", avisoDeVersao(a({})), null);

// ───────────────────── 4. lerAssinatura ida e volta ─────────────────────

console.log("\n\x1b[1m4. A assinatura é legível de volta\x1b[0m\n");

const lida = lerAssinatura(a({ lead: true, addToCart: false, ic: "contem_css", icValor: ".x" }));
eq("lead", lida?.lead, true);
eq("addToCart", lida?.addToCart, false);
eq("ic", lida?.ic, "contem_css");
eq("nativo", lida?.nativo, true);
eq("ic desligado volta como null", lerAssinatura(a({}))?.ic, null);
eq("string qualquer → null", lerAssinatura("abc"), null);
// ⚠️ v1 continua LEGÍVEL: os campos que ela não tem voltam `null`, e é isso que
// permite comparar só a interseção em vez de acusar divergência inventada.
eq("v1 continua legível", lerAssinatura(v1())?.lead, false);
eq("v1: nativo é null, não false", lerAssinatura(v1())?.nativo, null);
eq("v1: hashDonos é null", lerAssinatura(v1())?.hashDonos, null);

// ───────── 4b. O preset ─────────

console.log("\n\x1b[1m4b. Uma resposta define o mapa de donos inteiro\x1b[0m\n");

eq("com pixel nativo, a visita é dele", donosDoPreset({ temPixelNativo: true }).PageView, "navegador");
eq("sem pixel nativo, a visita é nossa", donosDoPreset({ temPixelNativo: false }).PageView, "traffik");
eq(
  "os demais eventos são SEMPRE da Traffik",
  ["Lead", "AddToCart", "InitiateCheckout", "Purchase"].map((e) => donosDoPreset({ temPixelNativo: false })[e]),
  ["traffik", "traffik", "traffik", "traffik"],
);
// ⚠️ A inferência precisa reproduzir o comportamento em vigor para quem já tem
// pixel: `setup` nulo + donos no padrão → "tem pixel nativo".
eq("pixel antigo (setup nulo, donos vazios) infere TER pixel nativo", lerPreset(null, {}).temPixelNativo, true);
eq("setup gravado vence a inferência", lerPreset({ temPixelNativo: false }, {}).temPixelNativo, false);
eq(
  "quem trocou o PageView na mão infere NÃO ter",
  lerPreset(null, { PageView: "traffik" }).temPixelNativo,
  false,
);
eq("donos no padrão seguem o preset", seguePreset({ temPixelNativo: true }, {}), true);
eq(
  "dono ajustado à mão não segue",
  seguePreset({ temPixelNativo: true }, { Purchase: "gateway" }),
  false,
);

// ───────── 5. Ela CHEGA ao script gerado (o 7º caso do PROCEDIMENTO) ─────────

console.log("\n\x1b[1m5. A assinatura viaja no snippet e no payload\x1b[0m\n");

const cfg = {
  configId: "cfg_1",
  apiBase: "https://exemplo.com",
  lead: true,
  addToCart: false,
  initiateCheckout: { enabled: true, type: "contem_texto", value: "COMPRAR AGORA" },
};
const codigo = pixelScript(cfg);
const esperada = assinaturaDetectores({
  lead: true,
  addToCart: false,
  ic: "contem_texto",
  icValor: "COMPRAR AGORA",
  nativo: true,
  donos: DONOS_PADRAO,
});

verdade("o snippet declara a assinatura", codigo.includes(`var DET = "${esperada}"`), esperada);
verdade("e ela entra no payload de todo evento", /det:\s*DET/.test(codigo));
// `new Function` valida a sintaxe do template inteiro: uma aspa mal escapada na
// assinatura quebraria a página do cliente, não o nosso build.
verdade("o script gerado é sintaticamente válido", (() => { try { new Function(codigo); return true; } catch { return false; } })());

const semIc = pixelScript({ ...cfg, initiateCheckout: { enabled: false } });
verdade(
  "IC desligado gera assinatura diferente",
  !semIc.includes(`var DET = "${esperada}"`),
);

// 🔴 Sem pixel nativo, o script NÃO pode ficar esperando o `fbq`: seriam 10s de
// espera, um console.warn e um `sem-fbq` gravado em TODA visita — alarme
// vermelho numa instalação correta.
const semNativoJs = pixelScript({ ...cfg, temPixelNativo: false });
verdade("sem pixel nativo, o script declara NATIVO = false", semNativoJs.includes("var NATIVO = false"));
verdade("e devolve o estado neutro sem-nativo", semNativoJs.includes('return "sem-nativo"'));
verdade("com pixel nativo, NATIVO = true", codigo.includes("var NATIVO = true"));
verdade(
  "a resposta do preset muda a assinatura do script",
  !semNativoJs.includes(`var DET = "${esperada}"`),
);
verdade("o script sem nativo continua válido", (() => { try { new Function(semNativoJs); return true; } catch { return false; } })());

console.log(`\n\x1b[1m${ok} asserções, ${falhas} falha(s)\x1b[0m\n`);
process.exit(falhas === 0 ? 0 : 1);
