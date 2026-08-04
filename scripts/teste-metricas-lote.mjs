/**
 * Grava metricas em LOTE contra o banco de DEV.
 *
 * Exercita o caminho que substituiu o N+1: insercao, atualizacao pelo
 * ON CONFLICT, e as duas colunas que o SQL cru precisa preencher a mao
 * (`id` e `updatedAt`, que no Prisma vem de @default(cuid()) e @updatedAt).
 *
 * Escreve no banco, entao passa pelo guard e limpa por id no fim.
 */
import "dotenv/config";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
exigirBancoDeDesenvolvimento();

import { gravarMetricas } from "@/lib/facebook/sync";
import { prisma } from "@/lib/prisma";

let ok = 0, mau = 0;
const eq = (nome, a, b) => {
  const bom = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${bom ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${nome}`);
  if (!bom) console.log(`      obtido ${JSON.stringify(a)} | esperado ${JSON.stringify(b)}`);
  if (bom) ok++; else mau++;
};

const anuncio = await prisma.ad.findFirst({ select: { id: true } });
if (!anuncio) throw new Error("sem Ad no DEV — rode npm run seed:dev");

const DIA = "2019-03-07"; // dia improvavel, fora de qualquer janela real
const criados = [];
try {
  console.log("\nGravacao de metricas em lote\n");

  // 1) INSERCAO
  const n1 = await gravarMetricas([
    { adId: anuncio.id, dia: DIA, spend: 12.34, impressions: 100, clicks: 5,
      ctr: 5, cpc: 2.468, cpm: 123.4, reach: 90, frequency: 1.11 },
  ]);
  eq("insere 1 linha", n1, 1);

  const r1 = await prisma.dailyAdMetric.findFirst({
    where: { adId: anuncio.id, date: new Date(DIA) },
  });
  criados.push(r1?.id);
  eq("linha existe", !!r1, true);
  eq("id foi preenchido (o Prisma nao esta no caminho)", typeof r1?.id === "string" && r1.id.length > 10, true);
  eq("updatedAt foi preenchido", r1?.updatedAt instanceof Date, true);
  eq("spend gravado como Decimal", Number(r1?.spend), 12.34);
  eq("cpc com 4 casas", Number(r1?.cpc), 2.468);
  eq("dia bate (sem deslocamento de fuso)", r1?.date.toISOString().slice(0, 10), DIA);

  // 2) ATUALIZACAO pelo ON CONFLICT — e o caso que `createMany skipDuplicates`
  //    silenciosamente NAO faria: o gasto do dia corrente muda a cada ciclo.
  const antes = r1.updatedAt;
  await new Promise((r) => setTimeout(r, 1100));
  const n2 = await gravarMetricas([
    { adId: anuncio.id, dia: DIA, spend: 99.99, impressions: 200, clicks: 9,
      ctr: 4.5, cpc: 11.11, cpm: 499.95, reach: 180, frequency: 1.11 },
  ]);
  eq("atualizacao conta como linha afetada", n2, 1);

  const todas = await prisma.dailyAdMetric.findMany({ where: { adId: anuncio.id, date: new Date(DIA) } });
  eq("continua UMA linha (nao duplicou)", todas.length, 1);
  eq("spend foi ATUALIZADO", Number(todas[0].spend), 99.99);
  eq("impressions foi atualizado", todas[0].impressions, 200);
  eq("id NAO mudou", todas[0].id, r1.id);
  eq("updatedAt avancou", todas[0].updatedAt > antes, true);

  // 3) LOTE com varias linhas e um conflito no meio
  const dias = ["2019-03-08", "2019-03-09", "2019-03-10"];
  const n3 = await gravarMetricas([
    ...dias.map((d) => ({ adId: anuncio.id, dia: d, spend: 1, impressions: 1, clicks: 1,
      ctr: 1, cpc: 1, cpm: 1, reach: 1, frequency: 1 })),
    { adId: anuncio.id, dia: DIA, spend: 7, impressions: 7, clicks: 7,
      ctr: 7, cpc: 7, cpm: 7, reach: 7, frequency: 7 },
  ]);
  eq("lote de 4 (3 novas + 1 conflito) afeta 4", n3, 4);
  const total = await prisma.dailyAdMetric.count({
    where: { adId: anuncio.id, date: { in: [DIA, ...dias].map((d) => new Date(d)) } },
  });
  eq("4 linhas no total, nenhuma perdida", total, 4);

  // 4) Lista vazia nao explode nem faz round-trip
  eq("lista vazia devolve 0", await gravarMetricas([]), 0);
} finally {
  const del = await prisma.dailyAdMetric.deleteMany({
    where: { adId: anuncio.id, date: { in: ["2019-03-07", "2019-03-08", "2019-03-09", "2019-03-10"].map((d) => new Date(d)) } },
  });
  console.log(`\n  \x1b[2mlimpo: ${del.count} linha(s) de teste\x1b[0m`);
  await prisma.$disconnect();
}

console.log(`\n\x1b[1m${ok + mau} asserções, ${mau} falha(s)\x1b[0m\n`);
process.exitCode = mau ? 1 : 0;
