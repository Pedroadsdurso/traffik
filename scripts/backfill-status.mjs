/**
 * Reclassifica vendas já gravadas cujo status ficou errado por um evento que o
 * parser não conhecia.
 *
 * ## O bug que ele conserta
 *
 * `PIX_EXPIRED` não estava no mapa de eventos da Kirvano e caía num fallback que
 * só reconhecia `"APPROVED"` — então virava **PENDENTE**, apesar de o payload
 * trazer `status: "CANCELED"`. `ABANDONED_CART` estava mapeado como PENDENTE de
 * propósito, o que misturava "desistiu" com "vai pagar".
 *
 * Medido na produção em 30/07/2026: **13 das 14 vendas pendentes** estavam
 * erradas, R$ 512,35 exibidos contra R$ 169,80 reais.
 *
 * ## Como ele decide
 *
 * Reprocessa o `Sale.rawPayload` pelo parser ATUAL e compara com o status
 * gravado. Não há adivinhação: o payload é o mesmo que o gateway mandou.
 *
 * ⛔ **Só aplica quando o status novo é MAIS FORTE que o gravado**, pela mesma
 * tabela do upsert monotônico. Uma venda que já está APROVADA nunca é rebaixada
 * por um evento antigo — é a regra 2 do contrato valendo também aqui.
 *
 * ## Uso
 *
 *   npm run backfill:status                      # SIMULA (não escreve nada)
 *   npm run backfill:status -- --url '<conn>'    # simula contra outro banco
 *   ALLOW_PROD_WRITES=EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO \
 *     npm run backfill:status -- --url '<conn>' --aplicar
 *
 * ⚠️ Rode **depois** de `prisma migrate deploy` — os status EXPIRADA e
 * ABANDONADA precisam existir no enum do banco.
 */
import "dotenv/config";

import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
import { REGISTRO } from "../src/lib/gateways/registro.ts";

const args = process.argv.slice(2);
const iUrl = args.indexOf("--url");
if (iUrl >= 0) {
  // ⚠️ Reescreve a env ANTES do guard: sem isto a trava avaliaria o banco do
  // `.env` e liberaria a escrita achando que é dev.
  process.env.DATABASE_URL = args[iUrl + 1];
  process.env.DIRECT_URL = args[iUrl + 1];
}
const aplicar = args.includes("--aplicar");
if (aplicar) exigirBancoDeDesenvolvimento({ script: "backfill-status" });

const cliente = new pg.Client({
  connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL).split("?")[0],
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

/** Mesma tabela de força do `ingestSale`. Duplicada de propósito — ver o fim. */
const FORCA = {
  ABANDONADA: 0,
  PENDENTE: 1,
  EXPIRADA: 2,
  APROVADA: 3,
  REEMBOLSADA: 4,
  CHARGEBACK: 4,
  CANCELADA: 4,
};

const { rows } = await cliente.query(
  `SELECT s.id, s.status, s.value, s."externalId", s."rawPayload", w.platform
     FROM "Sale" s LEFT JOIN "Webhook" w ON w.id = s."webhookId"
    WHERE s."rawPayload" IS NOT NULL`,
);

const mudancas = [];
const ignoradas = [];

for (const v of rows) {
  const def = REGISTRO[v.platform ?? "CUSTOM"] ?? REGISTRO.CUSTOM;
  let novo;
  try {
    novo = def.parse(v.rawPayload).vendas[0]?.status;
  } catch {
    continue;
  }
  if (!novo || novo === v.status) continue;

  // ⛔ Nunca mexe em venda APROVADA ou terminal.
  //
  // ⚠️ A primeira versão desta guarda usava `FORCA[novo] <= FORCA[atual]`, e
  // rodar contra linhas semeadas mostrou que ela **recusava a própria correção**:
  // `PENDENTE → ABANDONADA` é um rebaixamento na tabela de força, e é exatamente
  // o conserto do carrinho abandonado. A guarda estava certa para o upsert em
  // tempo real e errada aqui.
  //
  // A diferença: no upsert, dois EVENTOS disputam a linha e o mais avançado
  // vence. Aqui é o MESMO evento sendo relido por um parser corrigido — o
  // `rawPayload` só é sobrescrito por evento que passa no filtro de status,
  // então ele sempre corresponde ao evento mais forte que chegou.
  //
  // O que sobra a proteger é o que custaria caro perder: venda APROVADA (sai do
  // faturamento) e os estados terminais. Nesses, o status veio de um mapeamento
  // explícito, nunca do fallback que estamos consertando.
  if ((FORCA[v.status] ?? 0) >= FORCA.APROVADA) {
    ignoradas.push({ id: v.id, de: v.status, para: novo });
    continue;
  }
  mudancas.push({ id: v.id, de: v.status, para: novo, valor: Number(v.value), evento: v.rawPayload?.event });
}

// ─────────────────────────────── Relatório ───────────────────────────────

const brl = (n) => "R$ " + n.toFixed(2).replace(".", ",");
const soma = (a) => a.reduce((x, m) => x + m.valor, 0);

console.log(`\n${rows.length} vendas com payload guardado.\n`);

if (!mudancas.length) {
  console.log("Nenhuma venda para reclassificar.\n");
} else {
  const porTransicao = {};
  for (const m of mudancas) {
    const k = `${m.de} → ${m.para}`;
    (porTransicao[k] = porTransicao[k] ?? []).push(m);
  }
  console.log("RECLASSIFICAÇÕES");
  for (const [k, lista] of Object.entries(porTransicao)) {
    const evs = [...new Set(lista.map((m) => m.evento))].join(", ");
    console.log(`  ${k.padEnd(26)} ${String(lista.length).padStart(3)} vendas  ${brl(soma(lista)).padStart(12)}   (${evs})`);
  }

  // O KPI que o usuário vê na tela.
  const pendAntes = rows.filter((r) => r.status === "PENDENTE");
  const saemDePendente = mudancas.filter((m) => m.de === "PENDENTE");
  const antes = pendAntes.reduce((a, r) => a + Number(r.value), 0);
  const depois = antes - soma(saemDePendente);
  console.log(`\nKPI "Vendas pendentes"`);
  console.log(`  antes  ${String(pendAntes.length).padStart(3)} vendas  ${brl(antes).padStart(12)}`);
  console.log(
    `  depois ${String(pendAntes.length - saemDePendente.length).padStart(3)} vendas  ${brl(depois).padStart(12)}` +
      `   (${antes ? (((depois - antes) / antes) * 100).toFixed(0) : 0}%)`,
  );
}

if (ignoradas.length) {
  console.log(`\n${ignoradas.length} recusadas por seriam um REBAIXAMENTO (o status atual é mais forte):`);
  for (const i of ignoradas.slice(0, 5)) console.log(`  ${i.id}  ${i.de} ⊁ ${i.para}`);
}

// ─────────────────────────────── Escrita ───────────────────────────────

if (!aplicar) {
  console.log(`\n\x1b[33mSIMULAÇÃO — nada foi escrito.\x1b[0m Para aplicar, acrescente --aplicar.\n`);
} else if (mudancas.length) {
  for (const m of mudancas) {
    // `AND status = $2` fecha a corrida: se um webhook chegar entre a leitura e
    // a escrita, o UPDATE não encontra a linha e o evento novo prevalece.
    await cliente.query(`UPDATE "Sale" SET status = $1 WHERE id = $2 AND status = $3`, [m.para, m.id, m.de]);
  }
  console.log(`\n\x1b[32m✓ ${mudancas.length} vendas reclassificadas.\x1b[0m\n`);
}

await cliente.end();

/**
 * ⚠️ A tabela FORCA é DUPLICADA do `ingestSale`, e é de propósito — mesma razão
 * da `geo:sonda` duplicar a extração do `sync.ts`. Se este script importasse a
 * tabela de lá, um erro nela apareceria aqui como "tudo certo". A cópia é a
 * testemunha independente; se as duas divergirem, o teste de gateways acusa.
 */
