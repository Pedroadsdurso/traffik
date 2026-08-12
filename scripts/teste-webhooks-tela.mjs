/**
 * A TELA DE WEBHOOKS ENTREGA O ARTEFATO MAIS CARO DA FERRAMENTA.
 *
 * > ### 🔴 QUEM COLA A URL É UMA TERCEIRA PARTE QUE A GENTE NÃO VÊ
 * >
 * > O painel do gateway do cliente. Uma URL da área errada **não dá erro em
 * > lugar nenhum**: ela aceita o payload, responde 200 e credita a venda na
 * > operação errada. Não há log, não há alerta, não há 4xx — o sintoma aparece
 * > como *venda faltando numa área* e *venda a mais em outra*, dois números
 * > plausíveis em telas diferentes, sem nada que os ligue.
 *
 * ## AS DUAS METADES, e uma NÃO cobre a outra
 *
 * | # | O que precisa ser verdade | Modo de falha |
 * |---|---|---|
 * | 1 | trocar de **WEBHOOK** troca o TOKEN dentro da URL | endereço de outro webhook |
 * | 2 | trocar de **ÁREA** troca a LISTA alcançável | endereço **válido**, de outra operação |
 *
 * Um `grep` pelo token dentro da URL responde à 1 e é **cego** para a 2 — ali o
 * id da área não está no artefato, por desenho.
 *
 * ## ⚠️ A fixture da 2 precisa de TRÊS webhooks
 *
 * `whereDaArea` **não é simétrico**: a Principal é catch-all (`OR [id, NULL]`) e
 * a secundária é estrita. Com um webhook só, "trocar de área muda a lista" passa
 * sem exercer o recorte — indo de uma secundária para a Principal a lista só
 * CRESCE, e no sentido inverso ela pode não perder nada se não houver órfão.
 *
 * Puro: sem banco, sem rede, sem DOM. ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:webhooks-tela
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { gatewayDoWebhook, REGISTRO } = await import("../src/lib/gateways/registro.ts");
const { whereDaArea } = await import("../src/lib/areas/escopoWhere.ts");
const {
  DESFECHO_DA_ENTREGA,
  DIAS_INATIVA,
  TEXTO_DO_VAZIO,
  diasSemEvento,
  estadoDoWebhook,
  motivoDoVazio,
} = await import("../src/lib/webhooks/estado.ts");

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

/**
 * ⛔ AS QUEBRAS SÃO NORMALIZADAS NA LEITURA — e isso não é higiene, é a
 * armadilha número um deste repositório.
 *
 * **402 arquivos versionados estão em CRLF**, e a árvore de trabalho continua
 * assim de propósito (o `.gitattributes` não muda isso). Todo padrão multilinha
 * ancorado em `\n` falha nesses arquivos — e falha **em silêncio**, devolvendo
 * "não achei" com a mesma cara de "está tudo certo".
 *
 * Foi o que aconteceu aqui: as âncoras de `.then` abaixo não casavam, e só a
 * asserção de LINHA DE BASE ("a chamada existe no código") transformou o
 * silêncio em falha nomeada.
 */
const ler = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const TELA = ler("../src/components/dashboard/views/webhooks/WebhooksScreen.tsx");
const GAVETA = ler("../src/components/dashboard/views/webhooks/GavetaWebhook.tsx");

const BASE = "https://app.exemplo.test";

/* ══════════ 1 · Trocar de WEBHOOK troca o TOKEN dentro da URL ══════════ */

console.log("\n\x1b[1m1 · o CONTEÚDO do endereço\x1b[0m");

const urlDe = (platform, token) => gatewayDoWebhook(platform).urlDoWebhook(token, BASE);

checar("🔴 dois webhooks do MESMO gateway produzem endereços diferentes", () => {
  const a = urlDe("KIRVANO", "tok-aaa");
  const b = urlDe("KIRVANO", "tok-bbb");
  assert.notEqual(a, b, "o token não muda o endereço");
  assert.ok(a.includes("tok-aaa"), a);
  assert.ok(b.includes("tok-bbb"), b);
});

checar("controle negativo: o MESMO token produz o MESMO endereço", () => {
  /* Sem isto, a asserção acima passaria com uma função que devolvesse algo
     aleatório a cada chamada — e o endereço da tela mudaria a cada render. */
  assert.equal(urlDe("KIRVANO", "tok-aaa"), urlDe("KIRVANO", "tok-aaa"));
});

checar("🔴 o endereço de um webhook NUNCA contém o token de outro", () => {
  const a = urlDe("KIRVANO", "tok-aaa");
  assert.ok(!a.includes("tok-bbb"), a);
});

checar("as DUAS formas de URL existem, e são diferentes entre si", () => {
  /* A Kirvano tem rota própria por motivo histórico (a URL já está colada no
     painel do gateway); gateway novo cai no caminho universal. Se as duas
     colapsarem numa só, alguém "unificou" e quebrou toda instalação existente. */
  const kirvano = urlDe("KIRVANO", "tok-x");
  const universal = urlDe("CAKTO", "tok-x");
  assert.ok(kirvano.includes("/api/webhook/kirvano?id=tok-x"), kirvano);
  assert.ok(universal.includes("/api/webhook/sale/tok-x"), universal);
  assert.notEqual(kirvano, universal);
});

checar("todo gateway ATIVO do registro sabe montar um endereço com o token", () => {
  const ativos = Object.values(REGISTRO).filter((g) => g.ativo);
  assert.ok(ativos.length >= 2, `linha de base: só ${ativos.length} gateway ativo`);
  for (const g of ativos) {
    const u = g.urlDoWebhook("tok-zzz", BASE);
    assert.ok(u.startsWith(BASE), `${g.id}: não usa a base — ${u}`);
    assert.ok(u.includes("tok-zzz"), `${g.id}: o token não aparece na URL — ${u}`);
  }
});

/* ══════════ 2 · Trocar de ÁREA troca a LISTA alcançável ══════════ */

console.log("\n\x1b[1m2 · o CONTEXTO — quais webhooks a área alcança\x1b[0m");

/**
 * ⛔ TRÊS, e o terceiro é ÓRFÃO. Ver o cabeçalho: com menos, a asserção passa
 * sem exercer o recorte.
 */
const WEBHOOKS = [
  { id: "wh-A", workspaceId: "ws-A", token: "tok-A" },
  { id: "wh-B", workspaceId: "ws-B", token: "tok-B" },
  { id: "wh-orfao", workspaceId: null, token: "tok-orfao" },
];

/**
 * Aplica o `where` que `whereDaArea` produziu.
 *
 * ⚠️ **O limite está escrito:** isto entende as DUAS formas que aquela função
 * pode devolver, e nada além. Prova que o recorte PEDIDO ao banco muda com a
 * área e que a Principal é catch-all — não prova o que o Postgres devolve.
 */
function alcancaveis(where) {
  if ("OR" in where) {
    const permitidos = where.OR.map((o) => o.workspaceId);
    return WEBHOOKS.filter((w) => permitidos.includes(w.workspaceId)).map((w) => w.id);
  }
  return WEBHOOKS.filter((w) => w.workspaceId === where.workspaceId).map((w) => w.id);
}

const naPrincipal = alcancaveis(whereDaArea("ws-A", true));
const naSecundaria = alcancaveis(whereDaArea("ws-B", false));

checar("linha de base: a fixture tem TRÊS donos distintos", () => {
  /* `=== 0` passa com a coleção vazia, e "as listas diferem" passa com um
     webhook só. Esta asserção existe para que as de baixo tenham o que medir. */
  assert.equal(new Set(WEBHOOKS.map((w) => w.workspaceId)).size, 3);
  assert.ok(WEBHOOKS.some((w) => w.workspaceId === null), "falta o órfão");
});

checar("🔴 a área B NÃO alcança o webhook da área A", () => {
  assert.deepEqual(naSecundaria, ["wh-B"]);
});

checar("🔴 a troca REMOVE, não só acrescenta — nos DOIS sentidos", () => {
  /* O sentido que engana: `B → Principal` só CRESCE, então uma asserção de
     tamanho passaria sozinha. O que vale é o que cada lista PERDEU. */
  const perdeuIndoParaB = naPrincipal.filter((id) => !naSecundaria.includes(id));
  const perdeuIndoParaPrincipal = naSecundaria.filter((id) => !naPrincipal.includes(id));
  assert.deepEqual(perdeuIndoParaB.sort(), ["wh-A", "wh-orfao"]);
  assert.deepEqual(perdeuIndoParaPrincipal, ["wh-B"]);
});

checar("a Principal é CATCH-ALL: ela alcança o órfão", () => {
  /* Sem isto, todo webhook criado antes da coluna de área sumiria da tela
     enquanto continuaria recebendo venda no servidor. */
  assert.ok(naPrincipal.includes("wh-orfao"), naPrincipal.join(","));
});

checar("🔴 nenhum endereço alcançável numa área aponta para o token de outra", () => {
  const tokensDaSecundaria = WEBHOOKS.filter((w) => naSecundaria.includes(w.id)).map((w) => w.token);
  assert.deepEqual(tokensDaSecundaria, ["tok-B"]);
  for (const t of ["tok-A", "tok-orfao"]) {
    assert.ok(!tokensDaSecundaria.includes(t), `a área B alcança ${t}`);
  }
});

/* ══════════ 3 · A tela pede a lista DA ÁREA ATIVA ══════════ */

console.log("\n\x1b[1m3 · a guarda estática da tela\x1b[0m");

checar("a tela chama `listWebhooks(workspaceId)`, não `listWebhooks()`", () => {
  /* ⚠️ A ÂNCORA MIRA O QUE SÓ O CERTO TEM — e por LINHA. A prosa do cabeçalho
     cita a chamada para explicar por que ela precisa da área, e uma guarda por
     substring casaria com o comentário. Já aconteceu quatro vezes nesta base. */
  const linhas = TELA.split(/\r?\n/)
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /listWebhooks\(/.test(l) && !/^\s*(\*|\/\/)/.test(l));
  assert.ok(linhas.length > 0, "linha de base: ninguém chama listWebhooks na tela");
  for (const [n, l] of linhas) {
    assert.ok(/listWebhooks\(workspaceId\)/.test(l), `linha ${n} chama sem a área: ${l.trim()}`);
  }
});

checar("🔴 `workspaceId` está nas DEPS do efeito que busca a lista", () => {
  /* A assinatura do defeito registrada no CLAUDE.md: componente cliente +
     server action escopada por área + chamada sem o argumento + deps `[]`. */
  /* ⛔ A ÂNCORA LEVA O `.then` JUNTO. Sem ele, `indexOf` acha a PROSA do
     cabeçalho — que cita a chamada para explicar por que ela precisa da área —
     e a guarda passa a medir comentário. Foi exatamente o que aconteceu na
     primeira versão desta asserção, e é a quinta vez nesta base. */
  const i = TELA.indexOf("listWebhooks(workspaceId)\n      .then");
  assert.ok(i > 0, "linha de base: a chamada não existe no CÓDIGO");
  const depois = TELA.slice(i, i + 700);
  const deps = depois.match(/\}, \[([^\]]*)\]\);/);
  assert.ok(deps, "não achei o array de dependências do efeito");
  assert.ok(/\bworkspaceId\b/.test(deps[1]), `deps sem a área: [${deps[1]}]`);
});

checar("o painel de detalhe é DERIVADO da lista, não de um id solto", () => {
  /* Se o selecionado viesse só do `useState`, trocar de área deixaria o
     endereço da área anterior na tela — a forma 2, dentro da própria tela. */
  assert.match(TELA, /webhooks\.find\(\(w\) => w\.id === selecionadoId\) \?\? webhooks\[0\] \?\? null/);
});

checar("a lista de entregas remonta por `key`, e não zera estado dentro do efeito", () => {
  assert.match(TELA, /<ListaDeEntregas key=\{selecionado\.id\}/);
  const corpo = TELA.slice(TELA.indexOf("function ListaDeEntregas"), TELA.indexOf("Credenciais de API"));
  assert.ok(!/setLogs\(null\)/.test(corpo), "voltou a zerar `logs` dentro do efeito");
});

/* ══════════ 4 · A gaveta e a chave que NÓS geramos ══════════ */

console.log("\n\x1b[1m4 · a gaveta\x1b[0m");

checar("linha de base: existe gateway cuja chave nós geramos", () => {
  /* Sem esta afirmação, as duas asserções abaixo passariam num registro em que
     ninguém gera chave — a família do `=== 0` com a coleção vazia. */
  const geram = Object.values(REGISTRO).filter((g) => g.ativo && g.campos.some((c) => c.gerado));
  assert.ok(geram.length > 0, "nenhum gateway ativo gera chave — as guardas abaixo não medem nada");
});

checar("🔴 a gaveta GERA a chave dos gateways que a exigem de nós", () => {
  /* ⚠️ Isto quase se perdeu na reescrita: a geração vivia no `useTraffikState`
     (`segredoInicial`), que morreu com a view antiga. Sem ela o webhook da
     Cakto nasce com `secret` nulo e TODA venda volta 401 — e do lado de cá o
     sintoma é "nenhuma venda chegando". */
  assert.match(GAVETA, /crypto\.randomUUID\(\)/);
  assert.match(GAVETA, /function precisaGerar\(/);
});

checar("🔴 e ela NÃO regera a chave ao clicar no gateway já escolhido", () => {
  /* O bug original: quem copiasse a chave e clicasse de novo antes de salvar
     levava para o painel do gateway uma chave que a ferramenta não guardaria. */
  assert.match(GAVETA, /setGeradas\(\(m\) => \(m\[g\] \? m : \{ \.\.\.m, \[g\]: crypto\.randomUUID\(\) \}\)\)/);
});

checar("a chave GERADA é a que vai no salvar — não o campo de digitação", () => {
  assert.match(GAVETA, /secret: !editando && precisaGerar\(plataforma\) \? \(geradas\[plataforma\] \?\? ""\) : chave/);
});

checar("⛔ nenhum nome de gateway cravado na gaveta — tudo vem do registro", () => {
  /* O critério de aceite do `lib/gateways/contrato.ts`: integrar o décimo
     gateway custa um parser + uma entrada no registro. Um `if (platform ===
     "KIRVANO")` aqui significa que a arquitetura regrediu. */
  /* ⚠️ Os comentários são APAGADOS antes de medir, não filtrados por linha: um
     bloco de várias linhas tem continuações que não começam com `*`, e a
     primeira versão desta guarda reprovou por uma delas. Medir prosa é o modo
     de falha padrão da guarda por texto nesta base — cinco casos.
     ⛔ A substituição preserva as quebras de linha para o número da linha
     reportada continuar sendo o do arquivo de verdade. */
  const semComentario = GAVETA.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(
    /\/\/[^\n]*/g,
    "",
  );
  const linhas = semComentario
    .split(/\r?\n/)
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\b(KIRVANO|CAKTO|ONYXPAG|Kirvano|Cakto|OnyxPag)\b/.test(l));
  assert.deepEqual(linhas, [], "nome de gateway no CÓDIGO da gaveta");
});

checar("trocar a PLATAFORMA de um webhook existente não é oferecido", () => {
  /* Trocar o parser sem trocar a URL já colada no painel do gateway é a forma
     mais silenciosa do artefato de contexto errado — o endereço continua
     válido e passa a ser lido por outro parser. */
  assert.match(GAVETA, /\{!editando && \(/);
});

/* ══════════ 5 · O estado: o que acontece com a PRÓXIMA venda ══════════ */

console.log("\n\x1b[1m5 · o vocabulário do estado\x1b[0m");

const base = {
  id: "w",
  name: "n",
  platform: "KIRVANO",
  token: "t",
  url: "u",
  active: true,
  eventCount: 10,
  hasSecret: true,
  secret: null,
  lastEventAt: new Date("2026-08-10T12:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
};
const AGORA = new Date("2026-08-11T12:00:00Z");
const com = (extra) => estadoDoWebhook({ ...base, ...extra }, AGORA);

checar("🔴 gateway que EXIGE chave, sem chave → `recusando`", () => {
  /* É o estado que a tela antiga não tinha: ela pintava "Ativado" em verde.
     `autenticar()` devolve 401, e a mensagem dele manda o usuário editar o
     webhook NESTA tela. Medido no dev: os dois webhooks estavam assim. */
  const r = com({ hasSecret: false });
  assert.equal(r.estado, "recusando");
  assert.equal(r.tom, "danger");
  assert.ok(r.acao, "um estado que exige ação precisa dizer qual");
});

checar("controle negativo: com a chave, o mesmo webhook está `recebendo`", () => {
  /* Sem este par, a asserção acima passaria com uma função que devolvesse
     `recusando` sempre. */
  assert.equal(com({ hasSecret: true }).estado, "recebendo");
});

checar("gateway que NÃO exige chave, sem chave → não é `recusando`", () => {
  /* O endereço é a credencial. Pedir uma chave que não existe deixa a pessoa
     procurando indefinidamente por algo que ninguém pode entregar. */
  const semExigencia = Object.values(REGISTRO).find(
    (g) => g.ativo && g.auth.tipo === "segredo" && !g.auth.exigir,
  );
  assert.ok(semExigencia, "linha de base: não há gateway ativo sem exigência de chave");
  assert.notEqual(com({ platform: semExigencia.id, hasSecret: false }).estado, "recusando");
});

checar("desligado VENCE sem-chave — a ordem espelha a do servidor", () => {
  /* O servidor checa `!active` (403) ANTES da autenticação (401). Invertido,
     a tela pediria a chave de um webhook que continuaria recusando por estar
     desligado. */
  assert.equal(com({ active: false, hasSecret: false }).estado, "desligado");
});

checar("nunca recebeu → `esperando`, e NÃO é erro", () => {
  /* Pintar de vermelho quem acabou de configurar treina a pessoa a ignorar
     vermelho — e aí o aviso que um dia estiver certo não é lido. */
  const r = com({ eventCount: 0, lastEventAt: null });
  assert.equal(r.estado, "esperando");
  assert.notEqual(r.tom, "danger");
});

checar(`sem evento há ${DIAS_INATIVA}+ dias → \`mudo\`, com a ambiguidade declarada`, () => {
  const antigo = new Date(AGORA.getTime() - (DIAS_INATIVA + 1) * 86_400_000);
  const r = com({ lastEventAt: antigo });
  assert.equal(r.estado, "mudo");
  /* A frase não escolhe um lado: silêncio longo é indistinguível de oferta
     parada, e afirmar "está quebrado" numa oferta encerrada é alarme falso. */
  assert.match(r.frase, /Pode ser/);
});

checar("a régua de inatividade é UMA — a mesma da Visão geral", () => {
  assert.equal(typeof DIAS_INATIVA, "number");
  const naVisaoGeral = ler("../src/lib/integracoes/inventario.ts");
  /* Duas cópias divergiriam: a tela diria "mudo há 30 dias" enquanto a Visão
     geral ainda chamaria o mesmo webhook de conectada. */
  assert.match(naVisaoGeral, /export const DIAS_INATIVA/);
});

checar("`diasSemEvento` devolve `null` para quem nunca recebeu — não zero", () => {
  /* Ausência de observação ≠ observação de zero. Zero dias significa "recebeu
     hoje", que é o oposto de "nunca recebeu". */
  assert.equal(diasSemEvento(null, AGORA), null);
  assert.equal(diasSemEvento(AGORA, AGORA), 0);
});

/* ══════════ 6 · Os estados vazios, e o que eles têm direito de afirmar ═════ */

console.log("\n\x1b[1m6 · o vazio\x1b[0m");

checar("🔴 lista vazia com histórico → `purgado`, nunca `nunca-recebeu`", () => {
  /* Um webhook que recebeu 43 vendas há seis meses mostra a lista vazia porque
     a purga diária já apagou as linhas. Dizer "nenhuma entrega ainda" ali faria
     a tela afirmar que o webhook nunca funcionou — sobre o que mais funcionou.
     Quem separa os dois é `eventCount`, que a purga não zera. */
  assert.equal(motivoDoVazio({ eventCount: 43, lastEventAt: new Date() }), "purgado");
  assert.equal(motivoDoVazio({ eventCount: 0, lastEventAt: null }), "nunca-recebeu");
});

checar("todo motivo de vazio tem texto, e todo texto tem motivo", () => {
  /* Texto sem motivo alcançável é proteção morta: quem lê o arquivo acredita
     que o caso está coberto. Foi por isto que `sem-dono` foi REMOVIDO. */
  const motivos = new Set([
    motivoDoVazio({ eventCount: 0, lastEventAt: null }),
    motivoDoVazio({ eventCount: 1, lastEventAt: new Date() }),
  ]);
  assert.deepEqual(Object.keys(TEXTO_DO_VAZIO).sort(), [...motivos].sort());
});

checar("os QUATRO desfechos do log têm rótulo — não `ok`/`erro`", () => {
  /* `RECEBIDO` é um payload que chegou e não terminou de ser processado.
     Colapsá-lo em "ok" afirma que a venda entrou; em "erro", que não entrou.
     As duas seriam invenção. */
  assert.deepEqual(Object.keys(DESFECHO_DA_ENTREGA).sort(), [
    "ERRO",
    "PROCESSADO",
    "RECEBIDO",
    "REJEITADO",
  ]);
  for (const [k, v] of Object.entries(DESFECHO_DA_ENTREGA)) {
    assert.ok(v.rotulo && v.ajuda, `${k} sem rótulo ou sem ajuda`);
  }
});

/* ══════════ 7 · Os dois escopos da tela ══════════ */

console.log("\n\x1b[1m7 · os dois escopos, declarados\x1b[0m");

checar("🔴 a tela DIZ que as chaves de API não seguem a área ativa", () => {
  /* Medido em 11/08/2026: `listApiCredentials()` não recebe área e
     `createApiCredential()` não grava nenhuma. Postas ao lado dos webhooks sem
     dizer isso, a tela sugere que as duas metades se recortam do mesmo jeito.
     ⛔ Não é conserto — os dois arquivos são anteriores a `4e6aa9e`. */
  assert.match(TELA, /a conta inteira<\/strong>, não para a área de trabalho ativa/);
});

checar("e o efeito das credenciais NÃO depende da área — de propósito", () => {
  const i = TELA.indexOf("listApiCredentials()\n      .then");
  assert.ok(i > 0, "linha de base: a chamada não existe no CÓDIGO");
  const deps = TELA.slice(i, i + 400).match(/\}, \[([^\]]*)\]\);/);
  assert.ok(deps, "não achei as deps do efeito das credenciais");
  assert.ok(
    !/\bworkspaceId\b/.test(deps[1]),
    `as credenciais não são por área; a dep sugeriria que são: [${deps[1]}]`,
  );
});

/* ══════════════════════════════ Resumo ══════════════════════════════ */

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}:\n  - ${falhas.join("\n  - ")}\n`
    : `\n\x1b[32m${ok} asserções, todas verdes.\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
