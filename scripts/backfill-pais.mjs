/**
 * Backfill do país de cliques e vendas que ainda estão sem `country`.
 *
 * ## Por que existe, e por que ANTES do passo 3
 *
 * Até 30/07/2026 nada consultava a base `user-country`: o `Click.country` só era
 * preenchido se o script mandasse (nenhum manda) e o `Sale.country` só se o
 * gateway mandasse. O globo do Dashboard ficava vazio mesmo com tráfego real.
 *
 * O passo 1 (ligar `resolverPais()` nas rotas) resolve o tráfego NOVO. Este
 * script resolve o histórico, e **precisa rodar antes da anonimização do IP**:
 * o país só é derivável enquanto o IP ainda estiver legível. Depois do hash não
 * há como voltar — não existe PITR no Supabase Free.
 *
 * ## De onde sai o país de cada linha
 *
 * | Tabela | Fontes, em ordem |
 * |---|---|
 * | `Click` | `Click.ip` — é o IP do próprio visitante |
 * | `Sale`  | `country` do `rawPayload` (se ISO-2) → IP do comprador **no payload** → país do clique casado |
 *
 * > ### 🔴 A venda NUNCA herda país de IP de conexão
 * > O IP que chega num webhook é o do servidor do gateway. As fontes acima são
 * > as mesmas de `paisDaVenda()` em `webhook/ingestSale.ts`, de propósito: se
 * > divergissem, o backfill e a ingestão dariam respostas diferentes para a
 * > mesma venda.
 *
 * ## Uso
 *
 *   npm run geo:backfill                          # SIMULA (não escreve nada)
 *   npm run geo:backfill -- --aplicar             # escreve
 *   npm run geo:backfill -- --url "<conn>" --aplicar
 *
 * Sem `--aplicar` é só leitura e imprime exatamente o que faria. Com
 * `--aplicar`, passa pelo `guard-db.mjs` — em produção exige a autorização por
 * extenso, como todo script de escrita deste projeto.
 */
import "dotenv/config";
import pg from "pg";
import { normalizarPais, paisDoIp } from "@/lib/geo/pais";
import { ehIpPrivado, normalizarIp } from "@/lib/geo/clientIp";
import { isObj, pick, toStr } from "@/lib/webhook/normalizeSale";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const iUrl = args.indexOf("--url");
const url = iUrl >= 0 ? args[iUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url. Abortando.");
  process.exit(1);
}

const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";

if (aplicar) {
  // ⚠️ A trava lê `process.env.DATABASE_URL`. Com `--url` o alvo é OUTRO — sem
  // esta linha ela avaliaria o banco errado e liberaria a escrita indevidamente.
  process.env.DATABASE_URL = url;
  exigirBancoDeDesenvolvimento({ script: "backfill-pais" });
}

const cliente = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });

/** Motivo de uma linha continuar sem país — é o que explica o número final. */
const MOTIVOS = {
  sem_ip: "sem IP registrado",
  ip_privado: "IP de rede interna/proxy (não é o visitante)",
  ipv6: "IPv6 (a base cobre só IPv4)",
  fora_da_base: "IPv4 sem país conhecido na base",
};

/** Classifica por que um IP não virou país. Só roda quando `paisDoIp` falhou. */
function motivoDoIp(ipBruto) {
  const ip = normalizarIp(ipBruto);
  if (!ip) return "sem_ip";
  if (ehIpPrivado(ip)) return "ip_privado";
  if (ip.includes(":")) return "ipv6";
  return "fora_da_base";
}

function contar(mapa, chave) {
  mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
}

/** Grava `country` em lote, por id. Um único UPDATE por bloco de 500. */
async function gravar(tabela, pares) {
  let total = 0;
  for (let i = 0; i < pares.length; i += 500) {
    const bloco = pares.slice(i, i + 500);
    const valores = bloco.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(",");
    const params = bloco.flatMap(([id, pais]) => [id, pais]);
    const r = await cliente.query(
      `UPDATE "${tabela}" AS t SET "country" = v.c
         FROM (VALUES ${valores}) AS v(id, c)
        WHERE t."id" = v.id AND t."country" IS NULL`,
      params,
    );
    total += r.rowCount;
  }
  return total;
}

async function main() {
  await cliente.connect();
  const { rows: info } = await cliente.query("SELECT current_database() AS db");
  console.log(`\n\x1b[1mBackfill de país\x1b[0m — projeto \x1b[36m${ref}\x1b[0m (${info[0].db})`);
  console.log(aplicar ? "\x1b[33mMODO: APLICAR (vai escrever)\x1b[0m\n" : "MODO: simulação (nada será escrito)\n");

  // ── Cliques ────────────────────────────────────────────────────────────────
  // O clique é o único ponto em que o visitante fala direto conosco, então o
  // `ip` da linha é dele. É também a fonte que as vendas herdam depois.
  const { rows: cliques } = await cliente.query(
    `SELECT "id", "ip" FROM "Click" WHERE "country" IS NULL`,
  );
  const paresClique = [];
  const semPaisClique = new Map();
  for (const c of cliques) {
    const pais = paisDoIp(normalizarIp(c.ip));
    if (pais) paresClique.push([c.id, pais]);
    else contar(semPaisClique, motivoDoIp(c.ip));
  }

  const { rows: [totalCliques] } = await cliente.query(`SELECT count(*)::int AS n FROM "Click"`);
  console.log(`\x1b[1mCliques\x1b[0m — ${totalCliques.n} no total, ${cliques.length} sem país`);
  console.log(`  ✓ resolvidos: \x1b[32m${paresClique.length}\x1b[0m`);
  for (const [m, n] of [...semPaisClique].sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${n} sem país — ${MOTIVOS[m]}`);
  }
  const porPaisClique = new Map();
  for (const [, p] of paresClique) contar(porPaisClique, p);
  const topClique = [...porPaisClique].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topClique.length) console.log(`  ${topClique.map(([p, n]) => `${p} ${n}`).join(" · ")}`);

  if (aplicar && paresClique.length) {
    const n = await gravar("Click", paresClique);
    console.log(`  \x1b[32m${n} clique(s) atualizados.\x1b[0m`);
  }

  // ── Vendas ─────────────────────────────────────────────────────────────────
  // Roda DEPOIS dos cliques de propósito: a 3ª fonte é o país do clique casado,
  // que acabou de ser preenchido. Na ordem inversa, quase nada herdaria.
  const { rows: vendas } = await cliente.query(
    `SELECT s."id", s."rawPayload", c."country" AS "paisDoClique", c."ip" AS "ipDoClique"
       FROM "Sale" s LEFT JOIN "Click" c ON c."id" = s."clickId"
      WHERE s."country" IS NULL`,
  );
  const paresVenda = [];
  const semPaisVenda = new Map();
  const porFonte = new Map();
  for (const v of vendas) {
    const p = isObj(v.rawPayload) ? v.rawPayload : {};
    // As MESMAS chaves de `normalizeSale`, importadas do mesmo módulo — duplicar
    // a lista aqui faria o backfill divergir da ingestão sem ninguém notar.
    const doPayload = normalizarPais(toStr(pick(p, ["country", "pais", "customer.country", "country_code"]), 8));
    const ipDoComprador = normalizarIp(toStr(pick(p, ["ip", "buyer_ip", "customer.ip", "ip_address"]), 64));
    const doIp = paisDoIp(ipDoComprador);
    // Se o clique ainda não tinha país no banco, resolve pelo IP dele — o UPDATE
    // acima pode não ter rodado (simulação) ou a linha pode ter vindo antes.
    const doClique = normalizarPais(v.paisDoClique) ?? paisDoIp(normalizarIp(v.ipDoClique));

    const pais = doPayload ?? doIp ?? doClique;
    if (pais) {
      paresVenda.push([v.id, pais]);
      contar(porFonte, doPayload ? "payload" : doIp ? "IP do comprador no payload" : "clique casado");
    } else {
      contar(semPaisVenda, ipDoComprador || v.ipDoClique ? motivoDoIp(ipDoComprador ?? v.ipDoClique) : "sem_ip");
    }
  }

  const { rows: [totalVendas] } = await cliente.query(`SELECT count(*)::int AS n FROM "Sale"`);
  console.log(`\n\x1b[1mVendas\x1b[0m — ${totalVendas.n} no total, ${vendas.length} sem país`);
  console.log(`  ✓ resolvidas: \x1b[32m${paresVenda.length}\x1b[0m`);
  for (const [f, n] of [...porFonte].sort((a, b) => b[1] - a[1])) console.log(`      ${n} pela fonte: ${f}`);
  for (const [m, n] of [...semPaisVenda].sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${n} sem país — ${MOTIVOS[m]}`);
  }

  if (aplicar && paresVenda.length) {
    const n = await gravar("Sale", paresVenda);
    console.log(`  \x1b[32m${n} venda(s) atualizadas.\x1b[0m`);
  }

  if (!aplicar) {
    console.log("\n\x1b[33mNada foi escrito.\x1b[0m Repita com --aplicar quando os números acima fizerem sentido.");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
