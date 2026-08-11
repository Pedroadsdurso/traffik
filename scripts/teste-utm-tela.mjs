/**
 * A TELA DE UTM & SNIPPETS ENTREGA ARTEFATO — e artefato da área errada é
 * instalação permanente errada na página de outra pessoa.
 *
 * > ### 🔴 A PERGUNTA NÃO É "a prop existe?"
 * >
 * > Uma asserção sobre a presença de `workspaceId` passaria com o valor sendo
 * > ignorado lá dentro. O que precisa ser verdade é o EFEITO:
 * >
 * >   **duas áreas diferentes produzem dois scripts diferentes, e cada um
 * >   carrega a sua.**
 * >
 * > Ela cai sozinha se alguém parar de repassar a área, sem que ninguém tenha
 * > previsto o valor novo — e passa por qualquer refatoração que preserve o
 * > comportamento.
 *
 * ## E uma guarda ESTÁTICA, porque o efeito sozinho não cobre o caminho
 *
 * A corrente completa é: prop muda → `useEffect` refaz a busca → DTO novo →
 * script novo. As asserções de efeito cobrem os dois últimos elos. O primeiro só
 * a leitura do arquivo cobre — a assinatura do defeito registrada no `CLAUDE.md`
 * é justamente **`useEffect` com deps `[]`**, e ela não muda nenhum valor
 * observável até alguém trocar de área na tela de verdade.
 *
 * ⚠️ O limite está escrito: a guarda pega `getUtmCodes()` sem argumento e o
 * `[workspaceId]` ausente das deps. Ela não pega alguém que passe uma variável
 * de nome diferente que por acaso seja a área errada.
 *
 * ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:utm-tela
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { montarInventario, rotuloUsadoEm } = await import("../src/lib/utm/inventario.ts");
const { armazemUtm } = await import("../src/lib/utm/armazem.ts");

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

const TELA = readFileSync(
  new URL("../src/components/dashboard/views/utm/UtmSnippetsScreen.tsx", import.meta.url),
  "utf8",
);

/** Um DTO de códigos como o `getUtmCodes` devolve, para a área pedida. */
function codigosDe(ws, extra = {}) {
  return {
    accountId: "conta-1",
    separator: "_abc123_",
    workspaceId: ws,
    workspaceName: `Área ${ws}`,
    ehPrincipal: false,
    cliquesComArea: 0,
    cliquesSemArea: 0,
    hotmart: `utm_source=FB&xcod=FB_abc123_x`,
    cartpanda: `utm_source=FB&cid=conta-1`,
    outros: `utm_source=FB`,
    ...extra,
  };
}

const PIXEL = {
  id: "px-1",
  name: "Pixel principal",
  enabled: true,
  metaPixels: [{ id: "m1", pixelId: "111", nickname: null, hasToken: true }],
  rules: [
    { eventType: "LEAD", enabled: true, detectionType: null, detectionValue: null },
    { eventType: "INITIATE_CHECKOUT", enabled: true, detectionType: "clique_checkout", detectionValue: null },
  ],
  eventOwners: {},
  preset: { temPixelNativo: true },
};

const inventarioDe = (ws) =>
  montarInventario({
    codigos: codigosDe(ws),
    pixels: [PIXEL],
    apiBase: "https://app.exemplo.com",
    urlBackRedirect: "",
  });

console.log("\n\x1b[1m🔴 Trocar de área troca o ARTEFATO\x1b[0m");

const invA = inventarioDe("ws-AAA");
const invB = inventarioDe("ws-BBB");
const rastA = invA.find((s) => s.id === "utm-rastreamento");
const rastB = invB.find((s) => s.id === "utm-rastreamento");

checar("linha de base: o snippet de rastreamento existe e tem código", () => {
  // Sem isto, todas as comparações abaixo passariam com dois vazios.
  assert.ok(rastA, "o snippet de rastreamento sumiu do inventário");
  assert.ok(rastA.codigo.length > 200, `código curto demais: ${rastA.codigo.length}`);
});

checar("o script da área A carrega o WS de A, e o de B o de B", () => {
  assert.ok(rastA.codigo.includes('var WS = "ws-AAA"'), "o WS de A não está no script de A");
  assert.ok(rastB.codigo.includes('var WS = "ws-BBB"'), "o WS de B não está no script de B");
});

checar("🔴 os dois scripts são DIFERENTES — o de A não serve para B", () => {
  assert.notEqual(rastA.codigo, rastB.codigo, "a área não mudou nada no artefato");
  assert.ok(!rastA.codigo.includes("ws-BBB"), "o script de A vazou a área B");
  assert.ok(!rastB.codigo.includes("ws-AAA"), "o script de B vazou a área A");
});

checar("provado pelo lado negativo: a MESMA área produz o MESMO script", () => {
  // Se a diferença acima viesse de qualquer outra coisa (data, aleatório), esta
  // asserção cairia — e aí a de cima não estaria medindo a área.
  assert.equal(inventarioDe("ws-AAA").find((s) => s.id === "utm-rastreamento").codigo, rastA.codigo);
});

checar("o snippet por área está MARCADO como tal, e os outros não", () => {
  assert.equal(rastA.porArea, true);
  const porArea = invA.filter((s) => s.porArea).map((s) => s.id);
  assert.deepEqual(porArea, ["utm-rastreamento"], `marcados: ${porArea.join(", ")}`);
});

console.log("\n\x1b[1mA guarda estática do caminho — o elo que o efeito não cobre\x1b[0m");

checar("🔴 `getUtmCodes` é chamado COM a área, nunca sem argumento", () => {
  assert.ok(TELA.includes("getUtmCodes(workspaceId)"), "não chama com a área");
  assert.ok(!/getUtmCodes\(\s*\)/.test(TELA), "há uma chamada sem argumento");
});

checar("🔴 `listPixels` também é escopado pela área", () => {
  assert.ok(TELA.includes("listPixels(workspaceId)"));
  assert.ok(!/listPixels\(\s*\)/.test(TELA), "há uma chamada sem argumento");
});

checar("🔴 o efeito que busca tem `workspaceId` nas DEPS — não `[]`", () => {
  // A assinatura do defeito registrada no CLAUDE.md é exatamente deps `[]`.
  const efeito = TELA.slice(TELA.indexOf("getUtmCodes(workspaceId)"));
  const deps = /\}\s*,\s*\[([^\]]*)\]\s*\)/.exec(efeito);
  assert.ok(deps, "não achei a lista de dependências do efeito");
  assert.ok(deps[1].includes("workspaceId"), `deps são [${deps[1]}]`);
});

checar("a carga é carimbada com a área — não há booleano paralelo de carregamento", () => {
  assert.ok(TELA.includes("carga.ws === workspaceId"), "sumiu o carimbo da área na carga");
  /* ⚠️ A guarda mira a DECLARAÇÃO, não a palavra: a primeira versão dela usava
     `/setCarregando/` e reprovou pelo comentário do próprio arquivo, que cita o
     nome para explicar por que ele não existe. Guarda por casamento de texto
     precisa mirar sintaxe, senão ela mede prosa. */
  assert.ok(
    !/const\s*\[\s*carregando\s*,/.test(TELA),
    "voltou um estado de carregamento separado, que pode discordar do carimbo",
  );
  // Linha de base: o `carregando` derivado continua existindo e sendo usado.
  assert.ok(/const carregando = !daAreaAtual;/.test(TELA), "o derivado sumiu");
});

console.log("\n\x1b[1mO toggle só existe onde há coluna E ação\x1b[0m");

checar("pixel é `ligavel`; os de UTM e de anúncio são `instalacao`", () => {
  const porTipo = {};
  for (const s of invA) (porTipo[s.estado.tipo] ??= []).push(s.id);
  assert.deepEqual(porTipo.ligavel, ["pixel-px-1"], `ligáveis: ${porTipo.ligavel?.join(", ")}`);
  // Linha de base: existe mais de um `instalacao`, senão a separação não foi exercida.
  assert.ok(porTipo.instalacao.length >= 4, `só ${porTipo.instalacao.length} de instalação`);
});

checar("🔴 o toggle é desenhado SÓ para `ligavel`", () => {
  assert.ok(
    TELA.includes('s.estado.tipo === "ligavel" && ('),
    "o toggle deixou de ser condicionado ao estado ligável",
  );
});

checar("o selo de instalação segue `cliquesComArea`, medido", () => {
  const sem = montarInventario({
    codigos: codigosDe("ws-A", { cliquesComArea: 0 }),
    pixels: [],
    apiBase: "https://app.exemplo.com",
    urlBackRedirect: "",
  });
  const com = montarInventario({
    codigos: codigosDe("ws-A", { cliquesComArea: 12 }),
    pixels: [],
    apiBase: "https://app.exemplo.com",
    urlBackRedirect: "",
  });
  assert.equal(sem[0].estado.detectado, false);
  assert.equal(com[0].estado.detectado, true);
});

console.log("\n\x1b[1m`usado em`: não medido ≠ zero\x1b[0m");

checar("🔴 o script de UTM devolve `—`, não `0 contas`", () => {
  assert.equal(rastA.usadoEm, null);
  assert.equal(rotuloUsadoEm(rastA), "—");
});

checar("o pixel devolve o número que EXISTE, com o nome do que ele conta", () => {
  const px = invA.find((s) => s.id === "pixel-px-1");
  assert.equal(px.usadoEm, 1);
  assert.equal(rotuloUsadoEm(px), "1 pixel da Meta");
});

console.log("\n\x1b[1mO back redirect sem endereço não finge estar pronto\x1b[0m");

checar("sem URL o código sai VAZIO — a tela mostra estado vazio, não um script inerte", () => {
  const s = invA.find((x) => x.id === "utm-back-redirect");
  assert.equal(s.codigo, "");
});

checar("com URL ele passa a existir e carrega o destino", () => {
  const inv = montarInventario({
    codigos: codigosDe("ws-A"),
    pixels: [],
    apiBase: "https://app.exemplo.com",
    urlBackRedirect: "https://exemplo.com/oferta",
  });
  const s = inv.find((x) => x.id === "utm-back-redirect");
  assert.ok(s.codigo.includes("https://exemplo.com/oferta"), s.codigo.slice(0, 120));
});

console.log("\n\x1b[1mO armazém declara que NÃO guarda — e a tela deriva a frase\x1b[0m");

checar("`persiste` é false enquanto não houver tabela", () => {
  assert.equal(armazemUtm.persiste, false);
});

checar("🔴 a frase do aviso DERIVA de `persiste`, não é escrita solta", () => {
  assert.ok(
    TELA.includes("if (armazemUtm.persiste) return null;"),
    "o aviso deixou de ser condicionado ao armazém",
  );
  assert.ok(TELA.includes("ainda não são guardados"), "o texto do limite sumiu");
});

checar("salvar e ler funciona DENTRO da sessão, e o guarda de texto vale aqui também", () => {
  const m = armazemUtm.salvarModelo("Facebook — Lançamento", {
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: { nao: "é texto" },
  });
  assert.ok(m, "não salvou");
  assert.deepEqual(m.campos, { utm_source: "facebook", utm_medium: "cpc" });
  assert.ok(armazemUtm.listarModelos().some((x) => x.id === m.id));
  armazemUtm.removerModelo(m.id);
  assert.ok(!armazemUtm.listarModelos().some((x) => x.id === m.id));
});

checar("modelo sem nome ou sem campo útil não é criado", () => {
  assert.equal(armazemUtm.salvarModelo("   ", { utm_source: "fb" }), null);
  assert.equal(armazemUtm.salvarModelo("Vazio", { utm_source: "  " }), null);
});

checar("o histórico não repete a mesma URL em sequência", () => {
  const antes = armazemUtm.listarHistorico().length;
  const e = { url: "https://x.com/?utm_source=fb", source: "fb", medium: null, campanha: null };
  armazemUtm.registrarNoHistorico(e);
  armazemUtm.registrarNoHistorico(e);
  assert.equal(armazemUtm.listarHistorico().length, antes + 1);
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas passando\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
