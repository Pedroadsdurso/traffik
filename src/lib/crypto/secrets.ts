/**
 * Criptografia simétrica das credenciais guardadas no banco (tokens da CAPI,
 * chaves de API). Usa AES-256-GCM — autenticado, então adulterar o valor no
 * banco faz o decrypt falhar em vez de devolver lixo.
 *
 * A chave vem de `ENCRYPTION_KEY` (gere com `openssl rand -base64 32`).
 *
 * Envelope: `trkenc.v1.<iv>.<tag>.<ciphertext>` (tudo base64url). O prefixo
 * permite distinguir um valor já encriptado de um texto puro legado — o
 * `decryptSecret` devolve o texto puro intacto, o que torna a migração dos
 * registros antigos idempotente.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "trkenc.v1.";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

/**
 * Resolve a chave de 32 bytes a partir da env var. Aceita base64 ou hex de 32
 * bytes; qualquer outra string vira sha256 dela, para não travar quem gerou a
 * chave de um jeito diferente.
 */
export function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não definida. Gere uma com `openssl rand -base64 32` e adicione ao .env.",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, "hex");
  } else {
    const b64 = Buffer.from(raw, "base64");
    cachedKey = b64.length === 32 ? b64 : createHash("sha256").update(raw).digest();
  }
  return cachedKey;
}

/** Só para os testes/scripts: descarta a chave memoizada. */
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encripta um segredo. Valores já encriptados passam direto (idempotente). */
export function encryptSecret(plain: string): string {
  if (isEncrypted(plain)) return plain;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return PREFIX + [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

/**
 * Decripta um segredo. Um valor sem o envelope é considerado texto puro legado
 * e devolvido como está — assim nada quebra antes da migração dos registros.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;

  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Segredo encriptado malformado.");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Igual ao `decryptSecret`, mas devolve `null` em vez de lançar. */
export function decryptSecretSafe(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    console.error("[secrets] falha ao decriptar — a ENCRYPTION_KEY mudou?");
    return null;
  }
}

/**
 * Hash determinístico usado para *procurar* um segredo no banco (a chave de API
 * chega na request e precisa virar um `where`). O ciphertext não serve para
 * isso porque o IV é aleatório. Recebe sal da própria ENCRYPTION_KEY, então não
 * é vulnerável a rainbow table mesmo com a coluna vazando.
 */
export function secretLookupHash(plain: string): string {
  return createHash("sha256").update(encryptionKey()).update(plain, "utf8").digest("hex");
}

/** Comparação de segredos em tempo constante. */
export function secretsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
