/**
 * Restaura um backup gerado por `backup-db.mjs`.
 *
 * Existe porque backup que ninguém sabe restaurar não é backup — é arquivo. A
 * hora de descobrir que o restore não funciona não pode ser a hora em que se
 * precisa dele.
 *
 * ## Ordem de uso
 *
 *   1. `npx prisma migrate deploy`   → cria o SCHEMA (o dump só tem DADOS)
 *   2. `node scripts/restore-db.mjs backups/<arquivo>.jsonl`
 *
 * ## Como as chaves estrangeiras são resolvidas
 *
 * As tabelas são inseridas em **ordem topológica**, calculada a partir das FKs
 * reais do banco de destino — não numa lista fixa escrita à mão, que
 * silenciosamente envelheceria a cada tabela nova. Ciclos (se algum dia
 * houver) caem para o fim, e a inserção segue mesmo assim.
 *
 * A desserialização é feita pelo próprio Postgres (`jsonb_populate_record`),
 * então array, Json, Decimal e timestamp voltam com o tipo certo sem passar por
 * nenhuma conversão minha.
 *
 * ⛔ **Passa pelo `guard-db.mjs`**: restaurar é ESCRITA em massa. Apontar para
 * produção sem querer sobrescreveria o banco vivo.
 */
import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "restore-db" });

const arquivo = process.argv[2];
if (!arquivo || !fs.existsSync(arquivo)) {
  console.error("Uso: node scripts/restore-db.mjs <arquivo.jsonl>");
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const cliente = new pg.Client({ connectionString: (url ?? "").split("?")[0], ssl: { rejectUnauthorized: false } });

/** Ordem topológica das tabelas a partir das FKs do banco de destino. */
async function ordemDeInsercao(tabelas) {
  const { rows: fks } = await cliente.query(`
    SELECT tc.table_name AS filho, ccu.table_name AS pai
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  const pendentes = new Set(tabelas);
  const pais = new Map(tabelas.map((t) => [t, new Set()]));
  for (const { filho, pai } of fks) {
    // Auto-referência (ex.: User.lastWorkspaceId → Workspace) não impede a
    // tabela de entrar; ela se resolve na própria inserção.
    if (filho !== pai && pais.has(filho) && pendentes.has(pai)) pais.get(filho).add(pai);
  }

  const ordem = [];
  while (pendentes.size) {
    const prontas = [...pendentes].filter((t) => [...pais.get(t)].every((p) => !pendentes.has(p)));
    // Ciclo: solta o resto na ordem que estiver, para não travar o restore.
    const lote = prontas.length ? prontas : [...pendentes];
    for (const t of lote) {
      ordem.push(t);
      pendentes.delete(t);
    }
  }
  return ordem;
}

async function main() {
  await cliente.connect();
  const { rows: dbInfo } = await cliente.query(`SELECT current_database() AS db`);
  console.log(`Restaurando em: ${dbInfo[0].db} (${url?.match(/postgres\.([a-z0-9]+):/)?.[1] ?? "?"})`);

  // Carrega o arquivo agrupando por tabela. Os volumes aqui são de centenas de
  // linhas; se um dia virarem milhões, isto passa a precisar de streaming.
  const porTabela = new Map();
  let meta = null;
  const rl = readline.createInterface({ input: fs.createReadStream(arquivo), crlfDelay: Infinity });
  for await (const linha of rl) {
    if (!linha.trim()) continue;
    const obj = JSON.parse(linha);
    if (obj.__meta) { meta = obj; continue; }
    if (!porTabela.has(obj.t)) porTabela.set(obj.t, []);
    porTabela.get(obj.t).push(obj.r);
  }
  console.log(`Backup de ${meta?.geradoEm ?? "?"} · projeto ${meta?.projeto ?? "?"}`);

  // `_prisma_migrations` fica de fora: quem manda no estado das migrations é o
  // `prisma migrate deploy` rodado antes. Sobrescrever a tabela de controle com
  // a da origem é o caminho curto para um banco que "acha" que já migrou.
  const tabelas = [...porTabela.keys()].filter((t) => t !== "_prisma_migrations");
  const ordem = await ordemDeInsercao(tabelas);

  const resumo = [];
  for (const t of ordem) {
    const linhas = porTabela.get(t) ?? [];
    let ok = 0;
    for (const r of linhas) {
      // `jsonb_populate_record` devolve o tipo certo para cada coluna.
      // `ON CONFLICT DO NOTHING` torna o restore repetível sem quebrar.
      await cliente.query(
        `INSERT INTO "${t}" SELECT * FROM jsonb_populate_record(NULL::"${t}", $1::jsonb) ON CONFLICT DO NOTHING`,
        [JSON.stringify(r)],
      );
      ok += 1;
    }
    resumo.push({ tabela: t, linhas: ok });
  }

  console.table(resumo);
  console.log("\n✓ Restauração concluída.\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => cliente.end());
