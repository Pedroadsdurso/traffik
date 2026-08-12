/**
 * A TELA DE CRIATIVOS DECIDE O QUE ESTÁ MORRENDO — e essa é a decisão cara.
 *
 * > ### 🔴 A ABA `Em queda` NÃO PODE CONFUNDIR *PAROU* COM *PIOROU*
 * >
 * > É a distinção central deste projeto (`—` × `0`) na camada de aba. Um
 * > criativo pausado no meio do período tem a metade recente **sem observação
 * > nenhuma** — e a leitura ingênua ("o CTR foi a zero") o coloca no topo da
 * > lista de desgaste, empurrando para fora dela os criativos que de fato
 * > estão saturando.
 * >
 * > O modo de falha é o pior possível para uma aba de decisão: ela **parece
 * > cheia** e recomenda pausar o que já está pausado.
 *
 * ## O que cada bloco prova, e por que nenhum cobre o outro
 *
 * | # | O que precisa ser verdade |
 * |---|---|
 * | 1 | ausência de observação NUNCA vira `queda` — nas duas pontas da janela |
 * | 2 | as médias dos KPIs são PONDERADAS, não média de médias |
 * | 3 | `veiculando` lê o EFETIVO, e `null` não é inativo |
 * | 4 | as abas sem backend não existem na tela (`Testes A/B`, `Pastas`, `Análise`) |
 * | 5 | a pré-visualização declara a falha, e só quando houve tentativa |
 *
 * Puro: sem banco, sem rede, sem DOM. ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:criativos
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  ABAS,
  QUEDA_MINIMA,
  contarAbas,
  filtrarPorAba,
  kpisDosCriativos,
  tendenciaDoCriativo,
  temPreVisualizacao,
  veiculando,
} = await import("../src/lib/ads/criativos.ts");

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
 * ⛔ QUEBRAS NORMALIZADAS NA LEITURA. **402 arquivos versionados estão em
 * CRLF**, e toda âncora multilinha com `\n` falha neles — em silêncio,
 * devolvendo "não achei" com a mesma cara de "está tudo certo". Toda guarda por
 * texto aqui leva a asserção de LINHA DE BASE junto, pelo mesmo motivo.
 */
const ler = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const TELA = ler("../src/components/dashboard/views/criativos/CriativosScreen.tsx");
const PREVIA = ler("../src/components/tk/PreviaCriativo.tsx");
const LIB = ler("../src/lib/ads/criativos.ts");

/** Uma metade de janela com CTR derivado, como `computeCreatives` monta. */
const metade = (impressions, clicks, dias = 7) => ({
  spend: impressions * 0.01,
  impressions,
  clicks,
  ctr: impressions === 0 ? null : (clicks / impressions) * 100,
  dias,
});

const criativo = (over = {}) => ({
  id: "c1",
  name: "Criativo",
  campaign: "Campanha",
  thumbnailUrl: null,
  format: "Vídeo",
  ctr: 1,
  roas: 2,
  spend: 100,
  sales: 4,
  revenue: 200,
  best: false,
  effectiveStatus: "ACTIVE",
  status: "ACTIVE",
  impressions: 10_000,
  clicks: 100,
  cpc: 1,
  conversao: 0.04,
  anterior: metade(10_000, 100),
  recente: metade(10_000, 100),
  ...over,
});

/* ═════════ 1 · Ausência de observação NUNCA é queda ═════════ */
console.log("\n1 · a aba `Em queda` não confunde PAROU com PIOROU");

checar("queda de CTR além do limiar é queda — a linha de base", () => {
  /* ⚠️ Sem esta asserção as três seguintes passariam com a função devolvendo
     `sem-comparacao` para TUDO. Uma guarda precisa poder falhar pelo motivo
     que ela alega medir, e o caso positivo é o que prova que ela mede. */
  const t = tendenciaDoCriativo({ anterior: metade(10_000, 300), recente: metade(10_000, 150) });
  assert.equal(t.tendencia, "queda");
  assert.ok(t.variacao < -QUEDA_MINIMA, `variação ${t.variacao} deveria estar abaixo de -${QUEDA_MINIMA}`);
});

checar("🔴 metade RECENTE sem observação é `sem-comparacao`, nunca `queda`", () => {
  /* O criativo pausado no meio do período. Lido ingenuamente, "o CTR foi a
     zero" = queda de 100%, e ele lideraria a aba. Ele não piorou: ele parou. */
  const t = tendenciaDoCriativo({ anterior: metade(10_000, 300), recente: metade(0, 0, 0) });
  assert.equal(t.tendencia, "sem-comparacao");
  assert.equal(t.variacao, null);
});

checar("metade ANTERIOR sem observação também é `sem-comparacao`", () => {
  /* O criativo que ESTREOU no meio do período. Sem a guarda ele apareceria
     como alta de infinito, poluindo o outro lado da mesma medida. */
  const t = tendenciaDoCriativo({ anterior: metade(0, 0, 0), recente: metade(10_000, 300) });
  assert.equal(t.tendencia, "sem-comparacao");
});

checar("CTR anterior ZERO não vira queda nem alta — é denominador zero", () => {
  /* Houve impressão e nenhum clique: medição real, e mesmo assim não há razão
     que se possa formar. `0` no denominador é indefinido nesta base. */
  assert.equal(tendenciaDoCriativo({ anterior: metade(10_000, 0), recente: metade(10_000, 200) }).tendencia, "sem-comparacao");
});

checar("oscilação abaixo do limiar é `estavel`, não queda", () => {
  const t = tendenciaDoCriativo({ anterior: metade(10_000, 100), recente: metade(10_000, 90) });
  assert.equal(t.tendencia, "estavel");
});

checar("a aba `Em queda` NÃO lista o que parou — asserção diferencial", () => {
  /* ⚠️ Compara DOIS ESTADOS do mesmo fixture, em vez de contar ocorrências
     literais. A propriedade é "parar não pode ACRESCENTAR ninguém à aba", e a
     direção faz parte da asserção: `<=`, não `===`. */
  const caindo = criativo({ id: "cai", anterior: metade(10_000, 300), recente: metade(10_000, 120) });
  const parado = criativo({ id: "parou", anterior: metade(10_000, 300), recente: metade(0, 0, 0) });

  const soCaindo = filtrarPorAba([caindo], "queda").length;
  assert.ok(soCaindo > 0, "linha de base: o fixture que cai precisa entrar na aba");
  assert.equal(filtrarPorAba([parado], "queda").length, 0);
  assert.ok(filtrarPorAba([caindo, parado], "queda").length <= soCaindo + 0);
});

/* ═════════ 2 · Médias PONDERADAS, nunca média de médias ═════════ */
console.log("\n2 · os KPIs somam antes de dividir");

checar("🔴 CTR médio é Σcliques/Σimpressões — não a média dos CTR", () => {
  /* Um teste parado em 50 impressões a 0,2% ao lado de um em escala a 3%.
     A média simples devolveria ~1,6% para uma conta cujo CTR real é ~3%. */
  const rows = [
    criativo({ id: "teste", impressions: 50, clicks: 0 }),
    criativo({ id: "escala", impressions: 100_000, clicks: 3_000 }),
  ];
  const k = kpisDosCriativos(rows);
  const ponderado = (3_000 / 100_050) * 100;
  const mediaDeMedias = (0 + 3) / 2;
  assert.ok(Math.abs(k.ctrMedio - ponderado) < 0.001, `esperava ~${ponderado}, veio ${k.ctrMedio}`);
  /* ⚠️ O valor ERRADO é declarado para o teste poder falhar por ele. Sem esta
     linha, "está perto de 3" passaria também com a média de médias num
     fixture menos desequilibrado. */
  assert.ok(Math.abs(k.ctrMedio - mediaDeMedias) > 1, "o resultado não pode coincidir com a média de médias");
});

checar("lista vazia devolve `null` em toda razão — não zero", () => {
  const k = kpisDosCriativos([]);
  assert.equal(k.total, 0);
  for (const campo of ["ctrMedio", "cpcMedio", "conversao", "roasMedio"]) {
    assert.equal(k[campo], null, `${campo} deveria ser null (indefinido), veio ${k[campo]}`);
  }
});

checar("gasto sem clique dá CPC indefinido, e isso não é R$ 0,00", () => {
  const k = kpisDosCriativos([criativo({ clicks: 0, impressions: 900, spend: 50, sales: 0 })]);
  assert.equal(k.cpcMedio, null);
  assert.equal(k.conversao, null);
});

/* ═════════ 3 · Decisão lê o EFETIVO ═════════ */
console.log("\n3 · veiculação: efetivo, e `null` não é inativo");

checar("🔴 ACTIVE configurado em campanha pausada NÃO está entregando", () => {
  /* O caso que a base já pagou no Gerenciador: `status: ACTIVE` com
     `effectiveStatus: CAMPAIGN_PAUSED`. Quem decide lê o segundo. */
  assert.equal(veiculando({ effectiveStatus: "CAMPAIGN_PAUSED" }), false);
  assert.equal(veiculando({ effectiveStatus: "ACTIVE" }), true);
});

checar("nunca sincronizado é `null` — fora das DUAS contagens", () => {
  const rows = [
    criativo({ id: "a", effectiveStatus: "ACTIVE" }),
    criativo({ id: "b", effectiveStatus: "PAUSED" }),
    criativo({ id: "c", effectiveStatus: null }),
  ];
  const k = kpisDosCriativos(rows);
  assert.equal(k.veiculando, 1);
  assert.equal(k.semVeiculacaoConhecida, 1);
  /* ⛔ E o não sincronizado não pode cair em `Inativos`: `!veiculando(c)` o
     incluiria, porque `null` é falsy. É por isso que o filtro usa `=== false`. */
  const inativos = filtrarPorAba(rows, "inativos").map((r) => r.id);
  assert.deepEqual(inativos, ["b"]);
});

checar("`Top performers` exige entregar E ROAS acima de 1", () => {
  const rows = [
    criativo({ id: "bom", effectiveStatus: "ACTIVE", roas: 3 }),
    criativo({ id: "parado", effectiveStatus: "PAUSED", roas: 9 }),
    criativo({ id: "semGasto", effectiveStatus: "ACTIVE", roas: null }),
    criativo({ id: "fraco", effectiveStatus: "ACTIVE", roas: 0.4 }),
  ];
  assert.deepEqual(filtrarPorAba(rows, "top").map((r) => r.id), ["bom"]);
});

checar("as contagens das abas somam mais que o total — e é correto", () => {
  /* Elas são PERGUNTAS, não uma partição: o mesmo criativo pode estar
     entregando bem E em queda. Afirmar isto impede que alguém "conserte" a
     soma um dia. */
  const rows = [criativo({ id: "x", effectiveStatus: "ACTIVE", roas: 4, anterior: metade(10_000, 400), recente: metade(10_000, 100) })];
  const c = contarAbas(rows);
  assert.equal(c.todos, 1);
  assert.equal(c.top, 1);
  assert.equal(c.queda, 1);
  assert.ok(c.top + c.queda > c.todos);
});

/* ═════════ 4 · As abas sem backend não existem ═════════ */
console.log("\n4 · nada de aba que abre vazia");

checar("`Testes A/B`, `Pastas` e `Análise` não estão nas abas", () => {
  const ids = ABAS.map((a) => a.id);
  assert.deepEqual(ids, ["todos", "top", "queda", "inativos"]);
  /* ⛔ A guarda mira a DECLARAÇÃO das abas, não o texto do arquivo: a prosa do
     `lib` cita os três nomes justamente para explicar por que eles não estão
     lá. Guarda por substring acharia o comentário e reprovaria a explicação —
     é a sexta vez que essa armadilha aparece nesta base. */
  const rotulos = ABAS.map((a) => a.rotulo.toLowerCase()).join("|");
  for (const proibido of ["a/b", "pasta", "análise"]) {
    assert.ok(!rotulos.includes(proibido), `"${proibido}" não pode ser rótulo de aba: não há backend`);
  }
});

checar("toda aba declara o próprio critério — recorte sem critério não informa", () => {
  for (const a of ABAS) {
    assert.ok(a.ajuda && a.ajuda.length > 30, `a aba "${a.rotulo}" precisa de uma frase de critério`);
  }
  /* E a tela precisa RENDERIZAR a frase, não só guardá-la. */
  assert.ok(
    TELA.includes("ABAS.find((a) => a.id === aba)!.ajuda"),
    "linha de base: a tela não desenha a frase de critério da aba ativa",
  );
});

checar("o `lib` não importa o prisma — a regra da tela é testável sem banco", () => {
  /* `escopoDeConfig` ensinou em 11/08: módulo que importa o cliente do banco
     LANÇA só de ser importado sem `DATABASE_URL`, e nenhum teste puro alcança
     o que ele decide. */
  assert.ok(!/from "@\/lib\/prisma"/.test(LIB), "lib/ads/criativos.ts não pode importar o prisma");
});

/* ═════════ 5 · A pré-visualização é honesta ═════════ */
console.log("\n5 · a imagem que não vem");

checar("`temPreVisualizacao` distingue ausência de string vazia", () => {
  assert.equal(temPreVisualizacao({ thumbnailUrl: null }), false);
  assert.equal(temPreVisualizacao({ thumbnailUrl: "" }), false);
  assert.equal(temPreVisualizacao({ thumbnailUrl: "https://x/y.jpg" }), true);
});

checar("🔴 o selo de falha exige URL **e** falha — sem URL não houve tentativa", () => {
  /* "tentei e a Meta recusou" e "a Meta nunca mandou imagem" são fatos
     diferentes sobre a conta. Um selo nos dois casos colapsa os dois. */
  const i = PREVIA.indexOf("{!compacta && url && falhou && (");
  assert.ok(i > 0, "linha de base: a condição do selo não está no CÓDIGO");
});

checar("o estado guarda QUAL url falhou — sem efeito de reset", () => {
  /* Com booleano era preciso um `useEffect` para zerar quando o sync renovasse
     o link; sem ele, imagem nova válida ficaria em fallback para sempre. A
     asserção mira a DECLARAÇÃO, que a prosa do arquivo não contém. */
  const i = PREVIA.indexOf("const [urlQueFalhou, setUrlQueFalhou] = React.useState<string | null>(null);");
  assert.ok(i > 0, "linha de base: a declaração do estado não está no CÓDIGO");
  const ofensoras = PREVIA.split("\n")
    .map((l, n) => [n + 1, l])
    .filter(([, l]) => /React\.useEffect/.test(l));
  assert.deepEqual(ofensoras, [], "a prévia não deve ter efeito nenhum");
});

checar("a tela não reserva retângulo vazio esperando imagem", () => {
  /* A `PreviaCriativo` sempre desenha conteúdo: ou a imagem, ou o bloco
     tipográfico. Nunca um `placeholder` cinza — que afirmaria "carregando". */
  const i = PREVIA.indexOf("{iniciais(nome)}");
  assert.ok(i > 0, "linha de base: o bloco tipográfico não está no CÓDIGO");
});

/* ═════════ Resumo ═════════ */
console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}:\n  - ${falhas.join("\n  - ")}\n`
    : `\n\x1b[32m${ok} asserções, todas verdes.\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
