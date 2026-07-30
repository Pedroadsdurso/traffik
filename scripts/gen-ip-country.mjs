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
 * O CSV tem ~8,7 MB e é texto. Buscar nele em runtime exigiria carregar e
 * parsear tudo a cada cold start. A saída aqui é um **array binário ordenado**:
 * `Uint32` com o início de cada faixa + `Uint8` com o índice do país. A busca
 * vira **binária em memória** — microssegundos, sem I/O, sem parse.
 *
 * ### Cobertura CONTÍNUA em vez de guardar o fim de cada faixa
 *
 * Guardar `início + fim + país` custaria 9 bytes por faixa. Em vez disso, os
 * buracos entre faixas (blocos reservados, não alocados) viram entradas
 * explícitas apontando para "desconhecido". Com a cobertura contínua, **o fim de
 * uma faixa é o início da próxima** e bastam 5 bytes: a busca binária acha a
 * última faixa cujo início é ≤ o IP, e pronto.
 *
 * ## ⚠️ A saída é COMMITADA
 *
 * Mesma escolha do `gen-world-paths.mjs` e do `public/*.js`: `npm run dev`
 * funciona sem passo extra e nenhum deploy sobe sem o arquivo. Rode este script
 * **mensalmente**, confira o resumo e commite.
 */
import fs from "node:fs";
import path from "node:path";

const URL_CSV =
  "https://raw.githubusercontent.com/sapics/ip-location-db/main/user-country/user-country-ipv4.csv";
const SAIDA = path.join("src", "lib", "geo", "ipCountryData.ts");

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

console.log(`Baixando ${URL_CSV} …`);
const resposta = await fetch(URL_CSV);
if (!resposta.ok) {
  console.error(`✗ Falha ao baixar: HTTP ${resposta.status}`);
  process.exit(1);
}
const csv = await resposta.text();
console.log(`  ${(csv.length / 1024 / 1024).toFixed(1)} MB de CSV`);

// ── Parse ───────────────────────────────────────────────────────────────────
/** @type {{ini:number, fim:number, pais:string}[]} */
const faixas = [];
let ignoradas = 0;
for (const linha of csv.split("\n")) {
  if (!linha) continue;
  const [a, b, cc] = linha.split(",");
  const ini = paraInt(a ?? "");
  const fim = paraInt(b ?? "");
  const pais = (cc ?? "").trim().toUpperCase();
  if (ini === null || fim === null || pais.length !== 2 || fim < ini) {
    ignoradas++;
    continue;
  }
  faixas.push({ ini, fim, pais });
}
faixas.sort((x, y) => x.ini - y.ini);
console.log(`  ${faixas.length.toLocaleString("pt-BR")} faixas válidas` + (ignoradas ? `, ${ignoradas} ignoradas` : ""));

// ── Cobertura contínua ──────────────────────────────────────────────────────
// `\0` marca "sem país conhecido" — os buracos entre faixas e o espaço antes da
// primeira. Sem isso, um IP num bloco reservado herdaria o país da faixa
// anterior, que é pior que responder "não identificado".
const DESCONHECIDO = "\0";
const paises = [DESCONHECIDO];
const indiceDoPais = new Map([[DESCONHECIDO, 0]]);
const inicios = [];
const indices = [];

let proximo = 0; // primeiro endereço ainda não coberto
for (const f of faixas) {
  if (f.ini > proximo) {
    inicios.push(proximo);
    indices.push(0); // buraco
  } else if (f.ini < proximo) {
    // Faixas sobrepostas: a primeira (já gravada) vence. Pular evita que uma
    // faixa mais ampla sobrescreva uma mais específica que veio antes.
    if (f.fim < proximo) continue;
  }
  let idx = indiceDoPais.get(f.pais);
  if (idx === undefined) {
    idx = paises.length;
    paises.push(f.pais);
    indiceDoPais.set(f.pais, idx);
  }
  // Junta com a entrada anterior quando o país é o mesmo — encurta o array sem
  // perder informação.
  if (indices.length && indices[indices.length - 1] === idx && inicios[inicios.length - 1] <= f.ini) {
    proximo = f.fim + 1;
    continue;
  }
  inicios.push(Math.max(f.ini, proximo));
  indices.push(idx);
  proximo = f.fim + 1;
}
if (proximo <= 0xffffffff) {
  inicios.push(proximo);
  indices.push(0);
}

console.log(`  ${inicios.length.toLocaleString("pt-BR")} entradas após juntar iguais e preencher buracos`);
console.log(`  ${paises.length - 1} países distintos`);

// ── Serialização ────────────────────────────────────────────────────────────
const buf = Buffer.alloc(inicios.length * 5);
for (let i = 0; i < inicios.length; i++) {
  buf.writeUInt32BE(inicios[i] >>> 0, i * 4);
  buf.writeUInt8(indices[i], inicios.length * 4 + i);
}
const b64 = buf.toString("base64");

const conteudo = `/**
 * ⚠️ ARQUIVO GERADO — não edite à mão.
 *
 * Fonte: ip-location-db / user-country (PDDL-1.0).
 * Regenere com \`npm run geo:atualizar\` e commite a saída.
 *
 * Gerado em ${new Date().toISOString()}
 * ${inicios.length.toLocaleString("pt-BR")} faixas · ${paises.length - 1} países
 */

/** Códigos ISO-2. O índice 0 é "desconhecido" (buraco na cobertura). */
export const PAISES: readonly string[] = ${JSON.stringify(paises)};

/**
 * Faixas em base64: \`N\` inteiros de 32 bits (início de cada faixa, big-endian)
 * seguidos de \`N\` bytes com o índice do país. A cobertura é CONTÍNUA, então o
 * fim de uma faixa é o início da próxima.
 */
export const FAIXAS_B64 =
  "${b64}";

export const TOTAL_FAIXAS = ${inicios.length};
`;

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, conteudo, "utf8");

const kb = (fs.statSync(SAIDA).size / 1024).toFixed(0);
console.log(`\n✓ ${SAIDA} — ${kb} KB (${(buf.length / 1024).toFixed(0)} KB binários)`);
console.log("  Confira o resumo acima e commite o arquivo.");
