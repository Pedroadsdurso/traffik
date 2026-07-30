import { FAIXAS_B64, PAISES, TOTAL_FAIXAS } from "./ipCountryData";

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
 * ## ⚠️ IPv4 apenas, por enquanto
 *
 * O arquivo de IPv6 é quase o dobro e o tráfego brasileiro de origem de anúncio
 * ainda é majoritariamente IPv4. Um IPv6 devolve `null` — que é tratado como
 * "não identificado", nunca como um país errado.
 */

/** Decodificado uma vez por processo, na primeira consulta. */
let inicios: Uint32Array | null = null;
let indices: Uint8Array | null = null;

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
 * País (ISO-2) de um endereço IPv4, pela base local.
 *
 * `null` quando: não é IPv4, está num bloco sem país conhecido, ou a base não
 * cobre a faixa. **Nunca chuta** — "não identificado" é uma resposta melhor que
 * um país errado, que contaminaria o mapa e o ranking em silêncio.
 */
export function paisDoIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const alvo = ipv4ParaInt(ip.trim());
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
 */
export function resolverPais(header: (nome: string) => string | null, ip: string | null): string | null {
  return paisDoHeader(header) ?? paisDoIp(ip);
}
