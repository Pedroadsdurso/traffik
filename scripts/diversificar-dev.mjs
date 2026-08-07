/**
 * Espalha CANAL e FORMA DE PAGAMENTO nas linhas que já existem no banco de
 * desenvolvimento. **Não recria nada** — só `UPDATE`.
 *
 * ## Por que ele existe
 *
 * O `seed-dev.mjs` gravava `utmSource: 'facebook'` e `paymentMethod: 'PIX'` em
 * TODAS as vendas. Consequência na tela, e ela é a razão deste script: a rosca
 * de Canais caía no atalho de "fatia única" e a Taxa de aprovação mostrava um
 * medidor sozinho. O acabamento desses dois blocos — folga entre segmentos,
 * ponta arredondada, fatia minúscula, os quatro tons do medidor — era
 * **invisível no único banco em que dá para olhar**.
 *
 * O seed já foi corrigido para as próximas execuções. Este script é para a
 * sessão que JÁ existe, porque recriar o banco mata a sessão de quem está com o
 * painel aberto — e `seed:dev:limpar` é proibido por regra do projeto.
 *
 * ## As duas regras de escrita que ele obedece
 *
 * 1. `exigirBancoDeDesenvolvimento()` na primeira linha. Lista de PERMISSÃO: ref
 *    desconhecido é bloqueado, não liberado.
 * 2. **Todo `UPDATE` leva `userId` no `WHERE`.** Um `WHERE` por e-mail ou por
 *    nome atravessa usuários — foi exatamente assim que o incidente de 29/07
 *    apagou configuração real.
 *
 * ⚠️ Ele é IDEMPOTENTE: a distribuição sai de `row_number()` sobre uma ordem
 * estável (`timestamp`, `id`), então rodar duas vezes dá o mesmo resultado. Sem
 * isso, cada execução embaralharia os números do dashboard e ninguém saberia se
 * a tela mudou por causa do código ou do script.
 *
 * Uso:
 *   DATABASE_URL=<banco de dev> node scripts/diversificar-dev.mjs
 */
import "dotenv/config";
import pg from "pg";

import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "diversificar-dev" });

const EMAIL = "dev@exemplo.dev";

const cliente = new pg.Client({
  connectionString: (process.env.DATABASE_URL ?? "").split("?")[0],
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

/* As mesmas listas do `seed-dev.mjs`. Desiguais de propósito — a rosca existe
   para COMPARAR fatias, e com fatias iguais não dá para ver nem a folga entre
   segmentos nem o piso da fatia minúscula. */
const CANAIS = ["facebook", "facebook", "facebook", "google", "google", "tiktok", "organico"];
/* 12 posições, e `OUTRO` em uma só: é ele que fica abaixo de 5 tentativas e
   exerce o tom NEUTRO do medidor — a guarda que impede "1 de 1 = 100%" de sair
   verde. Sem uma forma rara, essa guarda nunca dispara na tela. */
const FORMAS = [
  "PIX", "PIX", "PIX", "PIX",
  "CARTAO", "CARTAO", "CARTAO",
  "BOLETO", "BOLETO",
  "PIX", "CARTAO", "OUTRO",
];

async function main() {
  await cliente.connect();

  const { rows: us } = await cliente.query(`SELECT "id" FROM "User" WHERE "email" = $1`, [EMAIL]);
  const userId = us[0]?.id;
  if (!userId) {
    console.log(`Usuário ${EMAIL} não existe neste banco. Rode 'npm run seed:dev' antes.`);
    return;
  }
  console.log(`Usuário de desenvolvimento: ${userId}\n`);

  /* `row_number()` sobre uma ordem estável, e não `random()`: idempotência.
     A CTE numera; o UPDATE indexa a lista pelo resto da divisão. */
  const canal = await cliente.query(
    `WITH ordenado AS (
       SELECT "id", (row_number() OVER (ORDER BY "timestamp", "id") - 1) AS n
       FROM "Click" WHERE "userId" = $1
     )
     UPDATE "Click" c SET "utmSource" = ($2::text[])[(o.n % $3) + 1]
     FROM ordenado o
     WHERE c."id" = o."id" AND c."userId" = $1`,
    [userId, CANAIS, CANAIS.length],
  );

  const forma = await cliente.query(
    `WITH ordenado AS (
       SELECT "id", (row_number() OVER (ORDER BY "timestamp", "id") - 1) AS n
       FROM "Sale" WHERE "userId" = $1
     )
     UPDATE "Sale" s SET "paymentMethod" = (($2::text[])[(o.n % $3) + 1])::"PaymentMethod"
     FROM ordenado o
     WHERE s."id" = o."id" AND s."userId" = $1`,
    [userId, FORMAS, FORMAS.length],
  );

  /* O BOLETO reprova mais que o PIX — sem taxas DIVERGENTES entre as formas, os
     quatro tons do medidor (verde ≥80, âmbar 50–80, vermelho <50, neutro com
     menos de 5 tentativas) nunca aparecem juntos, e o bloco fica sem estado
     para conferir. */
  const pend = await cliente.query(
    `WITH ordenado AS (
       SELECT "id", (row_number() OVER (ORDER BY "timestamp", "id") - 1) AS n, "paymentMethod" AS pm
       FROM "Sale" WHERE "userId" = $1
     )
     -- O MODULO PRECISA SER COPRIMO COM O TAMANHO DA LISTA DE FORMAS.
     -- A primeira versao usava (n mod 2) para o BOLETO, e o BOLETO caia sempre
     -- em posicao IMPAR da lista de 6 -- nenhum casava, e a forma saia com 100%
     -- de aprovacao. O medidor mostrava tres verdes, e a divergencia entre tons
     -- (que e a razao de o bloco existir) nao aparecia.
     -- Com 12 posicoes, os modulos 5 e 3 nao se alinham com o indice da forma.
     UPDATE "Sale" s
     SET "status" = CASE
                      WHEN o.pm = 'BOLETO' THEN CASE WHEN o.n % 8 <> 0 THEN 'PENDENTE' ELSE 'APROVADA' END
                      WHEN o.pm = 'CARTAO' THEN CASE WHEN o.n % 3 = 0 THEN 'PENDENTE' ELSE 'APROVADA' END
                      ELSE CASE WHEN o.n % 5 = 0 THEN 'PENDENTE' ELSE 'APROVADA' END
                    END::"SaleStatus"
     FROM ordenado o
     WHERE s."id" = o."id" AND s."userId" = $1`,
    [userId],
  );

  console.log(`Click.utmSource      atualizados: ${canal.rowCount}`);
  console.log(`Sale.paymentMethod   atualizados: ${forma.rowCount}`);
  console.log(`Sale.status          atualizados: ${pend.rowCount}\n`);

  const { rows: distCanal } = await cliente.query(
    `SELECT c."utmSource" AS canal, count(*)::int AS n
     FROM "Sale" s JOIN "Click" c ON c."id" = s."clickId"
     WHERE s."userId" = $1 GROUP BY 1 ORDER BY 2 DESC`,
    [userId],
  );
  const { rows: distForma } = await cliente.query(
    `SELECT "paymentMethod" AS forma,
            count(*)::int AS geradas,
            count(*) FILTER (WHERE "status" = 'APROVADA')::int AS pagas
     FROM "Sale" WHERE "userId" = $1 GROUP BY 1 ORDER BY 2 DESC`,
    [userId],
  );

  console.log("Canais:");
  for (const r of distCanal) console.log(`  ${String(r.canal).padEnd(10)} ${r.n}`);
  console.log("\nFormas de pagamento (o que o medidor vai mostrar):");
  for (const r of distForma) {
    const taxa = r.geradas ? ((r.pagas / r.geradas) * 100).toFixed(0) : "—";
    const tom = r.geradas < 5 ? "neutro" : +taxa >= 80 ? "verde" : +taxa >= 50 ? "âmbar" : "vermelho";
    console.log(`  ${String(r.forma).padEnd(8)} ${r.pagas} de ${r.geradas} = ${taxa}%  (${tom})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => cliente.end());
