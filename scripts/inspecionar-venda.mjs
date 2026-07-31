/**
 * Mostra uma venda campo a campo, para conferir contra o painel do gateway.
 *
 * ## Por que existe
 *
 * Depois de integrar um gateway novo, a pergunta é sempre a mesma: *"a venda
 * entrou COMPLETA?"*. Faturamento certo não prova isso — um parser pode acertar
 * o valor e descartar a taxa, o país, o agrupador do pedido ou o casamento com o
 * clique, e a tela continua parecendo correta.
 *
 * Ele diz, para cada campo, se foi preenchido **e o que significa estar vazio** —
 * porque a diferença entre "o gateway não manda" e "o parser não leu" é o que
 * distingue uma capacidade ausente de um bug. É o mesmo princípio do testador de
 * payload, aplicado ao que ficou GRAVADO.
 *
 * **Somente leitura.** Nenhum `UPDATE`, nenhum `DELETE`. Pode rodar em produção.
 *
 * ## Uso
 *
 *   npm run venda:inspecionar
 *   npm run venda:inspecionar -- --url '<conn de produção>'
 *   npm run venda:inspecionar -- --url '<conn>' --gateway CAKTO --n 3
 */
import "dotenv/config";

import pg from "pg";

import { REGISTRO } from "../src/lib/gateways/registro.ts";
import { utmsDaVenda } from "../src/lib/vendas/utmsDaVenda.ts";

const args = process.argv.slice(2);
const arg = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : padrao;
};
const url = arg("--url", process.env.DIRECT_URL || process.env.DATABASE_URL);
const gateway = arg("--gateway", null);
const quantas = Number(arg("--n", 1));

const cliente = new pg.Client({
  connectionString: String(url).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

const ref = /postgres\.([a-z0-9]+)/.exec(String(url))?.[1] ?? "(local)";
console.log(`\nBanco: ${ref}\n`);

const { rows } = await cliente.query(
  // ⚠️ As colunas do clique são ALIASADAS. `Sale` agora tem `utmCampaign` e
  // `fbclid` próprios (a cópia da procedência), e num `SELECT s.*, c."utmCampaign"`
  // o nome repetido faz o segundo sobrescrever o primeiro no objeto de linha —
  // o inspetor mostraria o clique achando que mostra a venda.
  `SELECT s.*, w.platform, w.name AS webhook_nome,
          c."clickId" AS clique_publico, c.country AS clique_pais,
          c."utmSource"   AS clique_utm_source,
          c."utmMedium"   AS clique_utm_medium,
          c."utmCampaign" AS clique_utm_campaign,
          c."utmContent"  AS clique_utm_content,
          c."utmTerm"     AS clique_utm_term,
          c."fbclid"      AS clique_fbclid
     FROM "Sale" s
     LEFT JOIN "Webhook" w ON w.id = s."webhookId"
     LEFT JOIN "Click"  c ON c.id = s."clickId"
    ${gateway ? `WHERE w.platform = $2` : ""}
    ORDER BY s."createdAt" DESC
    LIMIT $1`,
  gateway ? [quantas, gateway.toUpperCase()] : [quantas],
);

if (rows.length === 0) {
  console.log(gateway ? `Nenhuma venda do gateway ${gateway}.` : "Nenhuma venda.");
  await cliente.end();
  process.exit(0);
}

const brl = (v) => (v == null ? null : "R$ " + Number(v).toFixed(2).replace(".", ","));

for (const s of rows) {
  const def = REGISTRO[s.platform ?? "CUSTOM"] ?? REGISTRO.CUSTOM;
  const cap = def.capacidades;

  /**
   * @param rotulo  nome na tela
   * @param valor   o que está gravado
   * @param vazio   o que significa estar vazio — a parte que importa
   */
  const linha = (rotulo, valor, vazio) => {
    const preenchido = valor !== null && valor !== undefined && valor !== "";
    const cor = preenchido ? "\x1b[32m" : vazio?.grave ? "\x1b[33m" : "\x1b[90m";
    const texto = preenchido ? String(valor) : (vazio?.texto ?? "vazio");
    console.log(`  ${rotulo.padEnd(24)} ${cor}${texto}\x1b[0m`);
  };

  console.log(`\x1b[1m━━ ${s.product} · ${s.platform ?? "API"} ━━\x1b[0m`);

  console.log("\n  \x1b[1mComercial\x1b[0m");
  linha("Valor", brl(s.value));
  linha("Status", s.status);
  linha("Forma de pagamento", s.paymentMethod);
  linha("Id no gateway", s.externalId);

  console.log("\n  \x1b[1mPedido (conversão)\x1b[0m");
  linha("pedidoId", s.pedidoId, {
    texto: "vazio — esta venda é o próprio pedido (comportamento anterior à migration)",
  });
  linha("Tipo do item", s.itemTipo);

  console.log("\n  \x1b[1mFinanceiro reportado\x1b[0m");
  linha("Taxa do gateway", brl(s.taxaGateway), {
    grave: cap.taxasCalculadas,
    texto: cap.taxasCalculadas
      ? "🔴 VAZIO, e o registro diz que este gateway MANDA a taxa — o parser pode estar ignorando"
      : "este gateway não informa a taxa; o cálculo usa a que você cadastrou",
  });
  linha("Coprodução", brl(s.coproducao), {
    texto: "vazio = não sabemos (≠ zero). Cai na taxa cadastrada",
  });

  console.log("\n  \x1b[1mLocalização\x1b[0m");
  linha("País", s.country, {
    grave: true,
    texto: "🔴 sem país — não aparece no mapa nem no ranking",
  });
  linha("Como foi descoberto", s.countrySource, {
    texto: "vazio — venda anterior ao registro de procedência",
  });
  if (s.countrySource && !["payload", "ip"].includes(s.countrySource)) {
    console.log(`  ${"".padEnd(24)} \x1b[33m⚠ estimado, não medido — o ranking marca com chip âmbar\x1b[0m`);
  }
  if (!cap.ipDoComprador) {
    console.log(`  ${"".padEnd(24)} \x1b[90mo registro diz que este gateway NÃO manda o IP do comprador\x1b[0m`);
  }

  console.log("\n  \x1b[1mAtribuição\x1b[0m");
  linha("Casou com clique?", s.matchMethod === "none" ? null : s.matchMethod, {
    grave: true,
    texto: "🔴 nenhum clique casado — a venda não cola em campanha nenhuma",
  });
  linha("Clique (id público)", s.clique_publico);

  // Precedência de leitura resolvida pelo MESMO módulo que a aplicação usa —
  // `lib/vendas/utmsDaVenda.ts`. Duplicar a ordem aqui faria o diagnóstico
  // afirmar uma coisa e o produto fazer outra.
  const { utms, fonte } = utmsDaVenda({
    utmSource: s.utmSource,
    utmMedium: s.utmMedium,
    utmCampaign: s.utmCampaign,
    utmContent: s.utmContent,
    utmTerm: s.utmTerm,
    fbclid: s.fbclid,
    click: s.clique_publico
      ? {
          utmSource: s.clique_utm_source,
          utmMedium: s.clique_utm_medium,
          utmCampaign: s.clique_utm_campaign,
          utmContent: s.clique_utm_content,
          utmTerm: s.clique_utm_term,
          fbclid: s.clique_fbclid,
        }
      : null,
  });

  linha("Campanha", utms.utmCampaign, {
    grave: true,
    texto: "🔴 sem campanha — a venda não entra em ROAS, CPA nem no ranking de criativos",
  });
  linha("Criativo", utms.utmContent);
  linha("Fonte / meio", [utms.utmSource, utms.utmMedium].filter(Boolean).join(" / ") || null);
  linha("fbclid", utms.fbclid);
  console.log(
    `  ${"".padEnd(24)} \x1b[90mrespondido pelo ${
      fonte === "clique" ? "CLIQUE (a fonte)" : fonte === "copia" ? "CÓPIA na venda (o clique sumiu)" : "nada"
    }\x1b[0m`,
  );

  // A cópia é o seguro contra o clique ser apagado. Vazia com clique presente =
  // venda anterior à migration `20260731080000` → `npm run backfill:utms`.
  const temCopia = Boolean(s.utmSource || s.utmMedium || s.utmCampaign || s.utmContent || s.utmTerm || s.fbclid);
  if (s.clique_publico && !temCopia) {
    console.log(
      `  ${"".padEnd(24)} \x1b[33m⚠ sem cópia dos UTMs na venda — apagar o clique perderia a campanha. Rode: npm run backfill:utms\x1b[0m`,
    );
  }
  linha("_fbc da venda", s.fbc, {
    grave: cap.fbc,
    texto: cap.fbc ? "🔴 o registro diz que este gateway manda `fbc`" : "este gateway não manda `fbc`",
  });
  linha("_fbp da venda", s.fbp, {
    grave: cap.fbp,
    texto: cap.fbp ? "🔴 o registro diz que este gateway manda `fbp`" : "este gateway não manda `fbp`",
  });

  console.log("\n  \x1b[1mComprador\x1b[0m");
  linha("E-mail", s.buyerEmail);
  linha("Telefone", s.buyerPhone, { texto: "vazio — um sinal a menos na CAPI" });

  console.log("\n  \x1b[1mOrigem\x1b[0m");
  linha("Webhook", s.webhook_nome);
  linha("Credencial de API", s.apiCredentialId, { texto: "não veio por chave de API" });
  console.log(`  ${"Recebida em".padEnd(24)} ${s.createdAt.toISOString()}`);
  console.log();
}

// Os payloads recusados são os que mais importam para depurar.
const { rows: logs } = await cliente.query(
  `SELECT gateway, status, message, "httpStatus", "createdAt"
     FROM "WebhookLog" ${gateway ? "WHERE gateway = $1" : ""}
    ORDER BY "createdAt" DESC LIMIT 8`,
  gateway ? [gateway.toUpperCase()] : [],
);
if (logs.length) {
  console.log("\x1b[1mÚltimos payloads recebidos\x1b[0m\n");
  for (const l of logs) {
    const cor = l.status === "PROCESSADO" ? "\x1b[32m" : "\x1b[33m";
    console.log(
      `  ${cor}${l.status.padEnd(11)}\x1b[0m ${String(l.gateway).padEnd(9)} ${l.httpStatus ?? ""}  ${l.message ?? ""}`,
    );
  }
  console.log();
}

await cliente.end();
