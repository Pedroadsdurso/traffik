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

  /**
   * ⛔ A GUARDA CONTA AS PARTES; ELA NÃO PERGUNTA SE CADA UMA É "VAZIA".
   *
   * 🔴 Ela era `if (!ivB64 || !tagB64 || !ctB64)`, e `""` é falsy. Um
   * ciphertext vazio é a codificação **correta** de um texto claro vazio — o
   * envelope de `encryptSecret("")` termina em ponto —, e a guarda o lia como
   * envelope truncado. Ou seja: **este módulo produzia um valor que ele próprio
   * recusava.**
   *
   * É a distinção central deste projeto na camada de string: *ausência de
   * parte* (o envelope veio cortado) não é *parte vazia* (a parte existe e mede
   * zero). Contar as partes separa as duas; testar a verdade de cada uma
   * colapsa.
   *
   * ### 🔴 O CUSTO NÃO ERA A EXCEÇÃO — ERA A MENSAGEM
   *
   * `decryptSecretSafe` engolia e registrava *"a ENCRYPTION_KEY mudou?"*, que é
   * a causa errada, e a mais assustadora que existe aqui: **não há rotação de
   * chave**, então "a chave mudou" se lê como *todo segredo do banco está
   * ilegível*. Alguém seguiria essa pista por horas.
   *
   * ⚠️ **`iv` e `tag` seguem sendo checados por verdade, e é correto:** os dois
   * têm tamanho fixo (12 e 16 bytes) e nunca são vazios num envelope real.
   * Só o ciphertext pode legitimamente medir zero.
   *
   * ⚠️ Até 14/08/2026 isto era inalcançável em produção por **proteção
   * acidental**: os dois chamadores guardavam o vazio cada um do seu jeito (a
   * chave é gerada; o token passa por um ternário). Nenhuma dessas guardas era
   * propriedade deste módulo, e as duas sumiriam no dia de um terceiro
   * chamador. Agora a propriedade mora aqui.
   */
  const partes = stored.slice(PREFIX.length).split(".");
  const [ivB64, tagB64, ctB64] = partes;
  if (partes.length !== 3 || !ivB64 || !tagB64) throw new Error("Segredo encriptado malformado.");

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
