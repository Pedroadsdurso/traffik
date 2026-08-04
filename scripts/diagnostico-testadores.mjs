/**
 * Diagnóstico da rodada de testes com usuários reais (04/08/2026).
 *
 * Responde três perguntas que só o dado de produção responde:
 *
 * | # | Pergunta | Item |
 * |---|---|---|
 * | 1 | Quanto do faturamento está ATRIBUÍDO a campanha, e quanto não está? | 1.1 e 2.4 |
 * | 2 | O que está acontecendo com a sincronização de cada testador? | 3.5 |
 * | 3 | Quantos cliques têm UTM com template não substituído? | Bloco B |
 *
 * ⚠️ **SÓ LEITURA — apenas `SELECT`.** Nenhum `UPDATE`, `DELETE` ou chamada à
 * Graph API. Pode rodar em produção.
 *
 * > ### ⛔ TUDO é recortado por `userId`
 * > É a regra que o `origem-venda.mjs` custou para aprender: um relatório que
 * > separa na EXIBIÇÃO e soma no CÁLCULO produz um número que não corresponde ao
 * > dashboard de ninguém — e é plausível o bastante para ninguém desconfiar.
 * > Aqui não existe total do banco. Se um número aparece, ele é de um dono.
 *
 * ## Uso
 *
 *   npm run diag:testadores -- --url "<conn>"
 *   npm run diag:testadores -- --url "<conn>" --dias 7
 *   npm run diag:testadores -- --url "<conn>" --email alguem@exemplo.com
 */
import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const arg = (nome, padrao = null) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : padrao;
};

const url = arg("--url") ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const dias = Number(arg("--dias", "7"));
const email = arg("--email");
if (!url) {
  console.error("✗ Sem DATABASE_URL/DIRECT_URL e sem --url.");
  process.exit(1);
}

const ref = (url.match(/postgres\.([a-z0-9]+)[:@]/) ?? [])[1] ?? "desconhecido";
const c = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });
const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
const brl = (n) => `R$ ${Number(n ?? 0).toFixed(2).replace(".", ",")}`;
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");

/**
 * Idade em linguagem humana, a partir de SEGUNDOS já calculados pelo Postgres.
 *
 * > ### 🔴 A idade é calculada no BANCO, nunca no cliente
 * > As colunas de data do Prisma são `timestamp WITHOUT time zone` guardando
 * > UTC. O `node-postgres` devolve isso como um `Date` interpretado no fuso da
 * > sessão — então `Date.now() - new Date(col)` compara um epoch real com um
 * > instante deslocado, e em São Paulo (UTC−3) **todo timestamp recente vira
 * > "no futuro"**. Foi exatamente o que aconteceu na primeira execução deste
 * > script, e mascarou o diagnóstico do sync.
 * >
 * > `EXTRACT(EPOCH FROM (timezone('UTC', now()) - col))` faz a subtração entre
 * > dois valores que o Postgres entende, e devolve um número puro. Não há data
 * > para o cliente interpretar errado.
 * >
 * > ⚠️ `timezone('UTC', now())` e não `now()` seco: `now()` é `timestamptz` e
 * > subtraí-lo de um `timestamp` faz o Postgres converter usando o fuso da
 * > SESSÃO — que reintroduz o mesmo erro pelo outro lado.
 */
function idade(seg) {
  if (seg == null) return `${C.r}nunca${C.x}`;
  const s = Math.floor(Number(seg));
  if (s < -60) return `${C.a}no futuro (${Math.abs(s)}s à frente — confira o relógio)${C.x}`;
  if (s < 90) return `${C.v}${Math.max(s, 0)}s atrás${C.x}`;
  const m = Math.floor(s / 60);
  if (m < 90) return `${m < 10 ? C.v : C.a}${m}min atrás${C.x}`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${C.r}${h}h atrás${C.x}`;
  return `${C.r}${Math.floor(h / 24)}d atrás${C.x}`;
}

async function main() {
  await c.connect();
  console.log(
    `\n${C.b}Diagnóstico dos testadores${C.x} — projeto ${C.b}${ref}${C.x} · janela de ${dias} dias  ${C.d}(só leitura)${C.x}`,
  );

  const { rows: usuarios } = await c.query(
    `SELECT u.id, u.email, u.timezone,
            (SELECT count(*)::int FROM "AdProfile" p WHERE p."userId" = u.id) AS perfis,
            (SELECT count(*)::int FROM "Sale" s WHERE s."userId" = u.id) AS vendas
       FROM "User" u
      WHERE ($1::text IS NULL OR u.email = $1)
      ORDER BY vendas DESC, u.email`,
    [email],
  );

  if (usuarios.length === 0) {
    console.log(`${C.r}Nenhum usuário encontrado.${C.x}`);
    return;
  }

  for (const u of usuarios) {
    // Usuário sem venda E sem perfil não tem o que diagnosticar — imprimir
    // dezenas deles esconderia os que importam.
    if (u.vendas === 0 && u.perfis === 0) continue;

    console.log(`\n${"─".repeat(78)}\n${C.b}${u.email}${C.x}  ${C.d}${u.id} · fuso ${u.timezone}${C.x}`);

    // ── 1. ATRIBUÍDO vs. TOTAL (itens 1.1 e 2.4) ────────────────────────────
    //
    // A pergunta que decide o 1.1: o ROI do Gerenciador divide por um
    // faturamento MENOR que o do Dashboard, porque só entra o que casou com
    // campanha. Se a diferença for grande, é ela que explica o número.
    //
    // ⚠️ A janela é a MESMA do produto: `timestamp` no fuso do usuário. Comparar
    // com uma janela em UTC reproduziria o bug de fuso que o projeto documenta.
    const { rows: [atr] } = await c.query(
      `WITH janela AS (
         SELECT s.id, s.value, s.status::text AS status, s."pedidoId", s."clickId",
                cl."utmCampaign" AS utm
           FROM "Sale" s
           LEFT JOIN "Click" cl ON cl.id = s."clickId"
          WHERE s."userId" = $1
            AND (s.timestamp AT TIME ZONE 'UTC' AT TIME ZONE $3)::date
                > ((now() AT TIME ZONE $3)::date - $2::int)
       )
       SELECT
         count(*) FILTER (WHERE status = 'APROVADA')::int              AS "linhasAprovadas",
         count(DISTINCT COALESCE("pedidoId", id))
           FILTER (WHERE status = 'APROVADA')::int                     AS "pedidosAprovados",
         COALESCE(sum(value) FILTER (WHERE status = 'APROVADA'), 0)    AS "brutoTotal",
         COALESCE(sum(value) FILTER (WHERE status = 'APROVADA'
                                       AND "clickId" IS NOT NULL), 0)  AS "brutoComClique",
         COALESCE(sum(value) FILTER (WHERE status = 'APROVADA'
                                       AND utm IS NOT NULL), 0)        AS "brutoComUtm",
         count(*) FILTER (WHERE status = 'APROVADA'
                            AND "clickId" IS NULL)::int                AS "semClique",
         count(*) FILTER (WHERE status = 'APROVADA'
                            AND "clickId" IS NOT NULL
                            AND utm IS NULL)::int                      AS "cliqueSemUtm"
         FROM janela`,
      [u.id, dias, u.timezone],
    );

    // Gasto do MESMO recorte. `DailyAdMetric.date` é `@db.Date` — comparar com
    // um instante jogaria a linha no bucket do dia anterior.
    const { rows: [gasto] } = await c.query(
      `SELECT COALESCE(sum(m.spend), 0) AS gasto
         FROM "DailyAdMetric" m
         JOIN "Ad" a  ON a.id = m."adId"
         JOIN "AdAccount" ac ON ac.id = a."adAccountId"
        WHERE ac."userId" = $1
          AND m.date > ((now() AT TIME ZONE $3)::date - $2::int)`,
      [u.id, dias, u.timezone],
    );

    const bruto = Number(atr.brutoTotal);
    const comUtm = Number(atr.brutoComUtm);
    const g = Number(gasto.gasto);

    console.log(`\n  ${C.b}1. Atribuição${C.x}  ${C.d}(o que explica o ROI divergente)${C.x}`);
    console.log(`     Faturamento aprovado (Dashboard) ..... ${C.b}${brl(bruto)}${C.x}`);
    console.log(`     Com clique casado .................... ${brl(atr.brutoComClique)}`);
    console.log(`     Com utm_campaign (Gerenciador) ....... ${C.b}${brl(comUtm)}${C.x}  ${C.d}${pct(comUtm, bruto)} do total${C.x}`);
    console.log(`     ${C.a}Não atribuído a campanha ............. ${brl(bruto - comUtm)}${C.x}`);
    console.log(`       ${C.d}· ${atr.semClique} venda(s) sem clique nenhum${C.x}`);
    console.log(`       ${C.d}· ${atr.cliqueSemUtm} venda(s) com clique mas sem utm_campaign${C.x}`);
    console.log(`     Gasto no período ..................... ${brl(g)}`);
    console.log(`     ${C.d}Vendas: ${atr.linhasAprovadas} linha(s) = ${atr.pedidosAprovados} pedido(s)${C.x}`);

    if (g > 0) {
      // As três contas que hoje se chamam "ROI" em algum lugar do produto.
      // Imprimir as três lado a lado é o que torna a divergência inegável.
      const descontos = Number((await c.query(
        `SELECT COALESCE(sum(CASE WHEN e.calc = 'PERCENTUAL' THEN 0 ELSE e.amount END), 0) AS fixo
           FROM "Expense" e WHERE e."userId" = $1 AND e.active
             AND e.type <> 'DESPESA_RECORRENTE'`,
        [u.id],
      )).rows[0].fixo);
      console.log(`\n     ${C.d}As três contas que hoje se chamam "ROI":${C.x}`);
      console.log(`       Dashboard   (lucro líq. ÷ custo total) ... ${C.d}precisa das taxas — ver a tela${C.x}`);
      console.log(`       Gerenciador (fat. atribuído − gasto) ÷ gasto = ${C.b}${((comUtm - g) / g).toFixed(2)}x${C.x}`);
      console.log(`       Se usasse o fat. TOTAL ................... ${((bruto - g) / g).toFixed(2)}x`);
      if (descontos) console.log(`       ${C.d}(há ${brl(descontos)} em descontos de valor fixo cadastrados)${C.x}`);
    }

    // ── 2. SINCRONIZAÇÃO (item 3.5) ─────────────────────────────────────────
    const { rows: perfis } = await c.query(
      `SELECT p.id, p."name" AS nome, p."syncLockedAt", p."tokenExpiresAt",
              EXTRACT(EPOCH FROM (timezone('UTC', now()) - p."lastSyncedAt"))  AS "idadeEstrutura",
              EXTRACT(EPOCH FROM (timezone('UTC', now()) - p."lastMetricsAt")) AS "idadeMetricas",
              EXTRACT(EPOCH FROM (timezone('UTC', now()) - p."syncLockedAt"))   AS "idadeLock",
              (p."tokenExpiresAt" IS NOT NULL
                 AND p."tokenExpiresAt" < timezone('UTC', now()))                AS "tokenVencido",
              (SELECT count(*)::int FROM "AdAccount" a WHERE a."adProfileId" = p.id) AS contas,
              (SELECT count(*)::int FROM "AdAccount" a
                WHERE a."adProfileId" = p.id AND a."trackingEnabled") AS "contasRastreando"
         FROM "AdProfile" p WHERE p."userId" = $1`,
      [u.id],
    );

    console.log(`\n  ${C.b}2. Sincronização com o Facebook${C.x}`);
    if (perfis.length === 0) {
      console.log(`     ${C.a}Nenhum perfil do Facebook conectado — o sync nunca roda para este usuário.${C.x}`);
    }
    for (const p of perfis) {
      // Mesmo motivo: nada de aritmética de data no cliente.
      const travado = p.idadeLock != null && Number(p.idadeLock) < 10 * 60;
      console.log(`     Perfil ${C.b}${p.nome ?? p.id}${C.x}`);
      console.log(`       Estrutura (lastSyncedAt) ... ${idade(p.idadeEstrutura)}   ${C.d}vence a cada 3min${C.x}`);
      console.log(`       Métricas  (lastMetricsAt) .. ${idade(p.idadeMetricas)}   ${C.d}vence a cada 20s${C.x}`);
      console.log(`       Contas ..................... ${p.contasRastreando} de ${p.contas} com rastreamento ligado`);
      if (p.contas > 0 && p.contasRastreando === 0) {
        console.log(`       ${C.r}✗ NENHUMA conta rastreando — o sync não tem o que buscar.${C.x}`);
      }
      if (travado) console.log(`       ${C.a}⚠ Reserva de sync ATIVA há ${Math.round(Number(p.idadeLock))}s${C.x}`);
      if (p.tokenVencido) {
        console.log(`       ${C.r}✗ TOKEN EXPIRADO — toda sincronização falha.${C.x}`);
      }
    }

    // A prova final de "o gasto está entrando?": a linha de métrica mais nova.
    // `lastMetricsAt` diz que TENTAMOS; isto diz que CHEGOU dado.
    const { rows: [ultima] } = await c.query(
      `SELECT EXTRACT(EPOCH FROM (timezone('UTC', now()) - max(m."updatedAt"))) AS "idadeGravada",
              max(m.date) AS dia
         FROM "DailyAdMetric" m
         JOIN "Ad" a ON a.id = m."adId"
         JOIN "AdAccount" ac ON ac.id = a."adAccountId"
        WHERE ac."userId" = $1`,
      [u.id],
    );
    console.log(`     Última métrica GRAVADA ....... ${idade(ultima?.idadeGravada)}  ${C.d}dia mais recente: ${ultima?.dia ? new Date(ultima.dia).toISOString().slice(0, 10) : "—"}${C.x}`);

    // ── 2b. POR CONTA: o sync roda e grava? ─────────────────────────────────
    //
    // 🔴 `lastMetricsAt` recente + nenhuma métrica nova NÃO é erro engolido.
    // `autoSyncSeNecessario` só avança esse relógio quando a sincronização
    // TERMINA COM SUCESSO — no `catch` ele libera a reserva e devolve
    // `modo: "erro"` sem tocar na data. Então relógio fresco significa que a
    // chamada à Graph **deu certo e não trouxe linha nenhuma**.
    //
    // As duas explicações possíveis são distinguíveis, e é isto que separa:
    //   · zero anúncios locais  → `adIdMap` vazio, todo insight vira órfão
    //   · anúncios existem      → a Meta não reportou gasto no período
    const { rows: contas } = await c.query(
      `SELECT ac.name, ac."trackingEnabled" AS rastreando,
              (SELECT count(*)::int FROM "Campaign" cp WHERE cp."adAccountId" = ac.id) AS campanhas,
              (SELECT count(*)::int FROM "Ad" a WHERE a."adAccountId" = ac.id)         AS anuncios,
              (SELECT max(m.date) FROM "DailyAdMetric" m
                 JOIN "Ad" a2 ON a2.id = m."adId"
                WHERE a2."adAccountId" = ac.id)                                        AS "ultimoDia",
              (SELECT COALESCE(sum(m.spend), 0) FROM "DailyAdMetric" m
                 JOIN "Ad" a3 ON a3.id = m."adId"
                WHERE a3."adAccountId" = ac.id
                  AND m.date > ((now() AT TIME ZONE $2)::date - 3))                    AS "gasto3d"
         FROM "AdAccount" ac
        WHERE ac."userId" = $1
        ORDER BY ac.name`,
      [u.id, u.timezone],
    );
    if (contas.length) {
      console.log(`     ${C.d}Por conta:${C.x}`);
      for (const a of contas) {
        const dia = a.ultimoDia ? new Date(a.ultimoDia).toISOString().slice(0, 10) : "—";
        const marca = a.anuncios === 0 ? `${C.r}✗ ZERO anúncios locais${C.x}` : `${a.anuncios} anúncio(s)`;
        console.log(
          `       ${a.name.slice(0, 26).padEnd(26)} ${a.rastreando ? "on " : `${C.a}off${C.x}`}` +
            ` · ${String(a.campanhas).padStart(3)} camp · ${marca}` +
            ` · última métrica ${dia} · gasto 3d ${brl(a.gasto3d)}`,
        );
      }
      const semAnuncio = contas.filter((a) => a.rastreando && a.anuncios === 0);
      if (semAnuncio.length) {
        console.log(
          `     ${C.r}✗ ${semAnuncio.length} conta(s) rastreando SEM anúncio local: o ciclo de métricas monta` +
            ` o mapa fbAdId→id a partir do banco, então TODO insight vira órfão e nada é gravado.${C.x}`,
        );
      } else if (contas.some((a) => Number(a.gasto3d) === 0)) {
        console.log(
          `     ${C.a}⚠ Há anúncios locais e gasto ZERO nos últimos 3 dias — o mais provável é que a Meta` +
            ` não tenha reportado entrega, não que o sync tenha falhado.${C.x}`,
        );
      }
    }

    // ── 3. VENDA SEM CLIQUE: por que nenhuma das 3 vias casou ───────────────
    //
    // `matchClick` tenta, nesta ordem: `click_id` público → `fbc` → IP (12h).
    // Aqui cada venda órfã é confrontada com o que o payload REALMENTE trouxe,
    // porque "não casou" tem causas diferentes e conserto diferente:
    //
    //   · payload sem click_id/fbc/ip → o checkout não propagou nada
    //   · payload COM o dado e sem match → o clique não existe no nosso banco
    //     (comprador que foi direto ao link do gateway, sem passar pelo site)
    const { rows: orfas } = await c.query(
      `SELECT s.id, s.product, s.value, s.platform, s.fbc, s.fbp,
              to_char(s.timestamp AT TIME ZONE 'UTC' AT TIME ZONE $2, 'DD/MM HH24:MI') AS quando,
              (s."rawPayload"::text ~* '"(click_id|clickId|trk_click_id)"')  AS "payloadClickId",
              (s."rawPayload"::text ~* '"(fbc|_fbc)"')                       AS "payloadFbc",
              (s."rawPayload"::text ~* '"(ip|buyer_ip|ip_address)"')         AS "payloadIp",
              (SELECT count(*)::int FROM "Click" k
                WHERE k."userId" = s."userId" AND NOT k.bot
                  AND k.timestamp BETWEEN s.timestamp - interval '12 hours' AND s.timestamp)
                                                                             AS "cliquesNaJanela"
         FROM "Sale" s
        WHERE s."userId" = $1 AND s.status = 'APROVADA' AND s."clickId" IS NULL
          AND (s.timestamp AT TIME ZONE 'UTC' AT TIME ZONE $2)::date
              > ((now() AT TIME ZONE $2)::date - $3::int)
        ORDER BY s.timestamp DESC LIMIT 20`,
      [u.id, u.timezone, dias],
    );

    if (orfas.length) {
      console.log(`
  ${C.b}3. Vendas SEM clique — por que nenhuma via casou${C.x}`);
      for (const o of orfas) {
        const vias = [
          o.payloadClickId ? `${C.v}click_id no payload${C.x}` : `${C.d}sem click_id${C.x}`,
          o.fbc || o.payloadFbc ? `${C.v}fbc${C.x}` : `${C.d}sem fbc${C.x}`,
          o.payloadIp ? `${C.v}ip${C.x}` : `${C.d}sem ip${C.x}`,
        ].join(" · ");
        console.log(`     ${o.quando}  ${brl(o.value)}  ${C.d}${(o.platform ?? "—")}${C.x}  ${o.product.slice(0, 28)}`);
        console.log(`       payload: ${vias}   ${C.d}· ${o.cliquesNaJanela} clique(s) seus nas 12h anteriores${C.x}`);
        // O veredito por venda. É a diferença entre "conserte o checkout" e
        // "esta pessoa nunca passou pelo seu site".
        const nada = !o.payloadClickId && !o.payloadFbc && !o.fbc && !o.payloadIp;
        if (nada) {
          console.log(`       ${C.r}→ o gateway não devolveu NENHUM identificador. Nem havia como casar.${C.x}`);
        } else if (o.cliquesNaJanela === 0) {
          console.log(`       ${C.a}→ havia identificador, e ZERO cliques seus na janela: o comprador não passou pelo site.${C.x}`);
        } else {
          console.log(`       ${C.r}→ havia identificador E havia cliques na janela: o match deveria ter acontecido. INVESTIGAR.${C.x}`);
        }
      }
    }

    // Os cliques carregam `clickId` público? É ele que o checkout precisa ecoar.
    const { rows: [prop] } = await c.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE "clickId" IS NOT NULL)::int AS "comId"
         FROM "Click" WHERE "userId" = $1`,
      [u.id],
    );
    console.log(
      `     ${C.d}Cliques com click_id emitido: ${prop.comId} de ${prop.total}` +
        ` — é este id que o checkout precisa devolver no webhook.${C.x}`,
    );

    // ── 3b. REGRAS COM FILTRO DE PRODUTO INERTE ─────────────────────────────
    //
    // A gaveta grava `targetProducts` (plural); o motor lê `targetProduct`
    // (singular, legado), que a gaveta nunca preenche. Uma regra restrita a um
    // produto **age sobre todos** — e o card ainda escreve o nome escolhido.
    // Este bloco mede o estrago antes de ligar o filtro.
    const { rows: [regras] } = await c.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE array_length("targetProducts", 1) > 0)::int      AS "comFiltro",
              count(*) FILTER (WHERE array_length("targetProducts", 1) > 0
                                 AND active)::int                                      AS "comFiltroAtivas",
              count(*) FILTER (WHERE "targetProduct" IS NOT NULL)::int                 AS "legadoPreenchido"
         FROM "AutomationRule" WHERE "userId" = $1`,
      [u.id],
    );
    if (regras.total > 0) {
      console.log(`
  ${C.b}3b. Regras com filtro de produto${C.x}`);
      console.log(`     ${regras.total} regra(s) · ${regras.comFiltro} com produto escolhido · ${C.b}${regras.comFiltroAtivas} dessas ATIVAS${C.x}`);
      console.log(`     ${C.d}campo legado que o motor realmente lê, preenchido em: ${regras.legadoPreenchido}${C.x}`);
      if (regras.comFiltroAtivas > 0) {
        console.log(`     ${C.r}✗ ${regras.comFiltroAtivas} regra(s) ATIVA(S) agindo sobre TODOS os produtos enquanto a tela diz o contrário.${C.x}`);
      }
    }

    // ── 4. UTM COM TEMPLATE NÃO SUBSTITUÍDO (Bloco B) ───────────────────────
    //
    // Cobre as duas formas: cru (`{{`) e percent-encoded (`%7B`). O `splitPipe`
    // hoje rejeita o ID (não numérico) e **aceita o NOME**, então estes cliques
    // entram no balde de atribuição por nome.
    const { rows: [tpl] } = await c.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE "utmCampaign" ~ '(\\{\\{|%7B)')::int AS campanha,
              count(*) FILTER (WHERE "utmContent"  ~ '(\\{\\{|%7B)')::int AS conteudo,
              count(*) FILTER (WHERE bot)::int                           AS robos
         FROM "Click"
        WHERE "userId" = $1
          AND ("utmCampaign" ~ '(\\{\\{|%7B)' OR "utmContent" ~ '(\\{\\{|%7B)'
               OR "utmMedium" ~ '(\\{\\{|%7B)' OR "utmTerm" ~ '(\\{\\{|%7B)')`,
      [u.id],
    );
    const { rows: [totalCliques] } = await c.query(
      `SELECT count(*)::int AS n FROM "Click" WHERE "userId" = $1`,
      [u.id],
    );
    const { rows: [vendasTpl] } = await c.query(
      `SELECT count(*)::int AS n, COALESCE(sum(s.value), 0) AS valor
         FROM "Sale" s JOIN "Click" cl ON cl.id = s."clickId"
        WHERE s."userId" = $1 AND s.status = 'APROVADA'
          AND cl."utmCampaign" ~ '(\\{\\{|%7B)'`,
      [u.id],
    );

    console.log(`\n  ${C.b}3. UTM com template não substituído${C.x}  ${C.d}(histórico completo)${C.x}`);
    console.log(`     Cliques afetados ............. ${C.b}${tpl.total}${C.x} de ${totalCliques.n}  ${C.d}${pct(tpl.total, totalCliques.n)}${C.x}`);
    console.log(`       ${C.d}· utm_campaign: ${tpl.campanha} · utm_content: ${tpl.conteudo} · já marcados como robô: ${tpl.robos}${C.x}`);
    console.log(`     ${C.a}Se reclassificados como tráfego direto:${C.x}`);
    console.log(`       ${tpl.total - tpl.robos} clique(s) sairiam da atribuição por campanha`);
    console.log(`       ${vendasTpl.n} venda(s) aprovada(s) (${brl(vendasTpl.valor)}) perderiam a campanha`);
    if (Number(vendasTpl.n) === 0) {
      console.log(`       ${C.v}✓ Nenhuma VENDA depende desses cliques — a reclassificação não move faturamento.${C.x}`);
    }
  }

  console.log(
    `\n${"─".repeat(78)}\n${C.d}Nada foi escrito. Todos os números acima são recortados por usuário —` +
      ` não existe total do banco neste relatório.${C.x}\n`,
  );
}

main()
  .catch((e) => {
    console.error(`${C.r}✗ ${e.message}${C.x}`);
    process.exitCode = 1;
  })
  .finally(() => c.end());
