-- Criptografia em repouso das credenciais (AES-256-GCM, ver src/lib/crypto/secrets.ts).
--
-- A coluna `key` da ApiCredential passa a guardar o ciphertext. Como o IV é
-- aleatório, ela não serve mais para buscar a credencial na autenticação —
-- por isso o `keyHash`, um hash determinístico da chave em texto puro.
--
-- Fica NULL aqui porque o hash não é calculável em SQL puro; o backfill dos
-- registros existentes é feito por `scripts/encrypt-secrets.mjs`.
ALTER TABLE "ApiCredential" ADD COLUMN "keyHash" TEXT;

CREATE UNIQUE INDEX "ApiCredential_keyHash_key" ON "ApiCredential"("keyHash");
