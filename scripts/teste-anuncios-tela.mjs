/**
 * INTEGRAÇÕES › ANÚNCIOS — a linguagem pura e a CONFERÊNCIA DE ESCRITA.
 *
 * ## 🔴 A CONFERÊNCIA DE ESCRITA É O QUE ESTE ARQUIVO EXISTE PARA FAZER
 *
 * A família *A TELA NOVA APRESENTA ESTADO QUE ELA NÃO CONSEGUE CRIAR* é a única
 * que nenhuma outra ferramenta desta base pega: o teste do cinza compara
 * ESTRUTURA, o `04` confere o que é EXIBIDO, e `tsc`/lint/build não perguntam
 * se existe caminho de escrita.
 *
 * > ## A regressão nasce assim: a leitura continua perfeita, o formulário perde um campo, e NADA denuncia.
 *
 * Com quatro acessores e uma view de 322 linhas deletada, era aqui que o `calc`
 * de Taxas nasceria de novo.
 *
 * ⛔ **A lista de ações é LIDA do arquivo da action, nunca copiada.** Uma lista
 * escrita aqui envelheceria no primeiro caminho novo — em silêncio, que é a
 * própria família que a guarda existe para fechar.
 *
 *   npm run test:anuncios-tela
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { frasedoRecorte, frasedoOculto, seloDoToken } = await import("../src/lib/facebook/apresentacao.ts");
const { DIAS_ATENCAO } = await import("../src/lib/integracoes/token.ts");

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

const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
/** Apaga comentário PRESERVANDO quebras — os arquivos CITAM os símbolos na prosa. */
const semCom = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

const TELA = ler("src/components/dashboard/views/anuncios/AnunciosScreen.tsx");
const TELA_COD = semCom(TELA);
const ACOES = semCom(ler("src/lib/actions/facebook.ts"));
const HOOK = semCom(ler("src/components/dashboard/useTraffikState.ts"));

console.log("\n\x1b[1mIntegrações › Anúncios — a vitrine de perfis\x1b[0m");

/* ═══ 1 · 🔑 A CONFERÊNCIA DE ESCRITA — a lista vem da ACTION ═════════════ */
secao("1 · 🔑 Todo caminho de ESCRITA da action tem quem o acione");
{
  /* As de escrita são as que NÃO são `list*`. A regra é do próprio arquivo:
     leitura lista, escrita muda. */
  const exportadas = [...ACOES.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
  const escrita = exportadas.filter((f) => !/^list/.test(f));

  ok("1 · linha de base: a action foi lida e tem exports", exportadas.length >= 4, exportadas.join(" · "));
  ok(
    "1 · linha de base: há caminhos de ESCRITA para conferir",
    escrita.length >= 3,
    escrita.join(" · ") + "  (as `list*` são leitura)",
  );

  /* ⛔ A cadeia é action → handler do hook → tela. Basta um elo faltar para o
     controle sumir com a leitura intacta — que é a regressão do `calc`. */
  const semChamador = escrita.filter((f) => !new RegExp("\\b" + f + "\\s*\\(").test(HOOK));
  ok(
    "1 · 🔑 TODA action de escrita é chamada pelo hook",
    semChamador.length === 0,
    semChamador.join(" · ") || `${escrita.length} de ${escrita.length}`,
  );
}

/* ═══ 2 · …E A TELA ACIONA CADA HANDLER ══════════════════════════════════

   O §1 prova que o hook chama a action. Isto prova o último elo: sem ele, o
   handler existe, a action existe, e o botão não está na tela.                */
secao("2 · E a TELA aciona cada handler — o elo que fecha a cadeia");
{
  const HANDLERS = [
    ["p.disconnect()", "desconectar o perfil"],
    ["p.setAllTracking()", "ligar/desligar todas as contas"],
    ["ac.toggleTracking()", "rastreamento de UMA conta"],
    ["ac.sync()", "sincronizar UMA conta"],
    ["p.toggleExpanded()", "expandir as contas do perfil"],
  ];
  ok("1 · linha de base: a tela foi lida", TELA.length > 4000, TELA.length + " chars");
  for (const [chamada, oQue] of HANDLERS) {
    ok(`2 · a tela aciona \`${chamada}\` (${oQue})`, TELA_COD.includes(chamada), "sem isto o controle some e a leitura fica intacta");
  }
}

/* ═══ 3 · 🔑 O SELO DO TOKEN VEM DE `token.ts`, e é FONTE ÚNICA ══════════

   ⛔ Uma segunda implementação faria a tela discordar do alerta do Dashboard
   sobre o MESMO token, e o `DIAS_ATENCAO` divergiria no primeiro ajuste.      */
secao("3 · O selo do token — fonte única, e `desconhecido` é PERIGO");
{
  const APRES = semCom(ler("src/lib/facebook/apresentacao.ts"));
  ok(
    "3 · 🔑 `apresentacao.ts` IMPORTA de `integracoes/token`",
    /from "@\/lib\/integracoes\/token"/.test(APRES),
    "é o mesmo módulo que alimenta o alerta do Dashboard e a Saúde da Visão geral",
  );
  ok(
    "3 · ⛔ e não reimplementa o limiar",
    !/\b(30|DIAS_ATENCAO\s*=)\s*;/.test(APRES.replace(/import[^;]+;/g, "")),
    `o limiar é ${DIAS_ATENCAO}, e vem de lá`,
  );

  const vencido = seloDoToken(new Date(Date.now() - 5 * 864e5));
  const proximo = seloDoToken(new Date(Date.now() + 3 * 864e5));
  const longe = seloDoToken(new Date(Date.now() + 400 * 864e5));
  const nulo = seloDoToken(null);

  ok("3 · token vencido é `perigo` e pede ação", vencido.tom === "perigo" && vencido.pedeAcao, vencido.rotulo);
  ok("3 · expirando é `atencao` e pede ação", proximo.tom === "atencao" && proximo.pedeAcao, proximo.rotulo);
  ok("3 · válido e longe é `ok` e NÃO pede ação", longe.tom === "ok" && !longe.pedeAcao, longe.rotulo);

  /* 🔴 A ASSERÇÃO QUE MAIS IMPORTA: `desconhecido` é PERIGO, não atenção.
     São os perfis conectados antes de a coluna existir — os mais antigos, logo
     os mais prováveis de já estarem vencidos. Amarelo diria "provavelmente
     está bem", e não sabemos. */
  ok(
    "3 · 🔴 `data desconhecida` é PERIGO, não atenção",
    nulo.tom === "perigo" && nulo.pedeAcao,
    nulo.rotulo + " — 'não sabemos' ≠ 'está tudo bem'",
  );
  ok("3 · …e explica por que reconectar", /vencido|reconecte/i.test(nulo.detalhe ?? ""), nulo.detalhe);

  ok(
    "3 · a TELA usa o selo, e ele fica junto do NOME",
    /seloDoToken\(/.test(TELA_COD) && TELA_COD.indexOf("seloDoToken(") < TELA_COD.indexOf("Reconectar"),
    "o selo é o gatilho do botão: sem ele a ação principal existe sem o motivo",
  );
}

/* ═══ 4 · O RECORTE DECLARADO — e o `N de M` só aparece quando há recorte ═ */
secao("4 · `N de M contas nesta área` — e o silêncio quando não há o que dizer");
{
  ok("4 · com recorte, a frase existe", frasedoRecorte(3, 8) === "3 de 8 contas nesta área", frasedoRecorte(3, 8));
  ok(
    "4 · ⛔ SEM recorte, a frase NÃO aparece",
    frasedoRecorte(8, 8) === null && frasedoRecorte(1, 1) === null,
    "'8 de 8' é ruído que se aprende a ignorar, e aí o '3 de 8' chega no meio de dez iguais",
  );
  ok("4 · singular quando o total é 1", frasedoRecorte(0, 1) === "0 de 1 conta nesta área", frasedoRecorte(0, 1));

  ok(
    "4 · 🔴 o aviso dos perfis OCULTOS existe",
    frasedoOculto(2, 5) === "3 perfis conectados não têm conta nesta área e não aparecem aqui.",
    frasedoOculto(2, 5),
  );
  ok("4 · …com singular", /^1 perfil conectado/.test(frasedoOculto(2, 3) ?? ""), frasedoOculto(2, 3));
  ok(
    "4 · ⛔ e ele SOME quando não há oculto — ausente ≠ inexistente",
    frasedoOculto(5, 5) === null && frasedoOculto(5, 4) === null,
    "alarme sem motivo envenena o único sinal que existe",
  );
  ok("4 · a tela usa as duas frases", /frasedoRecorte\(/.test(TELA_COD) && /frasedoOculto\(/.test(TELA_COD));
}

/* ═══ 5 · ⛔ `contasNoTotal` NO SELECT — a armadilha do `pedidoId` ════════

   Fora do `select`, o campo chega `undefined`, `frasedoRecorte` compara com
   `undefined` e devolve `null` — a frase some, e a tela fica MUDA com ar de
   "não há recorte". `tsc` e lint passam.                                     */
secao("5 · O denominador chega do banco — senão a frase some em silêncio");
{
  const PERFIS = semCom(ler("src/lib/facebook/perfis.ts"));
  ok(
    "5 · o `_count` das contas está no `include`",
    /_count:\s*\{\s*select:\s*\{\s*adAccounts:\s*true/.test(PERFIS),
    "é o TOTAL, sem o recorte — e é subquery, não custa ida ao banco",
  );
  ok("5 · …e vira `contasNoTotal` no DTO", /contasNoTotal:\s*p\._count\.adAccounts/.test(PERFIS));
  ok(
    "5 · …e o hook repassa para a tela",
    /contasNoTotal:\s*p\.contasNoTotal/.test(HOOK),
    "sem este elo o campo morre no DTO",
  );
  ok(
    "5 · 🔴 e o `ocultos` NÃO custa consulta extra",
    /profiles\.length - visiveis\.length/.test(PERFIS),
    "sai da mesma consulta que já carregava todos os perfis",
  );
}

/* ═══ 6 · ⛔ A MICROCÓPIA DOS ERROS SOBREVIVEU VERBATIM ══════════════════

   Ela codifica ERRO PAGO, como a da gaveta do Pixel. Encurtar qualquer uma
   devolve o bug — esta base já pagou por isso duas vezes.                     */
secao("6 · ⛔ A microcópia dos erros veio VERBATIM da view deletada");
{
  const FRASES = [
    ["Não sincroniza — mesmo motivo do aviso acima.", "evita 6 blocos idênticos quando a causa é uma só"],
    ["tentativa seguida sem sucesso", "separa 'falhou agora' de 'falha há dias'"],
    ["desligue o rastreamento para parar de tentar", "a saída, para quem não quer mais tentar"],
    ["a primeira sincronização demora mais", "evita que a espera pareça travamento"],
  ];
  for (const [frase, porque] of FRASES) {
    ok(`6 · "${frase.slice(0, 42)}…"`, TELA_COD.includes(frase), porque);
  }
  ok(
    "6 · ⛔ o contador CALA em erro temporário",
    /!ac\.erroSync\.temporario/.test(TELA_COD),
    "rate limit passa sozinho, e o número assustaria à toa",
  );
  ok(
    "6 · ⛔ e o erro do PERFIL não vira bloco em cada conta",
    /ac\.mesmoErroDoPerfil/.test(TELA_COD),
    "com 5 contas e um token sem permissão eram 6 blocos idênticos",
  );
}

/* ═══ 7 · A CONFIRMAÇÃO NOMEIA O QUE **NÃO** SE PERDE ═══════════════════ */
secao("7 · Desconectar — a confirmação diz as duas metades");
{
  ok(
    "7 · ela nomeia o que PARA",
    /sincroniza[çc][ãa]o com a Meta/i.test(TELA),
    "sem isto o usuário não sabe o que está desligando",
  );
  ok(
    "7 · 🔑 …e o que CONTINUA — a metade que faz ele conseguir clicar",
    /continuam no hist[óo]rico/i.test(TELA),
    "sem ela o usuário supõe o pior e não desconecta nunca",
  );
}

/* ═══ 8 · A GRADE USA `auto-fit` — a inconsistência medida ═══════════════ */
secao("8 · A grade dos cards");
{
  ok(
    "8 · `auto-fit`, não `auto-fill`",
    /repeat\(auto-fit,\s*minmax\(/.test(TELA_COD) && !/auto-fill/.test(TELA_COD),
    "com `auto-fill` poucos cards não esticam e sobram trilhas vazias",
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: as actions de escrita LIDAS do arquivo + os 5 handlers da tela\n");
