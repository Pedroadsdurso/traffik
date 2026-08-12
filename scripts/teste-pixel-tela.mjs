/**
 * A TELA DE PIXEL & EVENTOS ENTREGA ARTEFATO — e aqui a restrição é DUPLA.
 *
 * > ### 🔴 AS DUAS METADES MEDEM COISAS DIFERENTES, E UMA NÃO COBRE A OUTRA
 * >
 * > | # | O que precisa ser verdade | Modo de falha |
 * > |---|---|---|
 * > | 1 | trocar de **PIXEL** troca o CONTEÚDO do script | script de outro pixel, com o `configId` errado dentro |
 * > | 2 | trocar de **ÁREA** troca a LISTA de pixels alcançáveis | script **correto**, de um pixel de outra operação |
 * >
 * > A 2 é a cara: o arquivo passa em qualquer conferência, porque ele é
 * > exatamente o que a ferramenta deveria gerar — só que para outra operação. O
 * > usuário instala o pixel da operação A na página da B, tudo funciona, e quem
 * > denuncia é o Gerenciador de Eventos da **Meta**, semanas depois.
 * >
 * > Um `grep` pelo id da área dentro do script responde à 1 e é **cego** para a
 * > 2 — ali o id da área não está no artefato, por desenho (medido em
 * > 11/08/2026: `grep -cE 'var WS|workspaceId'` em `lib/pixel/script.ts` → 0).
 *
 * ## ⚠️ A fixture da 2 precisa de TRÊS pixels
 *
 * `escopoDeConfig` **não é simétrico**: a Principal é catch-all (`OR [id, NULL]`)
 * e a secundária é estrita. Com um pixel só, "trocar de área muda a lista" passa
 * sem exercer o recorte. São três: um da área A, um da B e um **órfão**.
 *
 * Puro: sem banco, sem rede, sem DOM. ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:pixel-tela
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { scriptDoPixel } = await import("../src/lib/pixel/script.ts");
const { whereDaArea } = await import("../src/lib/areas/escopoWhere.ts");
const {
  JANELAS,
  JANELA_PADRAO,
  TEXTO_DO_VAZIO,
  eventoValido,
  inicioDaJanela,
  janelaValida,
  motivoDoVazio,
  seloDeAmbiente,
} = await import("../src/lib/pixel/eventos.ts");

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
  new URL("../src/components/dashboard/views/pixel/PixelScreen.tsx", import.meta.url),
  "utf8",
);

/* ═══════════════════ 1 · Trocar de PIXEL troca o CONTEÚDO ═══════════════════ */

console.log("\n\x1b[1m🔴 Trocar de PIXEL troca o ARTEFATO\x1b[0m");

const configDe = (id) => ({
  id,
  eventOwners: {},
  preset: { temPixelNativo: true, outroEnviaPurchase: false, ondeSePaga: "gateway" },
  rules: [
    { eventType: "LEAD", enabled: false, detectionType: null, detectionValue: null },
    { eventType: "ADD_TO_CART", enabled: false, detectionType: null, detectionValue: null },
    {
      eventType: "INITIATE_CHECKOUT",
      enabled: true,
      detectionType: "clique_checkout",
      detectionValue: null,
    },
  ],
});

const scriptA = scriptDoPixel(configDe("px-AAA"), "https://app.exemplo.com");
const scriptB = scriptDoPixel(configDe("px-BBB"), "https://app.exemplo.com");

checar("linha de base: o script existe e tem corpo", () => {
  // Sem isto, todas as comparações abaixo passariam com duas strings vazias.
  assert.ok(scriptA.length > 500, `script curto demais: ${scriptA.length}`);
});

checar("🔴 o script de A carrega o CONFIG de A, e o de B o de B", () => {
  assert.ok(scriptA.includes('var CONFIG = "px-AAA"'), "o id de A não está no script de A");
  assert.ok(scriptB.includes('var CONFIG = "px-BBB"'), "o id de B não está no script de B");
});

checar("🔴 os dois são DIFERENTES, e nenhum vaza o id do outro", () => {
  assert.notEqual(scriptA, scriptB, "o pixel não mudou nada no artefato");
  assert.ok(!scriptA.includes("px-BBB"), "o script de A vazou o pixel B");
  assert.ok(!scriptB.includes("px-AAA"), "o script de B vazou o pixel A");
});

checar("provado pelo lado negativo: o MESMO pixel produz o MESMO script", () => {
  // Se a diferença acima viesse de outra coisa (data, aleatório), esta cairia —
  // e aí a de cima não estaria medindo o pixel.
  assert.equal(scriptDoPixel(configDe("px-AAA"), "https://app.exemplo.com"), scriptA);
});

/* ═══════════════════ 2 · Trocar de ÁREA troca a LISTA ═══════════════════════ */

console.log("\n\x1b[1m🔴 Trocar de ÁREA troca a LISTA de pixels alcançáveis\x1b[0m");

/**
 * Os três pixels que a assimetria exige. Com menos de três, a asserção abaixo
 * passa sem exercer recorte nenhum.
 */
const PIXELS = [
  { id: "px-A", workspaceId: "ws-A" },
  { id: "px-B", workspaceId: "ws-B" },
  { id: "px-orfao", workspaceId: null },
];

/**
 * Aplica o `where` que `whereDaArea` produziu.
 *
 * ⚠️ **O limite está escrito:** isto entende as DUAS formas que aquela função
 * pode devolver, e nada além. Ele prova que o recorte PEDIDO ao banco muda com a
 * área e que a Principal é catch-all — não prova o que o Postgres devolve.
 */
function alcançaveis(where) {
  if ("OR" in where) {
    const permitidos = where.OR.map((o) => o.workspaceId);
    return PIXELS.filter((p) => permitidos.includes(p.workspaceId)).map((p) => p.id);
  }
  return PIXELS.filter((p) => p.workspaceId === where.workspaceId).map((p) => p.id);
}

const naPrincipal = alcançaveis(whereDaArea("ws-A", true));
const naSecundaria = alcançaveis(whereDaArea("ws-B", false));

checar("linha de base: há mais de um dono na fixture", () => {
  // `=== 0` passa com a coleção vazia; "listas diferentes" passa com um pixel só.
  assert.equal(new Set(PIXELS.map((p) => p.workspaceId)).size, 3, "a fixture não tem três donos");
});

checar("🔴 a lista da área B NÃO contém o pixel da área A", () => {
  assert.deepEqual(naSecundaria, ["px-B"]);
});

checar("🔴 e a troca REMOVE, não só acrescenta — nos dois sentidos", () => {
  // O sentido que engana: `B → Principal` só CRESCE, e uma asserção de tamanho
  // passaria. O que importa é que cada lista perde o que era da outra.
  assert.ok(!naPrincipal.includes("px-B"), "a Principal alcançou o pixel da área B");
  assert.ok(!naSecundaria.includes("px-orfao"), "a área B alcançou o pixel órfão");
});

checar("a Principal é catch-all: leva o órfão junto, e a secundária não", () => {
  assert.deepEqual(naPrincipal, ["px-A", "px-orfao"]);
});

console.log("\n\x1b[1mA guarda estática do caminho — o elo que o efeito não cobre\x1b[0m");

checar("🔴 `listPixels` é chamado COM a área, nunca sem argumento", () => {
  assert.ok(TELA.includes("listPixels(workspaceId)"), "não chama com a área");
  assert.ok(!/listPixels\(\s*\)/.test(TELA), "há uma chamada sem argumento");
});

checar("🔴 o efeito que busca tem `workspaceId` nas DEPS — não `[]`", () => {
  /* ⛔ A ÂNCORA É SINTAXE, NÃO A PALAVRA. A primeira versão desta guarda ancorou
     em `listPixels(workspaceId)` e casou com o **cabeçalho do arquivo**, que cita
     a chamada para explicar por que ela precisa da área — e daí em diante achou a
     lista de deps do efeito ERRADO (o dos eventos). Quarta vez nesta base que uma
     guarda por texto mede prosa. O que só o código tem é o `Promise.all([`. */
  const i = TELA.indexOf("Promise.all([listPixels(workspaceId)");
  assert.ok(i > 0, "não achei a CHAMADA (só a prosa, se tanto)");
  const deps = /\}\s*,\s*\[([^\]]*)\]\s*\)/.exec(TELA.slice(i));
  assert.ok(deps, "não achei a lista de dependências do efeito");
  assert.ok(deps[1].includes("workspaceId"), `deps são [${deps[1]}]`);
});

checar("a carga é carimbada com a área — não há booleano paralelo de carregamento", () => {
  assert.ok(TELA.includes("carga.ws === workspaceId"), "sumiu o carimbo da área na carga");
  /* ⚠️ A guarda mira a DECLARAÇÃO, não a palavra: um arquivo que documenta por
     que um símbolo não existe CONTÉM o nome dele. Foi assim que a versão
     anterior desta guarda, no `test:utm-tela`, reprovou por causa de um
     comentário. */
  assert.ok(
    !/const\s*\[\s*carregando\s*,/.test(TELA),
    "voltou um estado de carregamento separado, que pode discordar do carimbo",
  );
  assert.ok(/const daAreaAtual = /.test(TELA), "o derivado sumiu");
});

checar("🔴 o pixel NASCE na área ativa — `createPixel` leva o `workspaceId`", () => {
  // Sem isto o pixel novo cairia na Principal, e o usuário o veria numa área que
  // não é a que ele estava usando.
  assert.ok(/createPixel\(\{ \.\.\.input, workspaceId \}\)/.test(TELA), "createPixel sem a área");
});

/* ═══════════════════ 3 · A janela, que é o que não AGRAVA a dívida ══════════ */

console.log("\n\x1b[1mA janela é do servidor, e recusa o que não está na lista\x1b[0m");

checar("linha de base: a lista de janelas existe e tem mais de uma opção", () => {
  assert.ok(JANELAS.length >= 2, `só ${JANELAS.length} janela(s)`);
  assert.ok(JANELAS.some((j) => j.dias === JANELA_PADRAO), "o padrão não está na lista");
});

checar("🔴 valor fora da lista cai no PADRÃO — não vira janela infinita", () => {
  // O caso que importa: um cliente que mande `janelaDias: 100000` não pode
  // transformar a listagem numa varredura da tabela inteira.
  assert.equal(janelaValida(100000), JANELA_PADRAO);
  assert.equal(janelaValida(0), JANELA_PADRAO);
  assert.equal(janelaValida(-7), JANELA_PADRAO);
  assert.equal(janelaValida("7"), JANELA_PADRAO, "string não é a mesma coisa que número");
  assert.equal(janelaValida(undefined), JANELA_PADRAO);
});

checar("e o valor VÁLIDO passa — a guarda não bloqueia o caso bom", () => {
  for (const j of JANELAS) assert.equal(janelaValida(j.dias), j.dias);
});

checar("a janela é um INSTANTE, não um dia de calendário", () => {
  // Nenhuma agregação usa o dia do processo. "Últimos 7 dias" aqui é
  // `agora − 7 × 24h`, e por isso não passa por fuso nenhum.
  const agora = new Date("2026-08-11T03:00:00.000Z");
  assert.equal(inicioDaJanela(7, agora).toISOString(), "2026-08-04T03:00:00.000Z");
  assert.equal(inicioDaJanela(1, agora).toISOString(), "2026-08-10T03:00:00.000Z");
});

checar("o filtro de tipo só aceita evento do vocabulário", () => {
  assert.equal(eventoValido("Purchase"), "Purchase");
  assert.equal(eventoValido("purchase"), null, "aceitou caixa diferente");
  assert.equal(eventoValido("'; drop table"), null);
  assert.equal(eventoValido(null), null);
});

/* ═══════════════════ 4 · Ausência de observação ≠ observação de zero ════════ */

console.log("\n\x1b[1m🕳️ A lista vazia tem TRÊS causas, e elas pedem ações opostas\x1b[0m");

checar("com linhas, não há estado vazio nenhum", () => {
  assert.equal(motivoDoVazio({ linhas: 3, houveAlgumDia: true, filtrado: false }), null);
});

checar("🔴 nunca chegou nada VENCE as outras duas", () => {
  // Mandar ampliar o período um pixel que nunca recebeu evento é mandar procurar
  // onde não há o que achar — e some a única causa que pede ação de instalação.
  assert.equal(motivoDoVazio({ linhas: 0, houveAlgumDia: false, filtrado: true }), "sem-nenhum");
  assert.equal(motivoDoVazio({ linhas: 0, houveAlgumDia: false, filtrado: false }), "sem-nenhum");
});

checar("já houve evento: o filtro e o período são causas DIFERENTES", () => {
  assert.equal(motivoDoVazio({ linhas: 0, houveAlgumDia: true, filtrado: true }), "filtro");
  assert.equal(motivoDoVazio({ linhas: 0, houveAlgumDia: true, filtrado: false }), "fora-da-janela");
});

checar("🔴 os três textos são DIFERENTES entre si", () => {
  // Três causas com a mesma frase é o mesmo que uma causa só — e foi assim que
  // "nenhum resultado encontrado" mandou gente reinstalar script que já estava
  // instalado.
  const titulos = Object.values(TEXTO_DO_VAZIO).map((t) => t.titulo);
  assert.equal(new Set(titulos).size, 3, `títulos repetidos: ${titulos.join(" | ")}`);
  const causas = Object.values(TEXTO_DO_VAZIO).map((t) => t.causa);
  assert.equal(new Set(causas).size, 3);
});

checar("⚠️ `sem-nenhum` NÃO afirma que o script está quebrado", () => {
  // As três causas são indistinguíveis daqui. Escolher a mais provável seria
  // afirmar o que não se mediu — a mesma regra do `sem-dados` do diagnóstico.
  const t = TEXTO_DO_VAZIO["sem-nenhum"].causa;
  assert.ok(/não instalad/i.test(t) && /erro/i.test(t) && /visitas/i.test(t), t);
});

checar("o selo de ambiente só existe quando NÃO é produção", () => {
  // Nulo é "produção, ou não sabemos". Um selo "produção" em toda linha
  // afirmaria o que a coluna não garante.
  assert.equal(seloDeAmbiente(null), null);
  assert.equal(seloDeAmbiente("preview"), "prévia");
  assert.equal(seloDeAmbiente("local"), "local");
  // Valor desconhecido aparece cru, em vez de sumir.
  assert.equal(seloDeAmbiente("marte"), "marte");
});

/* ═══════════════════ 5 · O que a tela NÃO pode pintar de verde ══════════════ */

console.log("\n\x1b[1m⛔ `sem-dados` nunca é `ok`\x1b[0m");

checar("🔴 o selo de `sem-dados` não é `success`", () => {
  const bloco = TELA.slice(TELA.indexOf("SELO_DO_DIAGNOSTICO"), TELA.indexOf("TOM_DO_ESPELHO"));
  const semDados = bloco.slice(bloco.indexOf('"sem-dados"'));
  const tom = /tom:\s*"(\w+)"/.exec(semDados);
  assert.ok(tom, "não achei o tom do `sem-dados`");
  assert.notEqual(tom[1], "success", "`sem-dados` está pintado como sucesso");
  // Linha de base: existe um estado que É success, senão a asserção passaria
  // num arquivo que não pinta nada de verde.
  assert.ok(/rotulo: "conferido",\s*tom: "success"/.test(bloco), "nenhum estado é success");
});

checar("🔴 o carimbo de tempo passa por `<Desde>`, nunca por `elapsed()` cru", () => {
  // `elapsed()` lê `Date.now()`; num componente que passa pelo servidor os dois
  // lados divergem e o React aborta a hidratação da árvore inteira.
  assert.ok(TELA.includes("<Desde quando="), "não usa o componente");
  assert.ok(!/\belapsed\s*\(/.test(TELA), "há uma chamada crua a elapsed()");
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas verdes\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
