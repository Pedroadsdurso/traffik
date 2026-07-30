import {
  BITS_IPV6,
  FAIXAS6_B64,
  FAIXAS_B64,
  PAISES,
  TOTAL_FAIXAS,
  TOTAL_FAIXAS6,
} from "./ipCountryData";

/**
 * # IP → país, com base LOCAL
 *
 * ## ⛔ A base local é o caminho PRINCIPAL. O header da plataforma é atalho.
 *
 * O produto vai migrar da Vercel para uma **VPS**. Se `paisDoHeader()` achar um
 * `x-vercel-ip-country`, ótimo — evita a busca. Se não achar, cai aqui e o
 * resultado é **o mesmo**. **Nada pode depender do header para funcionar**,
 * senão a migração quebra a geolocalização inteira e o sintoma só aparece com
 * tráfego real já perdido.
 *
 * ## Como a busca funciona
 *
 * `ipCountryData.ts` traz as faixas com **cobertura contínua** — os buracos do
 * espaço IPv4 (blocos reservados) são entradas explícitas apontando para
 * "desconhecido". Por isso o fim de uma faixa é o início da próxima, e a busca é
 * uma **binária simples**: acha a última faixa cujo início é ≤ o IP.
 *
 * São ~19 comparações para 290 mil faixas. Sem I/O, sem parse, sem rede.
 *
 * ## IPv6 (30/07/2026)
 *
 * Cobertos desde que **100% das vendas sem país eram IPv6** — o clique chega
 * pelo navegador (o site é IPv4), mas o gateway registra o IP do comprador na
 * rede móvel/casa, onde o IPv6 já é padrão no Brasil. Sem isso, metade das
 * vendas ficaria sem país para sempre depois da anonimização.
 *
 * O prefixo é truncado em 64 bits — ver a tabela de custo em
 * `scripts/gen-ip-country.mjs`. (Escrito sem barra: `*` seguido de `/` fecharia
 * este comentário.)
 */

/** Decodificado uma vez por processo, na primeira consulta. */
let inicios: Uint32Array | null = null;
let indices: Uint8Array | null = null;
/** IPv6: as duas metades de 32 bits do prefixo /64, mais os índices. */
let alto6: Uint32Array | null = null;
let baixo6: Uint32Array | null = null;
let indices6: Uint8Array | null = null;

function carregar(): void {
  if (inicios) return;
  const buf = Buffer.from(FAIXAS_B64, "base64");
  const n = TOTAL_FAIXAS;
  // `Uint32Array` sobre o mesmo buffer exigiria alinhamento e ordem de bytes do
  // host; ler explicitamente em big-endian é portátil e roda uma vez só.
  const ini = new Uint32Array(n);
  for (let i = 0; i < n; i++) ini[i] = buf.readUInt32BE(i * 4);
  inicios = ini;
  indices = new Uint8Array(buf.subarray(n * 4, n * 5));
}

function carregar6(): void {
  if (alto6) return;
  const buf = Buffer.from(FAIXAS6_B64, "base64");
  const n = TOTAL_FAIXAS6;
  const a = new Uint32Array(n);
  const b = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = buf.readUInt32BE(i * 4);
    b[i] = buf.readUInt32BE(n * 4 + i * 4);
  }
  alto6 = a;
  baixo6 = b;
  indices6 = new Uint8Array(buf.subarray(n * 8, n * 9));
}

/** `1.2.3.4` → inteiro de 32 bits. `null` se não for um IPv4 válido. */
export function ipv4ParaInt(ip: string): number | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  let n = 0;
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

/**
 * IPv6 → as duas metades de 32 bits do prefixo `/64`.
 *
 * ⚠️ **Sem BigInt, de propósito.** Isto roda em toda requisição de clique e em
 * toda venda; BigInt aloca no heap a cada operação. Dois `number` de 32 bits
 * cabem exatos num double e comparam-se lexicograficamente.
 *
 * Aceita a forma comprimida (`::`), IPv4-mapeado (`::ffff:1.2.3.4` → tratado
 * como IPv4 por quem chama) e zona de escopo (`%eth0`), que é descartada.
 */
export function ipv6ParaPrefixo(ip: string): { alto: number; baixo: number } | null {
  if (BITS_IPV6 !== 64) throw new Error("ipv6ParaPrefixo assume prefixo /64");

  const semZona = ip.split("%")[0]!.trim().toLowerCase();
  const partes = semZona.split("::");
  if (partes.length > 2) return null;

  const esq = partes[0] ? partes[0].split(":") : [];
  const dir = partes.length === 2 ? (partes[1] ? partes[1].split(":") : []) : null;
  // Só o prefixo /64 importa, mas a expansão do `::` precisa do total de grupos.
  const grupos =
    dir === null ? esq : [...esq, ...Array(8 - esq.length - dir.length).fill("0"), ...dir];
  if (grupos.length !== 8) return null;

  let alto = 0;
  let baixo = 0;
  for (let i = 0; i < 4; i++) {
    const g = grupos[i]!;
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const v = parseInt(g, 16);
    // Os 4 primeiros grupos são o /64: os 2 primeiros na metade alta.
    if (i < 2) alto = alto * 0x10000 + v;
    else baixo = baixo * 0x10000 + v;
  }
  return { alto: alto >>> 0, baixo: baixo >>> 0 };
}

/** País de um IPv6, pelo prefixo /64. `null` quando a base não cobre. */
function paisDoIpv6(ip: string): string | null {
  const p = ipv6ParaPrefixo(ip);
  if (!p) return null;

  carregar6();
  const a = alto6!;
  const b = baixo6!;

  // Busca binária lexicográfica sobre (alto, baixo) — a última faixa cujo
  // prefixo é ≤ o consultado.
  let lo = 0;
  let hi = a.length - 1;
  let achado = -1;
  while (lo <= hi) {
    const meio = (lo + hi) >>> 1;
    const menorOuIgual = a[meio]! < p.alto || (a[meio]! === p.alto && b[meio]! <= p.baixo);
    if (menorOuIgual) {
      achado = meio;
      lo = meio + 1;
    } else {
      hi = meio - 1;
    }
  }
  if (achado < 0) return null;

  const pais = PAISES[indices6![achado]!];
  return pais && pais !== "\0" ? pais : null;
}

/**
 * País (ISO-2) de um endereço IPv4, pela base local.
 *
 * `null` quando: não é IPv4, está num bloco sem país conhecido, ou a base não
 * cobre a faixa. **Nunca chuta** — "não identificado" é uma resposta melhor que
 * um país errado, que contaminaria o mapa e o ranking em silêncio.
 */
export function paisDoIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const s = ip.trim();

  // IPv4-mapeado (`::ffff:187.45.192.1`) é um IPv4 escrito em notação IPv6 — a
  // base de IPv6 não o cobre, mas a de IPv4 sim. Sem este desvio, todo cliente
  // atrás de um proxy dual-stack cairia em "não identificado".
  const mapeado = /^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i.exec(s);
  const puro = mapeado ? mapeado[1]! : s;

  if (puro.includes(":")) return paisDoIpv6(puro);

  const alvo = ipv4ParaInt(puro);
  if (alvo === null) return null;

  carregar();
  const ini = inicios!;
  const idx = indices!;

  // Busca binária: a última faixa cujo início é ≤ alvo.
  let lo = 0;
  let hi = ini.length - 1;
  let achado = -1;
  while (lo <= hi) {
    const meio = (lo + hi) >>> 1;
    if (ini[meio]! <= alvo) {
      achado = meio;
      lo = meio + 1;
    } else {
      hi = meio - 1;
    }
  }
  if (achado < 0) return null;

  const pais = PAISES[idx[achado]!];
  // O índice 0 é o marcador de buraco (`"\0"`), não um país.
  return pais && pais !== "\0" ? pais : null;
}

/**
 * País vindo de um header da plataforma, quando existir.
 *
 * ⚠️ **Otimização, não dependência.** Existe na Vercel e na Cloudflare; numa VPS
 * não existe, e aí `paisDoIp` resolve com o mesmo resultado.
 */
export function paisDoHeader(header: (nome: string) => string | null): string | null {
  for (const h of ["x-vercel-ip-country", "cf-ipcountry"]) {
    const v = header(h)?.trim().toUpperCase();
    // A Cloudflare usa "XX" para desconhecido e "T1" para tráfego Tor.
    if (v && v.length === 2 && v !== "XX" && v !== "T1") return v;
  }
  return null;
}

/**
 * Resolve o país de uma requisição: header primeiro (barato), base local depois.
 *
 * É esta a função que as rotas devem chamar — não as duas separadas.
 *
 * > ### 🔴 Só serve quando quem FEZ a requisição é o visitante
 * > Num webhook de gateway, quem abre a conexão é o servidor da Kirvano — o
 * > header e o IP da conexão são do **gateway**, não do comprador. Chamar isto
 * > ali carimbaria toda venda com o país do datacenter, em silêncio e de forma
 * > plausível. Ver `paisDaVenda()` em `webhook/ingestSale.ts`.
 */
export function resolverPais(header: (nome: string) => string | null, ip: string | null): string | null {
  return paisDoHeader(header) ?? paisDoIp(ip);
}

/**
 * Normaliza um país vindo de payload de gateway para ISO-2 maiúsculo.
 *
 * ⚠️ **Aceita SÓ o que já é ISO-2.** Gateways mandam `"BR"`, mas também
 * `"Brasil"`, `"BRA"` e `"brazil"` — e um `"BRASIL"` gravado na coluna não casa
 * com nada no mapa nem no ranking, ficando como um país fantasma. Devolver
 * `null` para o resto é o que deixa a resolução por IP assumir, que acerta.
 */
export function normalizarPais(v: string | null | undefined): string | null {
  const s = v?.trim().toUpperCase();
  return s && /^[A-Z]{2}$/.test(s) ? s : null;
}
