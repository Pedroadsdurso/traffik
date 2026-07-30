/**
 * Reclassifica `Click.bot` a partir do `userAgent` já gravado.
 *
 * ## Por que é obrigatório logo depois da migration
 *
 * A coluna nasce com `DEFAULT false`, então **todo clique histórico nasce "não é
 * bot"** — o que está errado para ~16,5% deles. Sem esta passada, a contagem na
 * tela fica zerada e parece que o filtro não está funcionando, enquanto o funil
 * segue inflado.
 *
 * ## É também a ferramenta de manutenção da lista
 *
 * Sempre que `PADROES` mudar em `lib/bots/classificar.ts`, rode isto: ele
 * reavalia **todo** o histórico com a lista nova. É o que torna a decisão de
 * "marcar em vez de bloquear" reversível de verdade — o `userAgent` continua no
 * banco, então um padrão errado se desfaz, e um padrão novo se aplica ao
 * passado. Se a rota tivesse recusado o clique, não haveria o que reclassificar.
 *
 * ## Uso
 *
 *   npm run bot:reclassificar                          # SIMULA
 *   npm run bot:reclassificar -- --aplicar
 *   npm run bot:reclassificar -- --url "<conn>" --aplicar
 *
 * Sem `--aplicar` é só leitura e mostra a tabela por motivo, mais exemplos de
 * user agent de cada grupo — que é como se confere se o filtro exagera.
 */
import "dotenv/config";
import pg from "pg";
import { classificarUserAgent, PADROES } from "@/lib/bots/classificar";
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
  // A trava lê `process.env.DATABASE_URL`. Com `--url` o alvo é OUTRO — sem
  // esta linha ela avaliaria o banco errado e liberaria a escrita indevidamente.
  process.env.DATABASE_URL = url;
  exigirBancoDeDesenvolvimento({ script: "reclassificar-bots" });
}

const cliente = new pg.Client({ connectionString: url.split("?")[0], ssl: { rejectUnauthorized: false } });

async function gravar(pares) {
  let total = 0;
  for (let i = 0; i < pares.length; i += 500) {
    const bloco = pares.slice(i, i + 500);
    const valores = bloco.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}::boolean, $${j * 3 + 3})`).join(",");
    const params = bloco.flatMap(([id, bot, motivo]) => [id, bot, motivo]);
    const r = await cliente.query(
      `UPDATE "Click" AS t SET "bot" = v.b, "botMotivo" = v.m
         FROM (VALUES ${valores}) AS v(id, b, m)
        WHERE t."id" = v.id`,
      params,
    );
    total += r.rowCount;
  }
  return total;
}

async function main() {
  await cliente.connect();
  console.log(`\n\x1b[1mReclassificação de bots\x1b[0m — projeto \x1b[36m${ref}\x1b[0m`);
  console.log(aplicar ? "\x1b[33mMODO: APLICAR\x1b[0m" : "MODO: simulação (nada será escrito)");
  console.log(`${PADROES.length} padrões na lista\n`);

  const { rows } = await cliente.query(
    `SELECT "id", "userAgent", "bot" AS "botAtual", "botMotivo" AS "motivoAtual" FROM "Click"`,
  );

  const mudancas = [];
  const porMotivo = new Map();
  const exemplos = new Map();
  let humanos = 0;
  let semUa = 0;

  for (const c of rows) {
    const r = classificarUserAgent(c.userAgent);
    if (r.bot) {
      porMotivo.set(r.motivo, (porMotivo.get(r.motivo) ?? 0) + 1);
      if (!exemplos.has(r.motivo)) exemplos.set(r.motivo, c.userAgent);
    } else {
      humanos++;
      if (!c.userAgent) semUa++;
    }
    // Só grava o que MUDA — evita reescrever a tabela inteira a cada execução.
    if (r.bot !== c.botAtual || (r.motivo ?? null) !== (c.motivoAtual ?? null)) {
      mudancas.push([c.id, r.bot, r.motivo]);
    }
  }

  const totalBots = rows.length - humanos;
  console.log(`  ${rows.length} cliques no total`);
  console.log(`  \x1b[1m${totalBots} classificados como robô\x1b[0m (${((totalBots / (rows.length || 1)) * 100).toFixed(1)}%)`);
  console.log(`  ${humanos} humanos${semUa ? ` (${semUa} sem user agent — NÃO é bot, ver classificar.ts)` : ""}\n`);

  for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${m}`);
    // O exemplo é o que permite julgar se o padrão está pegando o que devia.
    console.log(`         \x1b[2m${(exemplos.get(m) ?? "").slice(0, 110)}\x1b[0m`);
  }

  console.log(`\n  ${mudancas.length} linha(s) a atualizar`);
  if (aplicar && mudancas.length) {
    const n = await gravar(mudancas);
    console.log(`  \x1b[32m${n} clique(s) reclassificados.\x1b[0m`);
  } else if (!aplicar) {
    console.log("  \x1b[33mNada foi escrito.\x1b[0m Repita com --aplicar.");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✗ Falhou:", e.message);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
