/**
 * Simulação da purga progressiva de IP. **NUNCA escreve.**
 *
 * Existe para responder, com números conferíveis, o que a Fase B vai fazer
 * **antes** de qualquer escrita — e para provar a única coisa que não pode
 * acontecer: **país já resolvido sendo perdido no processo.**
 *
 * A anonimização é irreversível e o Supabase Free não tem PITR. `npm run backup`
 * é o único backup que existe.
 *
 *   npm run ip:simular                    # banco do .env
 *   npm run ip:simular -- --url "<conn>"  # produção
 *
 * ⚠️ Não tem `--aplicar` de propósito. Quem escreve é o cron
 * `/api/cron/manutencao`, diário e com teto por execução. Um script de escrita
 * manual aqui seria uma segunda porta para a mesma operação irreversível.
 */
import "dotenv/config";
import pg from "pg";
import { RETENCAO_DIAS, anonimizarIp, ehIpAnonimizado, podeIrParaCapi } from "@/lib/geo/anonimizarIp";

const iUrl = process.argv.indexOf("--url");
const url = iUrl >= 0 ? process.argv[iUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}
const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const cliente = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

/** Procura valores com cara de IPv4 em qualquer profundidade do JSON. */
function acharIps(obj, caminho = "", achados = []) {
  if (obj == null) return achados;
  if (typeof obj === "string") {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(obj.trim())) achados.push({ caminho, valor: obj.trim() });
    return achados;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => acharIps(v, `${caminho}[${i}]`, achados));
    return achados;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) acharIps(v, caminho ? `${caminho}.${k}` : k, achados);
  }
  return achados;
}

async function main() {
  await cliente.connect();
  console.log(`\n${C.b}Simulação da purga de IP${C.x} — projeto ${C.b}${ref}${C.x}`);
  console.log(`${C.d}Retenção: ${RETENCAO_DIAS} dias. NADA será escrito.${C.x}`);

  const corte = new Date(Date.now() - RETENCAO_DIAS * 864e5);

  // ── 1. Click.ip ─────────────────────────────────────────────────────────
  const { rows: cl } = await cliente.query(
    `SELECT count(*)::int AS "total",
            count(*) FILTER (WHERE "ip" IS NOT NULL)::int AS "comIp",
            count(*) FILTER (WHERE "ip" LIKE 'iph.v1.%')::int AS "jaAnon",
            count(*) FILTER (WHERE "ip" IS NOT NULL AND "ip" NOT LIKE 'iph.v1.%' AND "timestamp" < $1)::int AS "aPurgar",
            count(*) FILTER (WHERE "ip" IS NOT NULL AND "ip" NOT LIKE 'iph.v1.%' AND "timestamp" >= $1)::int AS "dentroDaJanela"
       FROM "Click"`,
    [corte],
  );
  const k = cl[0];
  console.log(`\n${C.b}1. Click.ip${C.x}`);
  console.log(`   ${k.total} cliques · ${k.comIp} com IP · ${k.jaAnon} já anonimizados`);
  console.log(`   ${C.a}${k.aPurgar} seriam anonimizados agora${C.x} (mais de ${RETENCAO_DIAS} dias)`);
  console.log(`   ${C.v}${k.dentroDaJanela} ficam legíveis${C.x} (dentro da janela — CAPI e match preservados)`);

  // ── 2. O que a CAPI perderia ────────────────────────────────────────────
  // Só interessa a venda que AINDA vai disparar CAPI, ou seja, as recentes.
  const { rows: capi } = await cliente.query(
    `SELECT count(*)::int AS "vendasComClique",
            count(*) FILTER (WHERE c."timestamp" < $1)::int AS "cliqueAntigo"
       FROM "Sale" s JOIN "Click" c ON c."id" = s."clickId"
      WHERE s."timestamp" > now() - interval '30 days'`,
    [corte],
  );
  console.log(`\n${C.b}2. Impacto na CAPI (vendas dos últimos 30 dias)${C.x}`);
  console.log(`   ${capi[0].vendasComClique} vendas com clique casado`);
  console.log(`   ${capi[0].cliqueAntigo} delas têm clique fora da retenção → ${C.d}perderiam client_ip_address${C.x}`);
  console.log(`   ${C.d}(omitir é melhor que enviar IP velho: ele provavelmente já é de outro assinante)${C.x}`);

  // ── 3. IP dentro dos payloads (a FASE A, adiada) ────────────────────────
  const { rows: vendas } = await cliente.query(`SELECT "rawPayload" FROM "Sale" WHERE "rawPayload" IS NOT NULL`);
  const { rows: logs } = await cliente.query(`SELECT "payloadRaw" FROM "WebhookLog" WHERE "payloadRaw" IS NOT NULL`);
  const chaves = new Map();
  let comIpVenda = 0;
  for (const v of vendas) {
    const a = acharIps(v.rawPayload);
    if (a.length) comIpVenda++;
    for (const x of a) chaves.set(x.caminho, (chaves.get(x.caminho) ?? 0) + 1);
  }
  let comIpLog = 0;
  for (const l of logs) if (acharIps(l.payloadRaw).length) comIpLog++;
  console.log(`\n${C.b}3. IP dentro dos payloads ${C.d}(FASE A — ADIADA)${C.x}`);
  console.log(`   ${comIpVenda} de ${vendas.length} Sale.rawPayload contêm IP`);
  console.log(`   ${comIpLog} de ${logs.length} WebhookLog.payloadRaw contêm IP`);
  if (chaves.size) {
    console.log(`   ${C.b}Chaves onde o IP aparece:${C.x}`);
    for (const [c, n] of [...chaves].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(4)}×  ${c}`);
    console.log(`   ${C.d}→ é assim que se descobre o nome que um gateway novo usa${C.x}`);
  }

  // ── 4. A garantia que mais importa ──────────────────────────────────────
  const { rows: pais } = await cliente.query(`
    SELECT (SELECT count(*)::int FROM "Click" WHERE "country" IS NOT NULL) AS "cliquesComPais",
           (SELECT count(*)::int FROM "Sale"  WHERE "country" IS NOT NULL) AS "vendasComPais"`);
  console.log(`\n${C.b}4. País já resolvido — NÃO pode ser tocado${C.x}`);
  console.log(`   ${pais[0].cliquesComPais} cliques e ${pais[0].vendasComPais} vendas com país`);
  console.log(`   ${C.v}A purga altera SOMENTE a coluna "ip". Nenhuma consulta dela lê ou escreve "country".${C.x}`);
  console.log(`   ${C.d}Confira: rode esta simulação de novo depois da 1ª execução do cron — os dois números têm de ser idênticos.${C.x}`);

  // ── 5. Prova das guardas ────────────────────────────────────────────────
  const exemplo = "187.45.192.1";
  const anon = anonimizarIp(exemplo);
  console.log(`\n${C.b}5. Guardas${C.x}`);
  console.log(`   ${exemplo} → ${anon.slice(0, 24)}…`);
  console.log(`   idempotente (re-anonimizar não muda): ${anonimizarIp(anon) === anon ? C.v + "sim" : C.r + "NÃO"}${C.x}`);
  console.log(`   CAPI aceita o IP em claro: ${podeIrParaCapi(exemplo) ? C.v + "sim" : C.r + "NÃO"}${C.x}`);
  console.log(`   CAPI recusa o anonimizado: ${!podeIrParaCapi(anon) ? C.v + "sim" : C.r + "NÃO"}${C.x}`);
  console.log(`   reconhece anonimizado: ${ehIpAnonimizado(anon) && !ehIpAnonimizado(exemplo) ? C.v + "sim" : C.r + "NÃO"}${C.x}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
