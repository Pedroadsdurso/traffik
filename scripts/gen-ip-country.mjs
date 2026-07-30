/**
 * Gera a base local de IP → PAÍS a partir do `user-country` do `ip-location-db`.
 *
 *   npm run geo:atualizar
 *
 * ## De onde vem
 *
 * `github.com/sapics/ip-location-db`, dataset **`user-country`**, licença
 * **PDDL-1.0** (domínio público — não exige conta nem atribuição). O repositório
 * **não** usa WHOIS de RIR, porque as AUPs de vários RIRs proíbem usar aquelas
 * bases para mapeamento geográfico; usa registros de roteamento e geofeeds.
 *
 * ⚠️ **MaxMind e IP2Location LITE exigem cadastro** e por isso estão descartados.
 *
 * ## O que ele produz, e por que não é o CSV
 *
 * Os CSVs somam ~25 MB de texto. Buscar neles em runtime exigiria carregar e
 * parsear tudo a cada cold start. A saída aqui são **arrays binários ordenados**
 * e a busca vira **binária em memória** — microssegundos, sem I/O, sem parse.
 *
 * ### Cobertura CONTÍNUA em vez de guardar o fim de cada faixa
 *
 * Guardar `início + fim + país` custaria quase o dobro. Em vez disso, os buracos
 * entre faixas (blocos reservados, não alocados) viram entradas explícitas
 * apontando para "desconhecido". Com a cobertura contínua, **o fim de uma faixa
 * é o início da próxima**: a busca binária acha a última faixa cujo início é ≤ o
 * IP, e pronto.
 *
 * ## IPv6 truncado em /64 — e por que /64 e não menos
 *
 * Um IPv6 tem 128 bits, mas alocação geográfica nunca é mais específica que
 * `/64` na prática. Guardar os 128 bits dobraria o arquivo sem ganho.
 *
 * Medido nos três cortes candidatos, sobre o dataset real:
 *
 * | Prefixo | Entradas | Faixas perdidas | Binário |
 * |---|---|---|---|
 * | 64 (escolhido) | 330.372 | 12.417 (4,5%) | 2,84 MB |
 * | 56 | 262.590 | 87.061 (32%) | 2,00 MB |
 * | 48 | 240.242 | 104.720 (38%) | 1,60 MB |
 *
 * Os prefixos 56 e 48 economizam pouco e descartam um terço das faixas. As 4,5%
 * perdidas em 64 são alocações mais específicas que isso — atribuição de cliente
 * único, que herda o país do bloco que a contém, quase sempre correto.
 *
 * (Sem barra antes dos números: um `*` seguido de `/` fecharia este comentário.)
 *
 * ## ⚠️ A saída é COMMITADA
 *
 * Mesma escolha do `gen-world-paths.mjs` e do `public/*.js`: `npm run dev`
 * funciona sem passo extra e nenhum deploy sobe sem o arquivo. Rode este script
 * **mensalmente**, confira o resumo e commite.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/sapics/ip-location-db/main/user-country";
const SAIDA = path.join("src", "lib", "geo", "ipCountryData.ts");

/** IPv6 é truncado neste prefixo. Ver a tabela no cabeçalho. */
const BITS_V6 = 64;

/** `1.2.3.4` → inteiro de 32 bits. `null` se não for IPv4. */
function paraInt(ip) {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const parte of p) {
    const o = Number(parte);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

/**
 * IPv6 → BigInt de 128 bits. Aceita a forma comprimida (`::`).
 *
 * Só o gerador usa BigInt; o runtime **não** — ver `pais.ts`.
 */
function paraBig(ip) {
  const partes = ip.split("::");
  if (partes.length > 2) return null;
  const esq = partes[0] ? partes[0].split(":").filter(Boolean) : [];
  const dir = partes.length === 2 ? (partes[1] ? partes[1].split(":").filter(Boolean) : []) : null;
  const grupos =
    dir === null ? esq : [...esq, ...Array(8 - esq.length - dir.length).fill("0"), ...dir];
  if (grupos.length !== 8) return null;
  let n = 0n;
  for (const g of grupos) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

async function baixar(nome) {
  const url = `${BASE}/${nome}`;
  console.log(`Baixando ${nome} …`);
  const r = await fetch(url);
  if (!r.ok) {
    console.error(`✗ Falha ao baixar ${nome}: HTTP ${r.status}`);
    process.exit(1);
  }
  const txt = await r.text();
  console.log(`  ${(txt.length / 1024 / 1024).toFixed(1)} MB de CSV`);
  return txt;
}

// ── Tabela de países, COMPARTILHADA entre IPv4 e IPv6 ───────────────────────
// `\0` marca "sem país conhecido" — os buracos entre faixas e o espaço antes da
// primeira. Sem isso, um IP num bloco reservado herdaria o país da faixa
// anterior, que é pior que responder "não identificado".
const DESCONHECIDO = "\0";
const paises = [DESCONHECIDO];
const indiceDoPais = new Map([[DESCONHECIDO, 0]]);

function indicePara(pais) {
  let idx = indiceDoPais.get(pais);
  if (idx === undefined) {
    idx = paises.length;
    paises.push(pais);
    indiceDoPais.set(pais, idx);
  }
  return idx;
}

/**
 * Parse + cobertura contínua. Genérico sobre o tipo do endereço (Number para
 * IPv4, BigInt para IPv6) — a lógica é idêntica e duplicá-la faria as duas
 * divergirem no primeiro ajuste.
 */
function construir(csv, { parse, zero, um, max, rotulo }) {
  const faixas = [];
  let ignoradas = 0;
  for (const linha of csv.split("\n")) {
    if (!linha.trim()) continue;
    const [a, b, cc] = linha.split(",");
    const ini = parse(a ?? "");
    const fim = parse(b ?? "");
    const pais = (cc ?? "").trim().toUpperCase();
    if (ini === null || fim === null || !/^[A-Z]{2}$/.test(pais) || fim < ini) {
      ignoradas++;
      continue;
    }
    faixas.push({ ini, fim, pais });
  }
  faixas.sort((x, y) => (x.ini < y.ini ? -1 : x.ini > y.ini ? 1 : 0));
  console.log(
    `  ${faixas.length.toLocaleString("pt-BR")} faixas válidas em ${rotulo}` +
      (ignoradas ? `, ${ignoradas} ignoradas` : ""),
  );

  const inicios = [];
  const indices = [];
  let proximo = zero; // primeiro endereço ainda não coberto

  for (const f of faixas) {
    if (f.ini > proximo) {
      inicios.push(proximo);
      indices.push(0); // buraco
    } else if (f.ini < proximo) {
      // Faixas sobrepostas: a primeira (já gravada) vence. Pular evita que uma
      // faixa mais ampla sobrescreva uma mais específica que veio antes.
      if (f.fim < proximo) continue;
    }
    const idx = indicePara(f.pais);
    // Junta com a entrada anterior quando o país é o mesmo — encurta o array sem
    // perder informação.
    if (indices.length && indices[indices.length - 1] === idx && inicios[inicios.length - 1] <= f.ini) {
      proximo = f.fim + um;
      continue;
    }
    inicios.push(f.ini > proximo ? f.ini : proximo);
    indices.push(idx);
    proximo = f.fim + um;
  }
  if (proximo <= max) {
    inicios.push(proximo);
    indices.push(0);
  }

  console.log(`  ${inicios.length.toLocaleString("pt-BR")} entradas após juntar iguais e preencher buracos`);
  return { inicios, indices };
}

// ── IPv4 ────────────────────────────────────────────────────────────────────
const v4 = construir(await baixar("user-country-ipv4.csv"), {
  parse: paraInt,
  zero: 0,
  um: 1,
  max: 0xffffffff,
  rotulo: "IPv4",
});

// ── IPv6, truncado em /64 ───────────────────────────────────────────────────
const SHIFT = 128n - BigInt(BITS_V6);
const v6 = construir(await baixar("user-country-ipv6.csv"), {
  parse: (s) => {
    const n = paraBig(s);
    return n === null ? null : n >> SHIFT;
  },
  zero: 0n,
  um: 1n,
  max: (1n << BigInt(BITS_V6)) - 1n,
  rotulo: `IPv6 (/${BITS_V6})`,
});

// ⚠️ O índice do país é um Uint8. Com IPv4 e IPv6 compartilhando a tabela, o
// total pode passar de 255 — e aí o índice daria a volta em silêncio, mapeando
// um país para outro. Falhar aqui é a única forma de isso nunca chegar ao ar.
if (paises.length > 256) {
  console.error(`✗ ${paises.length} países não cabem num Uint8 (máx. 256 com o "desconhecido").`);
  console.error("  Troque o array de índices para Uint16Array em pais.ts e aqui.");
  process.exit(1);
}
console.log(`\n${paises.length - 1} países distintos (IPv4 + IPv6)`);

// ── Serialização ────────────────────────────────────────────────────────────
// IPv4: N × Uint32BE (início) seguido de N × Uint8 (índice do país).
const bufV4 = Buffer.alloc(v4.inicios.length * 5);
for (let i = 0; i < v4.inicios.length; i++) {
  bufV4.writeUInt32BE(v4.inicios[i] >>> 0, i * 4);
  bufV4.writeUInt8(v4.indices[i], v4.inicios.length * 4 + i);
}

// IPv6: os 64 bits do prefixo em DUAS metades de 32 (alto, depois baixo),
// seguidas dos índices. Duas metades em vez de um BigUint64 porque o runtime
// compara com números comuns — ver `pais.ts`.
const n6 = v6.inicios.length;
const bufV6 = Buffer.alloc(n6 * 9);
for (let i = 0; i < n6; i++) {
  const v = v6.inicios[i];
  bufV6.writeUInt32BE(Number((v >> 32n) & 0xffffffffn), i * 4);
  bufV6.writeUInt32BE(Number(v & 0xffffffffn), n6 * 4 + i * 4);
  bufV6.writeUInt8(v6.indices[i], n6 * 8 + i);
}

const conteudo = `/**
 * ⚠️ ARQUIVO GERADO — não edite à mão.
 *
 * Fonte: ip-location-db / user-country (PDDL-1.0).
 * Regenere com \`npm run geo:atualizar\` e commite a saída.
 *
 * Gerado em ${new Date().toISOString()}
 * IPv4: ${v4.inicios.length.toLocaleString("pt-BR")} faixas
 * IPv6: ${n6.toLocaleString("pt-BR")} faixas (prefixo /${BITS_V6})
 * ${paises.length - 1} países
 */

/** Códigos ISO-2. O índice 0 é "desconhecido" (buraco na cobertura). */
export const PAISES: readonly string[] = ${JSON.stringify(paises)};

/**
 * IPv4 em base64: \`N\` inteiros de 32 bits (início de cada faixa, big-endian)
 * seguidos de \`N\` bytes com o índice do país. A cobertura é CONTÍNUA, então o
 * fim de uma faixa é o início da próxima.
 */
export const FAIXAS_B64 =
  "${bufV4.toString("base64")}";

export const TOTAL_FAIXAS = ${v4.inicios.length};

/**
 * IPv6 em base64, truncado em /${BITS_V6}: \`N\` inteiros de 32 bits com a metade ALTA
 * do prefixo, \`N\` com a metade BAIXA, e \`N\` bytes com o índice do país. Mesma
 * cobertura contínua do IPv4.
 */
export const FAIXAS6_B64 =
  "${bufV6.toString("base64")}";

export const TOTAL_FAIXAS6 = ${n6};

/** Bits do prefixo IPv6 guardado. O runtime trunca o IP consultado no mesmo. */
export const BITS_IPV6 = ${BITS_V6};
`;

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, conteudo, "utf8");

const kb = (n) => (n / 1024).toFixed(0);
console.log(
  `\n✓ ${SAIDA} — ${kb(fs.statSync(SAIDA).size)} KB` +
    ` (${kb(bufV4.length)} KB IPv4 + ${kb(bufV6.length)} KB IPv6, binários)`,
);
console.log("  Confira o resumo acima e commite o arquivo.");
