import { createHash } from "node:crypto";

import { encryptionKey } from "@/lib/crypto/secrets";
import { ehIpValido } from "@/lib/geo/clientIp";

/**
 * # Anonimização progressiva do IP do visitante
 *
 * ## Por que PROGRESSIVA e não de uma vez
 *
 * `Click.ip` tem **três** consumidores, e um levantamento que só olhasse o
 * `matchClick` teria concluído que hashear era seguro:
 *
 * | Consumidor | Uso | Sobrevive ao hash? |
 * |---|---|---|
 * | `matchClick` | igualdade no `where` | ✅ (ver `candidatosDeIp`) |
 * | `dispatchPixel` → CAPI | **valor literal enviado à Meta** | 🔴 não |
 * | `/api/pixel/event` → CAPI | usa o IP da requisição, não o banco | ✅ |
 *
 * A Meta **recusa** `client_ip_address` hasheado — é um dos dois únicos campos
 * que ela exige em claro. Enviar um hash ali não faz a chamada falhar: degrada
 * em silêncio a correspondência de todo `Purchase`, que é o sinal que alimenta
 * a otimização das campanhas. Dinheiro real, sem erro e sem log.
 *
 * ## O prazo é o que torna a purga possível
 *
 * Os dois usos do IP **vencem**:
 *
 * - match por IP: **12 h** (`IP_WINDOW_MS` em `matchClick.ts`)
 * - atribuição da Meta: **7 dias por clique** no padrão
 *
 * Passado isso, o IP em claro não serve para nada — só fica guardado. Daí
 * `RETENCAO_DIAS = 7`: cobre o match com 14× de margem e a janela padrão da
 * Meta inteira.
 *
 * > ⚠️ A janela da Meta é configurável por conjunto (`attribution_spec`).
 * > Derivá-la da maior janela configurada seria mais correto que fixar 7 —
 * > registrado como melhoria futura, adiada por falta de volume.
 */

/** Dias que o IP fica legível antes de virar hash. Ver o cabeçalho. */
export const RETENCAO_DIAS = 7;

/**
 * Prefixo do envelope, no mesmo espírito do `trkenc.v1.` de `secrets.ts`.
 *
 * ⚠️ **É o que torna a purga IDEMPOTENTE.** Sem ele, cada execução re-hashearia
 * o hash anterior, e o valor mudaria a cada dia — quebrando o `matchClick` de
 * um jeito que só apareceria depois.
 *
 * ## 🔴 EXPORTADO EM 17/08/2026 — ele estava DUPLICADO, e a cópia era o `where`
 *
 * `cron/manutencao/route.ts` escrevia `NOT: { ip: { startsWith: "iph.v1." } }`
 * com o literal na mão, porque um `where` do Prisma não chama função. As duas
 * fontes **concordavam**, e é a concordância que faz a duplicata sobreviver até
 * o commit que mexe num lado só.
 *
 * ⛔ **O modo de falha ao subir para `iph.v2.`** — e ele é acumulativo e mudo:
 *
 * | passo | o que acontece |
 * |---|---|
 * | 1 | o `where` continua excluindo só `iph.v1.` |
 * | 2 | as linhas já anonimizadas em `v2` **entram** na seleção |
 * | 3 | `anonimizarIp` as devolve intactas (a guarda do prefixo pega) |
 * | 4 | 🔴 o teto de 5.000 é consumido por no-ops, e **a fila de IPs em claro nunca anda** |
 *
 * A purga roda, responde, grava `ok: true` no batimento — e não anonimiza nada.
 * Nada na saída distingue isso de "não havia o que fazer".
 *
 * ⚠️ Por isso a constante é `export`: o `where` importa o valor. `test:geo-guardas`
 * reprova se o literal voltar.
 */
export const PREFIXO_IP_ANONIMO = "iph.v1.";
const PREFIXO = PREFIXO_IP_ANONIMO;

/**
 * IP → hash determinístico, com sal da chave da aplicação.
 *
 * Determinístico de propósito: é o que preserva a **igualdade** de que o
 * `matchClick` depende. O sal (`ENCRYPTION_KEY`) é o que impede que o hash de um
 * IP seja calculado por quem tiver só o banco — sem ele, o espaço IPv4 inteiro
 * cabe numa rainbow table (são 4 bilhões de valores).
 *
 * ⚠️ Trocar a `ENCRYPTION_KEY` torna os hashes já gravados incomparáveis com os
 * novos, exatamente como acontece com os segredos encriptados. Não há rotação.
 */
export function anonimizarIp(ip: string): string {
  if (ehIpAnonimizado(ip)) return ip; // já anonimizado: não re-hasheia
  const h = createHash("sha256").update(encryptionKey()).update(ip.trim().toLowerCase()).digest("hex");
  return PREFIXO + h;
}

export function ehIpAnonimizado(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(PREFIXO);
}

/**
 * O valor pode ser enviado à Meta como `client_ip_address`?
 *
 * ⚠️ **Esta é a guarda que protege a CAPI**, e ela não confia no prefixo: pede
 * que o valor **pareça um IP**. Um SHA-256 tem 64 hexadecimais e nunca passa —
 * e qualquer outro lixo que apareça no campo também não.
 */
export function podeIrParaCapi(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim() !== "" && ehIpValido(v.trim());
}

/**
 * Os dois valores com que um IP pode estar gravado: em claro e anonimizado.
 *
 * Usado pelo `matchClick` para casar **independentemente de o clique já ter sido
 * purgado**. Hoje isso é redundante na prática — a janela de match (12 h) está
 * muito dentro da retenção (7 dias), então um clique purgado nunca entraria no
 * `where` de qualquer forma. É defensivo de propósito: se alguém baixar a
 * retenção ou ampliar a janela, o match continua funcionando em vez de
 * silenciosamente parar de casar.
 */
export function candidatosDeIp(ip: string | null | undefined): string[] {
  const s = ip?.trim();
  if (!s) return [];
  return ehIpAnonimizado(s) ? [s] : [s, anonimizarIp(s)];
}
