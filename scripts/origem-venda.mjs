/**
 * De onde veio cada venda SEM plataforma — e quanto de faturamento está em jogo,
 * **por usuário**.
 *
 * ## Por que existe
 *
 * `npm run backfill:platform` recupera a procedência das vendas cujo webhook
 * ainda existe. As que sobram são **órfãs**: o webhook foi excluído, ou elas
 * nunca vieram de webhook nenhum. Dado de teste em produção não é detalhe de
 * cadastro — entra em faturamento, ROAS, CPA, ticket, ARPU e no globo.
 *
 * ## 🔴 TUDO É POR USUÁRIO. NUNCA SOME AS CONTAS.
 *
 * A primeira versão deste script calculava o impacto com um `SUM` **sem
 * `WHERE "userId"`**, somando todas as contas do banco. O relatório listava as
 * linhas separadas por dono e depois entregava uma distorção de "40,9%" que não
 * era de ninguém: misturava as vendas de teste de um usuário de desenvolvimento
 * com as do dono real.
 *
 * O usuário pegou o erro antes de apagar. O número teria justificado uma
 * exclusão para resolver um problema que a conta dele não tinha.
 *
 * > **Relatório multi-usuário que agrega sem separar produz um número que não
 * > corresponde a nenhuma conta real.** Toda métrica aqui é recortada por
 * > `userId` — e o total do banco NÃO é exibido, porque ele não significa nada
 * > para quem lê.
 *
 * Vale para qualquer diagnóstico deste projeto: as telas todas filtram por
 * `userId`, então um script que não filtra está medindo outra coisa.
 *
 * ## ⛔ Ele CLASSIFICA, e a classificação é um PALPITE EXPLICADO
 *
 * Cada linha sai com um veredito e **o motivo dele**. Quem decide o que apagar é
 * o usuário, olhando o `externalId` e conferindo no painel do gateway.
 * `INDETERMINADO` é resposta legítima — não force um veredito.
 *
 * ## Somente leitura
 *
 *   npm run venda:origem -- --url '<conn>'
 */
import "dotenv/config";

import pg from "pg";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const brl = (n) =>
  "R$ " +
  Number(n ?? 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");
const dia = (d) => new Date(d).toISOString().slice(0, 16).replace("T", " ");
const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };

const { rows } = await cliente.query(
  `SELECT s.id, s."userId", s.product, s.value, s.status, s.timestamp,
          s."externalId", s."pedidoId", s."buyerEmail", s."buyerName",
          s."clickId", s.fbc, s.fbp,
          (s."rawPayload" IS NULL)          AS sem_payload,
          LEFT(s."rawPayload"::text, 200)   AS amostra,
          u.email AS dono
     FROM "Sale" s JOIN "User" u ON u.id = s."userId"
    WHERE s.platform IS NULL
    ORDER BY s."userId", s.timestamp`,
);

/** Domínios que só existem em documentação e em teste. */
const DOMINIOS_FALSOS =
  /@(x\.com|example\.(com|org|net)|exemplo\.(com|dev)|test(e)?\.(com|dev|local)|mailinator\.com|localhost)$/i;

/**
 * Sinais de que a linha nasceu de um teste. Cada um vira uma FRASE, porque é ela
 * que o usuário lê para decidir — não o veredito.
 *
 * `vizinhos` é o conjunto de valores inteiros das OUTRAS vendas órfãs do mesmo
 * usuário: é o que permite detectar progressão aritmética (100, 101, 102…),
 * padrão de lote gerado em laço que nenhum gateway produz.
 */
function ler(r, vizinhos) {
  const ext = (r.externalId ?? "").trim();
  const motivos = [];
  let teste = 0;
  let real = 0;

  if (!ext) {
    motivos.push("sem externalId — gateway nenhum atribuiu um número de pedido");
    teste += 2;
  } else if (/^(test|teste|race|burst|cert|evt|demo|sample|dummy|fake|mock|seed|dev)[-_]?/i.test(ext)) {
    motivos.push(`externalId "${ext}" começa com marca de teste`);
    teste += 3;
  } else if (/^\d{1,4}$/.test(ext)) {
    motivos.push(`externalId "${ext}" é um número curto — gateway usa id longo ou uuid`);
    teste += 3;
  } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ext) || ext.length >= 10) {
    motivos.push(`externalId "${ext}" tem forma de pedido de gateway`);
    real += 2;
  } else {
    motivos.push(`externalId "${ext}" — forma inconclusiva`);
  }

  // ⚠️ Sinal quase conclusivo: TODA venda que entra pela ferramenta passa por
  // `ingestSale`, que sempre grava o `rawPayload`. Linha sem payload não veio de
  // gateway nenhum — foi escrita direto no banco.
  if (r.sem_payload) {
    motivos.push("SEM rawPayload — não passou por ingestSale; foi escrita direto no banco");
    teste += 3;
  } else {
    // NÃO conta como "real": ter payload só prova que chegou por HTTP, e um
    // teste batendo em /api/webhook/ingest também chega por HTTP com payload.
    motivos.push("tem rawPayload — chegou por HTTP (teste no endpoint também chega)");
  }

  const email = (r.buyerEmail ?? "").trim();
  if (!email) {
    motivos.push("sem e-mail do comprador");
    teste += 1;
  } else if (DOMINIOS_FALSOS.test(email)) {
    motivos.push(`e-mail "${email}" usa domínio de documentação/teste`);
    teste += 3;
  }

  // Nome sequencial ("Comprador 0", "Buyer 3") — laço, não pessoa.
  if (/^(comprador|buyer|cliente|user|usuário|test(e)?|john doe)\s*\d*$/i.test((r.buyerName ?? "").trim())) {
    motivos.push(`nome "${r.buyerName}" é gerado em série, não é uma pessoa`);
    teste += 3;
  }

  // Progressão aritmética dentro do mesmo lote: 100, 101, 102…
  const v = Number(r.value);
  if (Number.isInteger(v) && (vizinhos.has(v - 1) || vizinhos.has(v + 1))) {
    motivos.push(`valor ${brl(v)} está em progressão com outras órfãs desta conta`);
    teste += 3;
  }

  // ⚠️ Sinal FRACO e só observação: apagar por nome de produto destruiria a
  // venda real de quem chame o produto assim.
  if (/\b(teste|test|produto teste|exemplo)\b/i.test(r.product ?? "")) {
    motivos.push(`${C.y}produto "${r.product}" sugere teste (sinal fraco — confira o pedido)${C.x}`);
    teste += 1;
  }

  // ⚠️ `fbc` NÃO é sinal de teste sozinho — tráfego orgânico legítimo também
  // chega sem ele. Ter `fbc` é que prova origem em clique de anúncio real.
  if (r.fbc) {
    motivos.push(`${C.g}tem fbc (${String(r.fbc).slice(0, 28)}…) — veio de clique real em anúncio${C.x}`);
    real += 3;
  }
  if (r.clickId) {
    motivos.push("casada com um clique rastreado");
    real += 1;
  }

  const veredito =
    teste >= 3 && teste > real ? "TESTE"
    : real >= 2 && real > teste ? "VENDA REAL"
    : "INDETERMINADO";
  return { veredito, motivos };
}

// ── Agrupa por DONO. Nada é somado entre contas. ────────────────────────────
const porDono = new Map();
for (const r of rows) {
  if (!porDono.has(r.userId)) porDono.set(r.userId, []);
  porDono.get(r.userId).push(r);
}

console.log(`\n${C.b}Origem das vendas sem plataforma${C.x}   (somente leitura)`);
console.log(
  `${C.d}Cada conta é analisada separadamente — as telas filtram por usuário,\n` +
    `então um total do banco não corresponde ao dashboard de ninguém.${C.x}\n`,
);
if (rows.length === 0) console.log(`  ${C.g}Nenhuma venda órfã em nenhuma conta.${C.x}\n`);

const aprovada = (r) => r.status === "APROVADA";
const soma = (ls) => ls.filter(aprovada).reduce((a, r) => a + Number(r.value), 0);

for (const [userId, linhas] of porDono) {
  const dono = linhas[0].dono;
  const vizinhos = new Set(
    linhas.map((r) => Number(r.value)).filter((v) => Number.isInteger(v)),
  );

  console.log(`\n${C.b}${"═".repeat(74)}${C.x}`);
  console.log(`${C.b}CONTA: ${dono}${C.x}  ${C.d}(${userId})${C.x}`);
  console.log(`${C.b}${"═".repeat(74)}${C.x}`);

  const cat = { TESTE: [], "VENDA REAL": [], INDETERMINADO: [] };
  for (const r of linhas) {
    const { veredito, motivos } = ler(r, vizinhos);
    cat[veredito].push(r);
    const cor = veredito === "TESTE" ? C.r : veredito === "VENDA REAL" ? C.g : C.y;
    console.log(
      `\n  ${cor}${C.b}${veredito.padEnd(14)}${C.x} ${brl(r.value).padEnd(13)} ` +
        `${String(r.product).slice(0, 28).padEnd(29)} ${r.status}  ${dia(r.timestamp)}`,
    );
    console.log(`    ${C.d}id ${r.id}${C.x}`);
    for (const m of motivos) console.log(`      · ${m}`);
  }

  console.log(`\n  ${C.b}Resumo desta conta — só APROVADAS entram em faturamento${C.x}`);
  for (const [nome, ls] of Object.entries(cat)) {
    const cor = nome === "TESTE" ? C.r : nome === "VENDA REAL" ? C.g : C.y;
    console.log(
      `    ${cor}${nome.padEnd(14)}${C.x} ${String(ls.length).padStart(3)} linha(s) · ` +
        `${ls.filter(aprovada).length} aprovada(s) · ${brl(soma(ls))}`,
    );
  }

  // 🔴 O `WHERE "userId"` é o ponto inteiro desta consulta.
  const { rows: t } = await cliente.query(
    `SELECT COALESCE(SUM(value), 0) AS rev,
            COUNT(DISTINCT COALESCE("pedidoId", id)) AS pedidos
       FROM "Sale"
      WHERE "userId" = $1 AND status = 'APROVADA'
        AND timestamp >= now() - interval '30 days'`,
    [userId],
  );
  const rev30 = Number(t[0].rev);
  const suspeito = soma(cat.TESTE);
  const duvida = soma(cat.INDETERMINADO);

  console.log(`\n  ${C.b}Impacto NESTA conta — últimos 30 dias${C.x}`);
  console.log(`    Faturamento hoje .............. ${brl(rev30)}  (${t[0].pedidos} pedidos)`);
  console.log(`    ${C.r}Em linhas lidas como TESTE .... ${brl(suspeito)}${C.x}`);
  console.log(`    ${C.y}Em INDETERMINADO .............. ${brl(duvida)}${C.x}`);
  if (rev30 > 0 && suspeito + duvida > 0) {
    console.log(
      `\n    ${C.b}Distorção: ${((suspeito / rev30) * 100).toFixed(1)}% teste provável` +
        `, mais ${((duvida / rev30) * 100).toFixed(1)}% em dúvida.${C.x}`,
    );
    console.log(`    Apagando só os TESTE, cai para ${brl(rev30 - suspeito)}.`);
  } else if (suspeito + duvida === 0) {
    console.log(`\n    ${C.g}Nenhuma distorção: as órfãs desta conta não são teste.${C.x}`);
  }
}

console.log(
  `\n${C.d}⚠️  Janela de 30 dias corrida em UTC, para dimensionar. A tela usa dias de\n` +
    `    calendário no fuso do usuário — os centavos divergem, a ordem de grandeza não.${C.x}`,
);
console.log(
  `${C.d}⚠️  Veredito é palpite explicado. Confira o externalId no painel do gateway\n` +
    `    antes de apagar linha marcada como VENDA REAL ou INDETERMINADO.${C.x}\n`,
);

await cliente.end();
