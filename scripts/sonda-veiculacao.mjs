/**
 * Sonda: quais valores de `effective_status` a Meta devolve de VERDADE?
 *
 * ## Por que ela existe
 *
 * A tabela de tradução em `lib/ads/veiculacao.ts` veio da DOCUMENTAÇÃO da
 * Marketing API. Documentação envelhece e não é a sua conta. Esta sonda
 * responde com a resposta crua:
 *
 *   - quais valores aparecem, em cada nível, e quantas vezes;
 *   - quais deles a Traffik **ainda não traduz** (aparecem crus na tela);
 *   - quantas linhas estão configuradas como ACTIVE e **não entregam**;
 *   - se o `sync` já gravou a coluna, ou se ela ainda está toda nula.
 *
 * É o mesmo risco da base de países e do `AdSet.geoCountries`: campo que não
 * chega deixa a funcionalidade **inerte em silêncio** — a tela não muda de
 * jeito nenhum para denunciar. Ver o PROCEDIMENTO OBRIGATÓRIO no CLAUDE.md.
 *
 * ⚠️ SÓ LEITURA: `GET` na Graph API e `SELECT` no banco. Nada é escrito, nem na
 * Meta nem aqui. Pode rodar em produção.
 *
 * ## Uso
 *
 *   npm run ads:sonda                       # usa a DATABASE_URL do .env
 *   npm run ads:sonda -- --url "<conn>"     # produção
 *   npm run ads:sonda -- --url "<conn>" --cru   # despeja um objeto completo
 *
 * Custo na Graph API: **3 chamadas por conta rastreada** (campanhas, conjuntos
 * e anúncios).
 */
import "dotenv/config";
import pg from "pg";
import { GRAPH_URL } from "@/lib/facebook/graph";
import { decryptSecret } from "@/lib/crypto/secrets";
import { veiculacao } from "@/lib/ads/veiculacao";

/**
 * ⚠️ Cópia do `STATUS_SINCRONIZADOS` de `sync.ts` — de propósito, como a
 * `geo:sonda` duplica a extração de países. Se a sonda importasse a lista, um
 * objeto que o sync deixa de fora sairia daqui como "não existe", e o
 * diagnóstico confirmaria o próprio erro.
 */
const STATUS_DO_SYNC = [
  "ACTIVE", "PAUSED", "ARCHIVED", "ADSET_PAUSED", "CAMPAIGN_PAUSED",
  "DISAPPROVED", "PENDING_REVIEW", "IN_PROCESS", "WITH_ISSUES",
];

/**
 * A sonda consulta com uma lista MAIOR que a do sync, incluindo os dois que ele
 * não pede. Se aparecer objeto em `PREAPPROVED` ou `PENDING_BILLING_INFO`, ele
 * existe na conta e o sync **não o grava** — a linha some da ferramenta inteira,
 * e é justamente uma das que o usuário procura ("por que não está rodando?").
 */
const EXTRAS = ["PREAPPROVED", "PENDING_BILLING_INFO"];
const STATUS_DA_SONDA = JSON.stringify([...STATUS_DO_SYNC, ...EXTRAS]);

const args = process.argv.slice(2);
const mostrarCru = args.includes("--cru");
const iUrl = args.indexOf("--url");
const url = iUrl >= 0 ? args[iUrl + 1] : process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}
const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const cliente = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });

const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };

const NIVEIS = [
  { aresta: "campaigns", rotulo: "Campanhas", tabela: "Campaign" },
  { aresta: "adsets", rotulo: "Conjuntos", tabela: "AdSet" },
  { aresta: "ads", rotulo: "Anúncios", tabela: "Ad" },
];

async function main() {
  await cliente.connect();
  console.log(`\n${C.b}Sonda de veiculação (effective_status)${C.x} — projeto ${C.b}${ref}${C.x}`);

  // ── 1. O que está NO BANCO ──────────────────────────────────────────────
  console.log(`\n${C.b}1. No banco (o que o sync gravou)${C.x}`);
  let bancoVazio = true;
  for (const n of NIVEIS) {
    const { rows } = await cliente.query(
      `SELECT count(*)::int AS total,
              count("effectiveStatus")::int AS "comValor"
         FROM "${n.tabela}"`,
    );
    const { total, comValor } = rows[0];
    if (comValor > 0) bancoVazio = false;
    const cor = total === 0 ? C.d : comValor === 0 ? C.r : comValor < total ? C.a : C.v;
    console.log(`   ${n.rotulo.padEnd(11)} ${String(total).padStart(4)} linhas · ${cor}${comValor} com veiculação${C.x}`);
  }

  // ── 2. O que a GRAPH API devolve AGORA ──────────────────────────────────
  const { rows: contas } = await cliente.query(`
    SELECT a."fbAccountId", a."name", p."accessToken"
      FROM "AdAccount" a JOIN "AdProfile" p ON p."id" = a."adProfileId"
     WHERE a."trackingEnabled" = true AND p."accessToken" IS NOT NULL`);

  console.log(`\n${C.b}2. Na Graph API (a fonte)${C.x}`);
  if (!contas.length) {
    console.log(`   ${C.a}Nenhuma conta rastreada com token. Nada a consultar.${C.x}`);
    return;
  }

  /** valor cru → { total, porNivel, divergentes } */
  const vistos = new Map();
  let semCampo = 0;
  let totalObjetos = 0;
  let exemplo = null;
  const divergentesPorNivel = new Map();

  for (const conta of contas) {
    let token;
    try {
      token = decryptSecret(conta.accessToken);
    } catch {
      token = conta.accessToken; // token legado em texto puro
    }
    // ⚠️ O prefixo `act_` é obrigatório, e a produção guarda `fbAccountId` SEM
    // ele enquanto o seed de dev guarda COM. Mesma normalização da geo:sonda.
    const contaId = `act_${String(conta.fbAccountId).replace(/^act_/, "")}`;

    for (const n of NIVEIS) {
      const params = new URLSearchParams({
        // `effective_status` aparece duas vezes com papéis diferentes: campo a
        // LER e filtro de quais objetos trazer. É a distinção que o sync tinha
        // pela metade.
        fields: "id,name,status,effective_status",
        effective_status: STATUS_DA_SONDA,
        limit: "200",
        access_token: token,
      });
      const u = `${GRAPH_URL}/${contaId}/${n.aresta}?${params}`;
      const r = await fetch(u);
      const j = await r.json();
      if (!r.ok || j.error) {
        console.log(`   ${C.r}✗ ${conta.name} / ${n.rotulo}: ${j.error?.message ?? r.status}${C.x}`);
        console.log(`     ${C.d}${u.replace(/access_token=[^&]*/, "access_token=***")}${C.x}`);
        continue;
      }
      const lista = j.data ?? [];
      console.log(`   ${C.v}✓${C.x} ${conta.name} / ${n.rotulo} — ${lista.length}`);

      for (const o of lista) {
        totalObjetos++;
        const cru = o.effective_status;
        if (!cru) {
          semCampo++;
          continue;
        }
        if (!exemplo) exemplo = { nivel: n.rotulo, conta: conta.name, objeto: o };
        const e = vistos.get(cru) ?? { total: 0, niveis: new Set(), divergentes: 0 };
        e.total++;
        e.niveis.add(n.rotulo);
        if (o.status === "ACTIVE" && cru !== "ACTIVE") {
          e.divergentes++;
          divergentesPorNivel.set(n.rotulo, (divergentesPorNivel.get(n.rotulo) ?? 0) + 1);
        }
        vistos.set(cru, e);
      }
    }
  }

  // ── 3. Valores observados ───────────────────────────────────────────────
  console.log(`\n${C.b}3. Valores de effective_status OBSERVADOS${C.x}`);
  if (!vistos.size) {
    console.log(`   ${C.r}Nenhum — o campo não veio em objeto nenhum.${C.x}`);
  }
  const naoTraduzidos = [];
  const foraDoSync = [];
  for (const [cru, e] of [...vistos.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const v = veiculacao("ACTIVE", cru);
    if (v.desconhecido) naoTraduzidos.push(cru);
    if (!STATUS_DO_SYNC.includes(cru)) foraDoSync.push(cru);
    const marca = v.desconhecido ? `${C.a}não traduzido${C.x}` : `${C.d}→ "${v.rotulo}"${C.x}`;
    const div = e.divergentes ? ` ${C.a}· ${e.divergentes} com status ACTIVE${C.x}` : "";
    console.log(`   ${String(e.total).padStart(4)}  ${cru.padEnd(22)} ${marca}  ${C.d}[${[...e.niveis].join(", ")}]${C.x}${div}`);
  }
  if (semCampo) console.log(`   ${C.r}${semCampo} objeto(s) vieram SEM o campo.${C.x}`);

  // ── 4. Diagnóstico ──────────────────────────────────────────────────────
  console.log(`\n${C.b}4. Configurado ATIVO e NÃO entregando${C.x}`);
  const totalDiv = [...divergentesPorNivel.values()].reduce((s, n) => s + n, 0);
  if (!totalDiv) {
    console.log(`   ${C.v}Nenhum.${C.x} Tudo que está ligado está entregando.`);
  } else {
    for (const [nivel, n] of divergentesPorNivel) console.log(`   ${String(n).padStart(4)}  ${nivel}`);
    console.log(`   ${C.d}São estes que ganham o selo âmbar com ⚠ no Gerenciador.${C.x}`);
  }

  console.log(`\n${C.b}5. Veredito${C.x}`);
  if (totalObjetos === 0) {
    console.log(`   ${C.a}Nada consultado — nenhuma conta devolveu objeto.${C.x}`);
  } else if (semCampo === totalObjetos) {
    console.log(`   ${C.r}O CAMPO NÃO ESTÁ VINDO.${C.x} A coluna Veiculação vai ficar em "—" para sempre.`);
    console.log(`   Verifique a versão da Graph API e a permissão do token.`);
  } else {
    console.log(`   ${C.v}O campo vem: ${totalObjetos - semCampo} de ${totalObjetos} objetos.${C.x}`);
    if (bancoVazio) {
      console.log(`   ${C.a}⚠ Mas o BANCO está todo nulo — o sync ainda não rodou com o código novo.${C.x}`);
      console.log(`   Rode uma sincronização e repita esta sonda.`);
    }
  }
  if (naoTraduzidos.length) {
    console.log(`\n   ${C.a}⚠ Sem tradução em lib/ads/veiculacao.ts: ${naoTraduzidos.join(", ")}${C.x}`);
    console.log(`   ${C.d}Aparecem CRUS na tela. Acrescente ao MAPA — uma entrada cada.${C.x}`);
  }
  if (foraDoSync.length) {
    console.log(`\n   ${C.r}⚠ Existem na conta e o SYNC NÃO OS TRAZ: ${foraDoSync.join(", ")}${C.x}`);
    console.log(`   ${C.d}Não estão em STATUS_SINCRONIZADOS (sync.ts) — essas linhas não existem`);
    console.log(`   na ferramenta, nem com o filtro "Arquivados". Acrescente à lista de lá.${C.x}`);
  } else if (vistos.size) {
    console.log(`\n   ${C.v}✓ Todo valor observado está em STATUS_SINCRONIZADOS — nada some do sync.${C.x}`);
  }

  if (exemplo) {
    console.log(`\n${C.b}6. Exemplo REAL da resposta${C.x} (${exemplo.nivel} · ${exemplo.conta})`);
    console.log(JSON.stringify(exemplo.objeto, null, 2).split("\n").map((l) => "   " + l).join("\n"));
    const v = veiculacao(exemplo.objeto.status, exemplo.objeto.effective_status);
    console.log(`   ${C.d}→ na tela: "${v.rotulo}"${v.divergente ? " ⚠ (ligado e não entrega)" : ""}${C.x}`);
  }
  if (mostrarCru && exemplo) {
    console.log(`\n${C.b}7. JSON cru${C.x}`);
    console.log(JSON.stringify(exemplo.objeto, null, 2));
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
