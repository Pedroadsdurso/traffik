/**
 * `actions/diagnostics.ts` — A TRIAGEM DOS ÓRFÃOS, POR CONSEQUÊNCIA.
 *
 * ## 🔴 POR QUE ISTO É UMA GUARDA, E NÃO UMA FAXINA
 *
 * A tela de **Integrações › Testes foi deletada** (911 linhas), e com ela foram
 * os consumidores de 12 server actions. O módulo sobreviveu porque outras 2
 * seguem em uso — e é por isso que a varredura de órfãos **por arquivo** nunca
 * os veria: o arquivo tem consumidor.
 *
 * O `07` registrou os 12 e não os deletou, com a razão certa: *a regra desta
 * base é perguntar o que o órfão FAZIA antes de apagá-lo*. Esta é essa
 * pergunta, respondida uma vez e congelada — para a próxima faxina não precisar
 * refazê-la, e para não chegar à resposta errada com pressa.
 *
 * > ## Órfão não é uma categoria. `grep` responde "alguém usa?"; só a leitura responde "o que isto FAZIA?" — e as duas respostas levam a decisões opostas.
 *
 * ## ⛔ O ACHADO QUE A TRIAGEM PRODUZIU, e ele vale mais que a limpeza
 *
 * `lib/pixel/ambiente.ts` declara uma propriedade de SEGURANÇA sobre o bloqueio
 * de host de teste:
 *
 * > *"Por isso a lista é REMOVÍVEL na tela. […] Uma regra de bloqueio que só
 * > saísse por SQL seria irreversível na prática — e **irreversível é
 * > exatamente o que ela não pode ser**."*
 *
 * Medido: `removerPadraoDeTeste` é o **único escritor de `User.testHostPatterns`
 * em toda a base**, e ele está órfão. A tela que o chamava não existe. Ou seja,
 * **a propriedade declarada já está violada** — e apagar a action a tornaria
 * permanente, com o módulo vizinho continuando a afirmar o contrário.
 *
 * ⚠️ É o `segredoInicial` outra vez: um símbolo que o lint aponta como órfão e
 * que não era código inerte — era **comportamento desalojado**. O sinal barato
 * também se repete: o nome é um VERBO.
 *
 *   npm run test:diagnosticos-orfaos
 */

import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";

let n = 0;
const falhas = [];
const ok = (nome, cond, extra) => {
  try {
    assert.ok(cond, nome + (extra ? " — " + extra : ""));
    console.log("  \x1b[32m✓\x1b[0m " + nome + (extra ? " — " + extra : ""));
    n++;
  } catch (e) {
    falhas.push(nome);
    console.log("  \x1b[31m✗\x1b[0m " + nome + "\n      " + e.message);
  }
};
const secao = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const ARQUIVO = "src/lib/actions/diagnostics.ts";
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
/** Apaga comentário PRESERVANDO as quebras — senão o número reportado não é o do arquivo. */
const semCom = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

const FONTE = ler(ARQUIVO);
const CODIGO = semCom(FONTE);

/* ═══════════════════════════════════════════════════════════════════════
 * A TRIAGEM — três classes, e a classe decide o que a deleção CUSTA
 *
 * ⛔ Ela não é opinião sobre importância: cada linha responde *"se isto sumir,
 * o que o produto perde e quem descobre?"*. As três respostas são diferentes o
 * bastante para a decisão ser outra em cada uma.
 * ═════════════════════════════════════════════════════════════════════ */

/** Em uso hoje — deletar quebra tela existente, e o `tsc` acusa na hora. */
const VIVOS = {
  listWebhookLogs: ["VisaoGeralScreen", "WebhooksScreen"],
  getPendenciasDaArea: ["BannerPendencias"],
};

/**
 * 🔴 CLASSE A — REMÉDIO. Deletar viola propriedade declarada em OUTRO módulo.
 *
 * ⛔ Estas não são candidatas a faxina em hipótese nenhuma enquanto o texto do
 * `ambiente.ts` valer. Quem quiser removê-las remove primeiro a REGRA que as
 * exige — e essa é decisão de produto, não de limpeza.
 */
const REMEDIO = {
  removerPadraoDeTeste:
    "único escritor de `User.testHostPatterns`; sem ele o bloqueio da CAPI vira irreversível — o que `ambiente.ts` diz que ele não pode ser",
  listarPadroesDeTeste: "sem ela não há como saber QUAIS padrões bloqueiam antes de remover",
};

/**
 * ⚠️ CLASSE B — VIGILÂNCIA. Respondem *"isto ainda está funcionando?"*, e a
 * falha que elas veem é MUDA: o painel responde, o dado está lá, e o que morre
 * é o que acontece sem ninguém olhar.
 *
 * Deletar não quebra nada hoje — e é exatamente esse o problema.
 */
const VIGILANCIA = {
  getRotinasAgendadas: "as CINCO rotinas agendadas; agendador parado não tem sintoma imediato",
  resumoEfeitos: "os 3 efeitos pós-venda rodavam com `console.error` e mais nada",
  resumoEspelhos: "o espelho no `fbq` — a dívida nº 0/1, cujo detector já ficou congelado sem aviso",
  getInstallChecklist: "configuração POR ÁREA; um checklist global diria \"tudo certo\" para área recém-criada",
};

/**
 * ⚪ CLASSE C — FERRAMENTA DE APOIO. Ajudam a diagnosticar sob demanda, não
 * vigiam nada sozinhas, e a ausência delas é sentida na hora por quem for usar.
 * São as únicas cuja deleção custa só o trabalho de reescrever.
 */
const APOIO = {
  analyzeTrackingUrl: "interpreta uma URL com UTMs como o webhook faria",
  listTestablePixels: "lista os pixels testáveis para o disparo de teste",
  testarPayloadDeGateway: "valida integração ANTES de ter conta no gateway",
  listarGatewaysDoTestador: "os gateways com exemplo embutido",
  carregarExemploDeGateway: "o JSON de exemplo de cada gateway",
  getPendenciasDasAreas: "o PLURAL do `getPendenciasDaArea`, que tem consumidor",
};

const CLASSIFICADAS = { ...VIVOS, ...REMEDIO, ...VIGILANCIA, ...APOIO };

console.log("\n\x1b[1m`actions/diagnostics.ts` — a triagem dos órfãos\x1b[0m");

/* ═══ 1 · O DENOMINADOR — sem ele "0 órfãos novos" não é auditável ════════ */
secao("1 · O denominador — quantas actions existem, e quantas foram examinadas");
const ACTIONS = [...CODIGO.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
{
  ok("1 · linha de base: o arquivo foi lido e é `\"use server\"`", FONTE.startsWith('"use server"') && FONTE.length > 5000, FONTE.length + " chars");
  ok("1 · …e as actions foram encontradas", ACTIONS.length >= 10, ACTIONS.length + " actions exportadas");

  /* ⛔ EXAUSTIVIDADE NOS DOIS SENTIDOS. Sem a segunda metade, acrescentar uma
     action passaria calada — e ela nasceria fora da triagem, que é o estado do
     qual estas 12 acabaram de sair. */
  const naoClassificadas = ACTIONS.filter((a) => !(a in CLASSIFICADAS));
  ok(
    "1 · ⛔ TODA action está classificada",
    naoClassificadas.length === 0,
    naoClassificadas.length ? "classifique: " + naoClassificadas.join(", ") : ACTIONS.length + " de " + ACTIONS.length,
  );
  const sumidas = Object.keys(CLASSIFICADAS).filter((a) => !ACTIONS.includes(a));
  ok(
    "1 · ⛔ …e toda action classificada EXISTE — deletar uma reprova nomeando",
    sumidas.length === 0,
    sumidas.length ? "sumiram: " + sumidas.join(", ") : "nenhuma sumiu",
  );
}

/* ═══ 2 · A MEDIÇÃO DE CONSUMO — lida, nunca copiada ══════════════════════ */
secao("2 · Quem consome o quê — medido no repositório, não transcrito");
{
  /* ⛔ A VARREDURA É SÓ EM `src/`, e o motivo é um erro que ela cometeu na
     primeira execução: ela contou **este arquivo** como consumidor das doze —
     ele cita os doze nomes, porque é a triagem deles — e reportou "religadas".

     É *a medição não acertou o alvo* em estado puro: o instrumento funcionou,
     a saída foi plausível ("12 religadas"), e ele estava apontado para a
     categoria errada. **Citação em teste não é consumo**: o que decide se uma
     action está órfã é existir chamador de PRODUÇÃO.

     ⚠️ Por isso o `scripts/` é medido à parte, logo abaixo, em vez de
     simplesmente excluído — excluir esconderia a distinção; medir os dois lados
     a torna a informação. */
  const FONTES = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/") && f !== ARQUIVO);
  const TEXTO = new Map(FONTES.map((f) => [f, semCom(ler(f))]));
  const consumidores = (sim) =>
    [...TEXTO].filter(([, s]) => new RegExp("\\b" + sim + "\\b").test(s)).map(([f]) => f);

  ok("2 · linha de base: há PRODUÇÃO para varrer (`src/`, sem o próprio arquivo)", FONTES.length > 200, FONTES.length + " arquivos");

  for (const [nome, telas] of Object.entries(VIVOS)) {
    const c = consumidores(nome);
    ok(
      `2 · \`${nome}\` está VIVA (${telas.join(", ")})`,
      c.length > 0,
      c.map((f) => f.split("/").pop()).join(" · ") || "⛔ perdeu o consumidor",
    );
  }

  /* ⚠️ A afirmação "está órfã" é MEDIDA a cada execução. Copiar a lista de
     órfãos para dentro do teste faria dela uma segunda fonte, e no dia em que
     alguém religasse uma action o teste continuaria chamando-a de órfã. */
  const orfas = [...Object.keys(REMEDIO), ...Object.keys(VIGILANCIA), ...Object.keys(APOIO)];
  const religadas = orfas.filter((a) => consumidores(a).length > 0);
  ok(
    "2 · as 12 triadas seguem SEM consumidor — medido agora, não transcrito",
    religadas.length === 0,
    religadas.length
      ? "✅ religada(s), tire da triagem: " + religadas.map((a) => a + " ← " + consumidores(a).join(",")).join(" · ")
      : orfas.length + " órfãs de " + ACTIONS.length + " actions",
  );
  ok(
    "2 · …e o denominador da triagem fecha",
    orfas.length + Object.keys(VIVOS).length === ACTIONS.length,
    `${Object.keys(VIVOS).length} vivas + ${orfas.length} órfãs = ${ACTIONS.length}`,
  );

  /* ⚠️ O OUTRO LADO, medido em vez de excluído: nenhuma das doze tem sequer
     asserção. Não é o mesmo que estar órfã — é a diferença entre *"ninguém
     chama"* e *"ninguém confere"*, e as duas juntas dizem quanto custaria
     religar qualquer uma delas. */
  const EM_TESTE = globSync("scripts/**/*.mjs")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.endsWith("teste-diagnosticos-orfaos.mjs"));
  const textoTeste = EM_TESTE.map((f) => semCom(ler(f))).join("\n");
  const testadas = orfas.filter((a) => new RegExp("\\b" + a + "\\b").test(textoTeste));
  ok(
    "2 · ⚠️ e nenhuma das 12 tem asserção — \"ninguém chama\" ≠ \"ninguém confere\"",
    testadas.length === 0,
    testadas.length ? "com teste: " + testadas.join(", ") : `0 de ${orfas.length}, em ${EM_TESTE.length} scripts`,
  );
}

/* ═══ 3 · 🔴 A CLASSE A — e a propriedade que ela sustenta ════════════════

   ⛔ ESTA SEÇÃO É A RAZÃO DE O ARQUIVO EXISTIR. As outras organizam; esta
   impede um dano concreto.

   `ambiente.ts` afirma que a lista de padrões aprovados é REMOVÍVEL porque
   bloquear é irreversível — o evento não vai para a CAPI e não volta. A action
   que remove está órfã, e é o único escritor da coluna. Apagá-la converteria
   "irreversível na prática" em "irreversível, ponto".                        */
secao("3 · 🔴 Classe A — o remédio, e a propriedade declarada que o exige");
{
  const AMB = ler("src/lib/pixel/ambiente.ts");
  ok("3 · linha de base: `ambiente.ts` foi lido", AMB.length > 3000, AMB.length + " chars");
  ok(
    "3 · ele DECLARA que bloquear é irreversível — é isto que exige o remédio",
    /irrevers[ií]vel/i.test(AMB) && /n[aã]o pode ser/i.test(AMB),
    "a regra amplia o alcance do bloqueio; sem remoção, ela não tem volta",
  );

  for (const [nome, porque] of Object.entries(REMEDIO)) {
    ok(`3 · ⛔ \`${nome}\` NÃO pode ser deletada`, CODIGO.includes(`export async function ${nome}`), porque);
  }

  /* ⛔ O ÚNICO ESCRITOR — medido, e é o que separa "órfã" de "insubstituível". */
  const ESCRITORES = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/"))
    .filter((f) => /data:\s*\{[^}]*testHostPatterns/s.test(semCom(ler(f))));
  ok(
    "3 · 🔑 e ela é o ÚNICO escritor de `User.testHostPatterns` na base",
    ESCRITORES.length === 1 && ESCRITORES[0] === ARQUIVO,
    ESCRITORES.join(" · ") || "⛔ nenhum escritor — a remoção sumiu",
  );
}

/* ═══ 4 · ⚠️ O REQUISITO ESTÁ VIOLADO HOJE — e a asserção é o AVISO ═══════

   ⛔ Esta asserção CONGELA UM ESTADO RUIM de propósito, e a saída está escrita
   nela: no dia em que uma tela voltar a chamar `removerPadraoDeTeste`, ela
   REPROVA — e a mensagem diz o que fazer. É o oposto do §2 do
   `test:format-mensagem`, que congelava o `NaN` sem dizer como sair.          */
secao("4 · ⚠️ O requisito está VIOLADO hoje — congelado com a saída escrita");
{
  const ROTAS = globSync("src/app/**/page.tsx").map((f) => f.replace(/\\/g, "/"));
  const temTestes = ROTAS.some((f) => /integracoes\/testes\/page\.tsx$/.test(f));
  ok(
    "4 · MEDIDO: a rota `integracoes/testes` não existe mais",
    !temTestes,
    "a tela foi deletada; as server actions dela não",
  );
  ok(
    "4 · ⚠️ …logo NÃO HÁ como remover um padrão pelo produto — só por script/SQL",
    true,
    "`ambiente.ts` diz que isto é exatamente o que a regra não pode ser",
  );
  ok(
    "4 · ⛔ e o comentário do `ambiente.ts` NÃO afirma mais uma tela que não existe",
    !/Integra[çc][õo]es\s*›\s*Testes lista os padr[õo]es/.test(ler("src/lib/pixel/ambiente.ts")),
    "afirmação que mudou é APAGADA, não mantida ao lado do que vale hoje",
  );
}

/* ═══ 5 · AS CLASSES B e C — o que a próxima faxina precisa saber ═════════ */
secao("5 · Classes B e C — a decisão que sobra, com o custo de cada uma");
{
  for (const [nome, porque] of Object.entries(VIGILANCIA)) {
    ok(`5 · ⚠️ \`${nome}\` — vigilância`, CODIGO.includes(`export async function ${nome}`), porque);
  }
  ok(
    "5 · ⚪ as 6 de APOIO existem, e são as únicas cuja deleção custa só reescrever",
    Object.keys(APOIO).every((a) => CODIGO.includes(`export async function ${a}`)),
    Object.keys(APOIO).join(" · "),
  );

  /* ⚠️ E o eixo que o registro anterior não mediu: `"use server"` faz de cada
     export um ENDPOINT. Órfã não quer dizer inalcançável — quer dizer sem
     chamador NA TELA. É argumento a favor de deletar as de APOIO, e não muda
     nada para a classe A. */
  const semGuarda = ACTIONS.filter((a) => {
    const i = CODIGO.indexOf(`export async function ${a}`);
    const j = CODIGO.indexOf("\nexport ", i + 1);
    const corpo = CODIGO.slice(i, j === -1 ? undefined : j);
    return !/requireUserId\(\)/.test(corpo) && !/getPendenciasDaArea\(/.test(corpo);
  });
  ok(
    "5 · 🔑 toda action — órfã ou não — exige sessão: `\"use server\"` é ENDPOINT",
    semGuarda.length === 0,
    semGuarda.length ? "SEM guarda: " + semGuarda.join(", ") : ACTIONS.length + " de " + ACTIONS.length,
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log(`   denominador: ${ACTIONS.length} actions · ${Object.keys(VIVOS).length} vivas · 2 remédio · 4 vigilância · 6 apoio`);
console.log("   \x1b[33m⚠️  NENHUMA deletada. A classe A não pode ser; B e C são decisão do dono.\x1b[0m\n");
