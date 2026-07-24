/**
 * Backfill: encripta em repouso as credenciais que ainda estão em texto puro.
 *
 *   node scripts/encrypt-secrets.mjs          # aplica
 *   node scripts/encrypt-secrets.mjs --dry    # só mostra o que faria
 *
 * Alvos:
 *   - ApiCredential.key      → ciphertext + preenche `keyHash` (usado no login da API)
 *   - MetaPixel.accessToken  → ciphertext
 *   - PixelConfig.accessToken (legado da Fase 10) → ciphertext
 *
 * É **idempotente**: valores que já têm o envelope `trkenc.v1.` são pulados,
 * então rodar duas vezes não encripta em cima do que já estava encriptado.
 *
 * Importa o mesmo módulo que a aplicação usa (Node faz o type-stripping do .ts);
 * duplicar a lógica de cripto aqui poderia divergir e corromper os dados.
 */
import "dotenv/config";
import pg from "pg";

import { encryptSecret, isEncrypted, secretLookupHash } from "../src/lib/crypto/secrets.ts";

const DRY = process.argv.includes("--dry");

if (!process.env.ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY não definida. Gere com `openssl rand -base64 32` e ponha no .env.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let totals = { encrypted: 0, skipped: 0 };

/** Encripta uma coluna de token simples (sem hash de busca). */
async function encryptColumn(table, column) {
  const { rows } = await client.query(`SELECT id, "${column}" AS val FROM "${table}" WHERE "${column}" IS NOT NULL`);
  let done = 0;
  let skip = 0;

  for (const row of rows) {
    if (isEncrypted(row.val)) {
      skip++;
      continue;
    }
    if (!DRY) {
      await client.query(`UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`, [encryptSecret(row.val), row.id]);
    }
    done++;
  }

  console.log(`${table}.${column}: ${done} encriptado(s), ${skip} já encriptado(s)`);
  totals.encrypted += done;
  totals.skipped += skip;
}

/** ApiCredential precisa também do hash determinístico para a autenticação. */
async function encryptApiCredentials() {
  const { rows } = await client.query(`SELECT id, key, "keyHash" FROM "ApiCredential"`);
  let done = 0;
  let skip = 0;

  for (const row of rows) {
    if (isEncrypted(row.key) && row.keyHash) {
      skip++;
      continue;
    }
    if (isEncrypted(row.key) && !row.keyHash) {
      // Não dá para recuperar o hash sem a chave em texto puro. Só acontece se
      // alguém encriptou a coluna por fora; avisa em vez de gravar lixo.
      console.warn(`  ! ApiCredential ${row.id}: já encriptada mas sem keyHash — a chave precisa ser recriada.`);
      skip++;
      continue;
    }
    if (!DRY) {
      await client.query(`UPDATE "ApiCredential" SET key = $1, "keyHash" = $2 WHERE id = $3`, [
        encryptSecret(row.key),
        secretLookupHash(row.key),
        row.id,
      ]);
    }
    done++;
  }

  console.log(`ApiCredential.key: ${done} encriptada(s) + keyHash, ${skip} já ok`);
  totals.encrypted += done;
  totals.skipped += skip;
}

console.log(DRY ? "== DRY RUN (nada será gravado) ==" : "== Encriptando credenciais em repouso ==");
await encryptApiCredentials();
await encryptColumn("MetaPixel", "accessToken");
await encryptColumn("PixelConfig", "accessToken");
console.log(`\nTotal: ${totals.encrypted} encriptado(s), ${totals.skipped} já estava(m) ok.`);

await client.end();
