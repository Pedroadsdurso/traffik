/**
 * Backup completo dos DADOS do banco, sem depender do `pg_dump`.
 *
 * ## Por que não é `pg_dump`
 *
 * Esta máquina não tem as ferramentas de linha de comando do PostgreSQL
 * instaladas (nem psql, nem Docker, nem Supabase CLI), e instalar um servidor
 * Postgres inteiro só para gerar um arquivo seria um efeito colateral grande
 * demais. Se um dia o `pg_dump` estiver disponível, ele continua sendo o
 * formato canônico — este script não o substitui, cobre a lacuna.
 *
 * ## O que entra no backup, e o que NÃO entra
 *
 * - **Entra:** todas as linhas de todas as tabelas do schema `public`, uma por
 *   linha, em JSONL, com o tipo preservado pelo próprio Postgres (`to_jsonb`).
 * - **NÃO entra:** o schema (DDL). Ele já vive versionado em
 *   `prisma/migrations` — restaurar é `prisma migrate deploy` e depois este
 *   arquivo. Duplicar o DDL aqui só criaria uma segunda verdade.
 * - **NÃO entra:** usuários do Postgres, extensões, políticas RLS e o schema
 *   `auth` do Supabase. Este projeto não usa nada disso (a autenticação é o
 *   NextAuth, na tabela `User`), mas fica registrado.
 *
 * ## Por que JSONL e não INSERTs
 *
 * Montar `INSERT` à mão exige escapar string, array, JSON, Decimal e timestamp
 * corretamente — é onde um backup caseiro silenciosamente corrompe dado. Aqui
 * quem serializa é o Postgres (`to_jsonb`) e quem desserializa é o Postgres
 * (`jsonb_populate_record`), então nenhum tipo passa pelas minhas mãos.
 *
 * Uso:
 *   node scripts/backup-db.mjs                  # usa DIRECT_URL (ou DATABASE_URL)
 *   node scripts/backup-db.mjs --url "postgres://..."
 *
 * É uma operação de LEITURA — por isso não passa pelo `guard-db.mjs`, que
 * existe para bloquear ESCRITA acidental em produção. Fazer backup da produção
 * é justamente o uso legítimo de apontar para ela.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const argUrl = process.argv.indexOf("--url");
const url = argUrl >= 0 ? process.argv[argUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("✗ Sem DIRECT_URL/DATABASE_URL e sem --url. Abortando.");
  process.exit(1);
}

const ref = (url.match(/postgres\.([a-z0-9]+):/) ?? [])[1] ?? "desconhecido";
const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const destino = path.join("backups", `traffik-${ref}-${carimbo}.jsonl`);

const cliente = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });

async function main() {
  await cliente.connect();

  const { rows: info } = await cliente.query(`SELECT current_database() AS db, version() AS v`);
  console.log(`Banco: ${info[0].db} · projeto ${ref}`);
  console.log(info[0].v.split(",")[0]);

  const { rows: tabelas } = await cliente.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  );

  fs.mkdirSync("backups", { recursive: true });
  const saida = fs.createWriteStream(destino, { encoding: "utf8" });
  const escrever = (obj) =>
    new Promise((res) => {
      if (!saida.write(JSON.stringify(obj) + "\n")) saida.once("drain", res);
      else res();
    });

  // Cabeçalho: o restore precisa saber de onde veio e quando.
  await escrever({
    __meta: true,
    geradoEm: new Date().toISOString(),
    projeto: ref,
    database: info[0].db,
    tabelas: tabelas.map((t) => t.tablename),
    observacao:
      "Somente DADOS. O schema vive em prisma/migrations — restaure com `prisma migrate deploy` antes de `restore-db.mjs`.",
  });

  let totalLinhas = 0;
  const resumo = [];
  for (const { tablename } of tabelas) {
    // `to_jsonb(t)` deixa a serialização de TODO tipo com o Postgres.
    const { rows } = await cliente.query(`SELECT to_jsonb(t) AS linha FROM "${tablename}" t`);
    for (const r of rows) await escrever({ t: tablename, r: r.linha });
    totalLinhas += rows.length;
    resumo.push({ tabela: tablename, linhas: rows.length });
  }

  await new Promise((res) => saida.end(res));

  const bytes = fs.statSync(destino).size;
  console.table(resumo);
  console.log(
    `\n✓ Backup gerado: ${destino}\n` +
      `  ${tabelas.length} tabelas · ${totalLinhas} linhas · ${bytes.toLocaleString("pt-BR")} bytes ` +
      `(${(bytes / 1024).toFixed(1)} KB)\n`,
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => cliente.end());
