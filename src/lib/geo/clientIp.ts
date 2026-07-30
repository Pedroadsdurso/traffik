/**
 * # IP do visitante — a única função que decide isso
 *
 * ## Por que existe
 *
 * Havia duas cópias de `clientIp(req)`, uma em `/api/track/click` e outra em
 * `/api/pixel/event`, ambas assim:
 *
 * ```ts
 * const fwd = req.headers.get("x-forwarded-for");
 * return fwd ? fwd.split(",")[0]!.trim() : req.headers.get("x-real-ip");
 * ```
 *
 * Isso funciona na Vercel e **quebra de duas formas** numa VPS:
 *
 * 1. **Atrás de nginx/Caddy sem `X-Forwarded-For`**, o IP visto é o do proxy
 *    (`127.0.0.1`) — e todo visitante viraria "não identificado".
 * 2. **Pegar o primeiro da lista é confiar no cliente.** `X-Forwarded-For` é um
 *    header comum: qualquer um manda `X-Forwarded-For: 8.8.8.8` e o servidor
 *    acredita. O proxy **acrescenta** o IP real ao FIM da cadeia; o começo é o
 *    que o cliente inventou.
 *
 * ## A regra: contar da DIREITA, não da esquerda
 *
 * ```
 *   X-Forwarded-For: <mentira do cliente>, <real>, <proxy1>, <proxy2>
 *                     ↑ nunca confiar                ↑ N proxies nossos
 * ```
 *
 * Com `N` proxies confiáveis à nossa frente, o IP real é o **N-ésimo a partir do
 * fim**. Tudo à esquerda dele é texto que o cliente escreveu.
 *
 * `PROXIES_CONFIAVEIS` (env) diz quantos são. Padrão **1**, que é o certo tanto
 * na Vercel quanto numa VPS com um nginx na frente.
 *
 * > ⚠️ **Errar esse número para MAIS é uma falha de segurança** (aceita um IP
 * > forjado); para MENOS, registra o IP do próprio proxy. Por isso o padrão é 1 e
 * > não um número "generoso".
 *
 * ## ⚠️ Endereço privado nunca é o visitante
 *
 * `127.0.0.1`, `10.x`, `172.16–31.x`, `192.168.x`, `::1` e afins são o proxy ou a
 * rede interna. Se a resolução cair num deles, devolve `null` — melhor não saber
 * do que gravar o país do datacenter.
 */

/** Quantos proxies nossos existem à frente da aplicação. */
function proxiesConfiaveis(): number {
  const n = Number(process.env.PROXIES_CONFIAVEIS ?? "1");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

/**
 * Limpa uma entrada de `X-Forwarded-For`.
 *
 * Trata: espaços, aspas, `unknown`, IPv4 com porta (`1.2.3.4:5678`) e IPv6 entre
 * colchetes com porta (`[::1]:443`). O IPv6 **sem** colchetes fica intacto — os
 * `:` dele não são separador de porta.
 */
export function normalizarIp(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let s = bruto.trim().replace(/^"|"$/g, "");
  if (!s || s.toLowerCase() === "unknown") return null;

  // [2001:db8::1]:443 -> 2001:db8::1
  const comColchetes = /^\[(.+)\](?::\d+)?$/.exec(s);
  if (comColchetes) s = comColchetes[1]!;
  // 1.2.3.4:5678 -> 1.2.3.4 (só quando há UM `:`, senão é IPv6)
  else if (s.includes(":") && s.split(":").length === 2 && s.includes(".")) s = s.split(":")[0]!;

  return ehIpValido(s) ? s.toLowerCase() : null;
}

export function ehIpValido(s: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) {
    return s.split(".").every((o) => Number(o) <= 255);
  }
  // IPv6: hexadecimais e `:`, com no máximo um `::`. Não valida a forma inteira —
  // o objetivo é descartar lixo, não ser um parser de RFC.
  return /^[0-9a-f:]+$/i.test(s) && s.includes(":") && (s.match(/::/g)?.length ?? 0) <= 1;
}

/**
 * Endereço de rede interna, loopback, link-local ou CGNAT — nunca é o visitante.
 */
export function ehIpPrivado(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "0.0.0.0" || s === "::") return true;
  // IPv6 privado: fc00::/7 (unique local) e fe80::/10 (link-local).
  if (s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) {
    return s.includes(":");
  }
  const p = s.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p as [number, number, number, number];
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC 6598)
  return false;
}

/** Só o que a função precisa de uma requisição — facilita testar sem `Request`. */
export interface FonteDeIp {
  /** Leitor de header, insensível a maiúsculas (o `Headers.get` já é). */
  header: (nome: string) => string | null;
  /**
   * IP da conexão TCP. Existe numa VPS (`req.socket.remoteAddress`), não na
   * Vercel. É o único valor que o cliente **não** consegue forjar.
   */
  ipDaConexao?: string | null;
}

/**
 * Resolve o IP do visitante.
 *
 * Ordem: headers de plataforma (não forjáveis, postos pela borda) →
 * `X-Forwarded-For` contado da direita → `X-Real-IP` → IP da conexão.
 */
export function extrairIpDoCliente(fonte: FonteDeIp): string | null {
  // 1. Headers postos pela PRÓPRIA plataforma, à frente de qualquer proxy nosso.
  //    A borda os reescreve a cada request, então não são forjáveis.
  for (const h of ["cf-connecting-ip", "x-vercel-forwarded-for", "true-client-ip"]) {
    const ip = normalizarIp(fonte.header(h));
    if (ip && !ehIpPrivado(ip)) return ip;
  }

  // 2. X-Forwarded-For, contado da DIREITA — ver o cabeçalho deste arquivo.
  const xff = fonte.header("x-forwarded-for");
  if (xff) {
    const cadeia = xff.split(",").map(normalizarIp);
    // Pula os proxies confiáveis do fim da cadeia.
    const alvo = cadeia.length - 1 - proxiesConfiaveis();
    const candidato = alvo >= 0 ? cadeia[alvo] : null;
    if (candidato && !ehIpPrivado(candidato)) return candidato;

    // A cadeia pode ser mais curta que o esperado (requisição interna, health
    // check, proxy que não acrescentou). Cai para o último público que houver —
    // nunca para o primeiro, que é justamente o que o cliente controla.
    for (let i = cadeia.length - 1; i >= 0; i--) {
      const ip = cadeia[i];
      if (ip && !ehIpPrivado(ip)) return ip;
    }
  }

  // 3. X-Real-IP — o que o nginx costuma pôr com `proxy_set_header X-Real-IP`.
  const real = normalizarIp(fonte.header("x-real-ip"));
  if (real && !ehIpPrivado(real)) return real;

  // 4. Conexão direta (sem proxy nenhum).
  const direto = normalizarIp(fonte.ipDaConexao);
  if (direto && !ehIpPrivado(direto)) return direto;

  // ⚠️ `null` de propósito: só sobrou endereço privado, ou seja o proxy. Gravar o
  // país do datacenter seria pior que não saber.
  return null;
}

/** Açúcar para uma `Request`/`NextRequest` do Next. */
export function ipDaRequisicao(req: { headers: { get: (n: string) => string | null } }): string | null {
  return extrairIpDoCliente({ header: (n) => req.headers.get(n) });
}
