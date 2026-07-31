/**
 * Apaga um usuário inteiro, com o Cascade levando tudo que pende dele.
 *
 * ## ⛔ É A OPERAÇÃO MAIS DESTRUTIVA DO PROJETO
 *
 * `User` tem 15 relações `onDelete: Cascade`. Uma linha de `DELETE` leva vendas,
 * cliques, eventos de pixel, webhooks, pixels, contas de anúncio, campanhas,
 * conjuntos, anúncios, métricas diárias, regras, despesas, áreas, credenciais e
 * notificações. **Não há desfazer, e o Supabase Free não tem PITR** — o
 * `npm run backup` é o único backup que existe.
 *
 * ## As proteções, e o que cada uma pega
 *
 * | Proteção | O que ela evita |
 * |---|---|
 * | Simula por padrão; `--aplicar` para escrever | rodar achando que era leitura |
 * | `exigirBancoDeDesenvolvimento()` | apagar no banco errado |
 * | `--confirmar '<email>'` digitado à mão | engano de copiar/colar o alvo |
 * | Recusa com conta de anúncio ou gasto > 0 | destruir histórico de gasto |
 * | `DELETE ... WHERE id = $1` | e-mail duplicado, ou `WHERE` largo demais |
 * | Snapshot das OUTRAS contas, antes e depois | dano colateral silencioso |
 *
 * > ### 🔴 O e-mail ENCONTRA; o id APAGA.
 * > O `WHERE` final nunca usa e-mail. Esta é a mesma lição do incidente de
 * > 29/07/2026, em que um `UPDATE ... WHERE "name" = 'Area A'` atravessou
 * > usuários. Identificador de busca e identificador de exclusão são coisas
 * > diferentes.
 *
 * > ### ⚠️ Recusar com gasto registrado NÃO é excesso de zelo
 * > `DailyAdMetric` pende de `Ad` → `AdAccount` com `Cascade`. Apagar a conta
 * > destrói o histórico do que a Meta cobrou — o número que alimenta ROAS, ROI e
 * > CPA de todos os períodos, e que não existe em nenhuma outra fonte nossa.
 * > É o mesmo motivo pelo qual a exclusão de ÁREA nunca apaga a linha da conta
 * > de anúncio, só desvincula.
 *
 * ## Uso
 *
 *   npm run conta:apagar -- --url '<conn>' --email 'x@y.z'
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run conta:apagar -- --url '<conn>' --email 'x@y.z' \
 *       --confirmar 'x@y.z' --aplicar
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const url = arg("--url");
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
const email = arg("--email");
const confirmado = arg("--confirmar");
const aplicar = args.includes("--aplicar");

const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const brl = (n) =>
  "R$ " +
  Number(n ?? 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d)(?=,))/g, ".");
const morrer = (m) => {
  console.error(`\n${C.r}${C.b}⛔ ${m}${C.x}\n`);
  process.exit(1);
};

if (!email) morrer("Faltou --email. Ele ENCONTRA o usuário; o id é que apaga.");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "apagar-conta" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

/** Tabelas que somem por Cascade. */
const TABELAS = [
  ["Sale", "vendas"], ["Click", "cliques"], ["PixelEvent", "eventos de pixel"],
  ["Webhook", "webhooks"], ["PixelConfig", "pixels"], ["AdProfile", "perfis do Facebook"],
  ["AdAccount", "contas de anúncio"], ["AutomationRule", "regras"],
  ["Expense", "taxas e custos"], ["Workspace", "áreas de trabalho"],
  ["ApiCredential", "chaves de API"], ["Notification", "notificações"],
  ["WebhookLog", "logs de webhook"], ["DashboardLayout", "layouts salvos"],
];

const contar = async (userId) => {
  const out = {};
  for (const [t] of TABELAS) {
    const { rows } = await cliente.query(
      `SELECT COUNT(*)::int AS n FROM "${t}" WHERE "userId" = $1`,
      [userId],
    );
    out[t] = rows[0].n;
  }
  return out;
};

// ── 1. Encontrar (por e-mail) ───────────────────────────────────────────────
const { rows: achados } = await cliente.query(
  `SELECT id, email, name FROM "User" WHERE email = $1`,
  [email],
);
if (achados.length === 0) morrer(`Nenhum usuário com e-mail ${email}.`);
if (achados.length > 1) morrer(`${achados.length} usuários com esse e-mail — abortando.`);
const alvo = achados[0];

// ── 2. Inventário ───────────────────────────────────────────────────────────
console.log(`\n${C.b}${"═".repeat(70)}${C.x}`);
console.log(`${C.b}ALVO: ${alvo.email}${C.x}`);
console.log(`${C.d}id ${alvo.id} · nome ${alvo.name ?? "—"}${C.x}`);
console.log(`${C.b}${"═".repeat(70)}${C.x}\n`);

const antes = await contar(alvo.id);
for (const [t, rotulo] of TABELAS) {
  console.log(`  ${antes[t] === 0 ? C.d : ""}${String(antes[t]).padStart(6)}  ${rotulo}${C.x}`);
}

const { rows: g } = await cliente.query(
  `SELECT COALESCE(SUM(m.spend), 0) AS total FROM "DailyAdMetric" m
     JOIN "Ad" a ON a.id = m."adId" JOIN "AdAccount" c ON c.id = a."adAccountId"
    WHERE c."userId" = $1`,
  [alvo.id],
);
const { rows: f } = await cliente.query(
  `SELECT COALESCE(SUM(value), 0) AS total FROM "Sale"
    WHERE "userId" = $1 AND status = 'APROVADA'`,
  [alvo.id],
);
console.log(`\n  Faturamento aprovado .... ${brl(f[0].total)}`);
console.log(`  Gasto de anúncio ........ ${brl(g[0].total)}`);

// ── 3. Recusa dura ──────────────────────────────────────────────────────────
if (antes.AdAccount > 0 || Number(g[0].total) > 0) {
  morrer(
    `RECUSADO: esta conta tem ${antes.AdAccount} conta(s) de anúncio e ` +
      `${brl(g[0].total)} de gasto registrado.\n   Apagar destruiria o histórico do que a ` +
      `Meta cobrou — ROAS, ROI e CPA de\n   todos os períodos saem dele, e não há outra fonte.`,
  );
}

// ── 4. Snapshot das OUTRAS contas ───────────────────────────────────────────
const { rows: outros } = await cliente.query(
  `SELECT id, email FROM "User" WHERE id <> $1 ORDER BY email`,
  [alvo.id],
);
const antesOutros = {};
for (const o of outros) antesOutros[o.id] = await contar(o.id);

console.log(`\n  ${C.b}Outras contas no banco (não devem mudar em nada)${C.x}`);
for (const o of outros) {
  const c = antesOutros[o.id];
  console.log(
    `    ${o.email.padEnd(28)} ${String(c.Sale).padStart(4)} vendas · ` +
      `${String(c.Click).padStart(4)} cliques · ${c.Webhook} webhook(s) · ${c.AdAccount} conta(s)`,
  );
}

// ── 5. Simulação ou execução ────────────────────────────────────────────────
if (!aplicar) {
  console.log(
    `\n${C.y}${C.b}SIMULAÇÃO — nada foi apagado.${C.x}\n\n` +
      `  Para apagar de verdade:\n` +
      `  ${C.d}npm run conta:apagar -- --url '<conn>' --email '${email}' \\\n` +
      `      --confirmar '${email}' --aplicar${C.x}\n`,
  );
  await cliente.end();
  process.exit(0);
}

if (confirmado !== email) {
  morrer(
    `Confirmação não bate.\n   Passe --confirmar '${email}' — digitado, não copiado do inventário.`,
  );
}

// 🔴 O WHERE é por ID. O e-mail já cumpriu o papel dele lá em cima.
console.log(`\n${C.y}Apagando…${C.x}`);
const res = await cliente.query(`DELETE FROM "User" WHERE id = $1`, [alvo.id]);
if (res.rowCount !== 1) morrer(`Esperava apagar 1 linha, apaguei ${res.rowCount}. Verifique o banco.`);

// ── 6. Verificação do Cascade ───────────────────────────────────────────────
console.log(`\n${C.b}Verificação — o que sobrou do usuário apagado${C.x}`);
const depois = await contar(alvo.id);
let sobrou = 0;
for (const [t, rotulo] of TABELAS) {
  const ok = depois[t] === 0;
  if (!ok) sobrou++;
  console.log(
    `  ${ok ? C.g + "✓" : C.r + "✗"} ${String(depois[t]).padStart(4)}  ${rotulo}` +
      `${ok ? "" : "  ← NÃO cascateou"}${C.x}`,
  );
}

// ── 7. As outras contas continuam idênticas? ────────────────────────────────
console.log(`\n${C.b}Verificação — as outras contas${C.x}`);
let divergiu = 0;
for (const o of outros) {
  const dep = await contar(o.id);
  const difs = TABELAS.filter(([t]) => antesOutros[o.id][t] !== dep[t]).map(
    ([t]) => `${t}: ${antesOutros[o.id][t]}→${dep[t]}`,
  );
  if (difs.length === 0) {
    console.log(`  ${C.g}✓${C.x} ${o.email.padEnd(28)} intacta`);
  } else {
    divergiu++;
    console.log(`  ${C.r}✗ ${o.email.padEnd(28)} MUDOU: ${difs.join(", ")}${C.x}`);
  }
}

console.log(
  sobrou === 0 && divergiu === 0
    ? `\n${C.g}${C.b}✓ Usuário apagado. Cascade completo, nenhuma outra conta afetada.${C.x}\n`
    : `\n${C.r}${C.b}⚠️  ${sobrou} tabela(s) com resíduo, ${divergiu} conta(s) alterada(s).` +
        ` RESTAURE O BACKUP.${C.x}\n`,
);

await cliente.end();
process.exit(sobrou === 0 && divergiu === 0 ? 0 : 1);
