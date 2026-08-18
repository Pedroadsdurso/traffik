/**
 * SONDA: `prisma.upsert` é atômico sob concorrência, ou colide?
 *
 * ## 🔴 A PERGUNTA, E POR QUE ELA VALE MEIA HORA
 *
 * `syncUser` tem **6 chamadores e só 2 reservam** o lock. Os outros quatro podem
 * rodar simultaneamente sobre a mesma conta — o caso provável é alguém clicar
 * "sincronizar" no painel enquanto o cron das 04:00 roda o `?full=1`.
 *
 * As métricas são seguras: `gravarMetricas` usa `INSERT … ON CONFLICT DO UPDATE`
 * cru, e o SQL está à vista. A ESTRUTURA não: `Campaign`, `AdSet` e `Ad` usam
 * `prisma.*.upsert`, que na semântica do cliente é *find-then-write*.
 *
 * ⛔ **E o custo de errar é DISFARÇADO**, que é o que torna a medição urgente:
 * uma colisão lança, cai no `catch` do laço por conta, vira `registrarErro` e
 * **incrementa o backoff**. Na tela isso aparece como *"conta com erro de
 * sincronização"* — e o usuário vai procurar defeito de configuração que não
 * existe. É o mesmo disfarce do rate limit.
 *
 * ## ⚠️ ESTA SONDA ESCREVE. Ela obedece às regras do incidente de 29/07:
 *
 * - `exigirBancoDeDesenvolvimento()` na primeira linha;
 * - cria as PRÓPRIAS linhas e apaga **por id coletado na criação**, nunca por
 *   `LIKE` nem por nome;
 * - não toca em nenhuma linha que já existia.
 *
 *   npm run sonda:upsert
 */

import "dotenv/config";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";

exigirBancoDeDesenvolvimento({ script: "sonda-upsert-corrida" });

const { PrismaClient } = await import("../src/generated/prisma/client.js");
const { PrismaPg } = await import("@prisma/adapter-pg");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const C = { v: "\x1b[32m", r: "\x1b[31m", a: "\x1b[33m", n: "\x1b[1m", x: "\x1b[0m" };
const criados = [];

try {
  /* ── O contexto: reaproveita uma tripla que JÁ EXISTE, sem tocar nela ──── */
  const anuncio = await prisma.ad.findFirst({ select: { adAccountId: true, campaignId: true, adSetId: true } });
  if (!anuncio) {
    console.log(`${C.r}Não há Ad no dev para tomar como contexto. Rode \`npm run seed:dev\`.${C.x}`);
    process.exit(1);
  }
  console.log(`\n${C.n}Sonda: duas criações CONCORRENTES do mesmo Ad${C.x}`);
  console.log(`   contexto (linhas existentes, NÃO tocadas): conta ${anuncio.adAccountId.slice(0, 8)}…\n`);

  /**
   * Uma rodada: N `upsert` simultâneos do MESMO `fbAdId` inexistente.
   *
   * ⛔ `Promise.allSettled`, nunca `all`: com `all` a primeira rejeição
   * mascara o desfecho das outras, e o que se quer medir é justamente
   * **quantas** falharam e com qual código.
   */
  async function rodada(n, rotulo) {
    const fbAdId = `sonda-corrida-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const um = (i) =>
      prisma.ad.upsert({
        where: { adAccountId_fbAdId: { adAccountId: anuncio.adAccountId, fbAdId } },
        update: { name: `sonda (update ${i})` },
        create: {
          adAccountId: anuncio.adAccountId,
          campaignId: anuncio.campaignId,
          adSetId: anuncio.adSetId,
          fbAdId,
          name: `sonda (create ${i})`,
          status: "UNKNOWN",
        },
      });

    const res = await Promise.allSettled(Array.from({ length: n }, (_, i) => um(i)));
    const ok = res.filter((r) => r.status === "fulfilled");
    const erro = res.filter((r) => r.status === "rejected");
    for (const r of ok) if (!criados.includes(r.value.id)) criados.push(r.value.id);

    /* Sobrou UMA linha só? É a pergunta de integridade, separada da de erro. */
    const linhas = await prisma.ad.count({ where: { adAccountId: anuncio.adAccountId, fbAdId } });
    const codigos = [...new Set(erro.map((r) => r.reason?.code ?? r.reason?.name ?? "sem código"))];

    const tom = erro.length === 0 ? C.v : C.r;
    console.log(
      `  ${tom}${erro.length === 0 ? "✓" : "✗"}${C.x} ${rotulo.padEnd(26)} ` +
        `ok ${String(ok.length).padStart(2)}/${n} · falhas ${String(erro.length).padStart(2)} ` +
        `${erro.length ? C.r + codigos.join(",") + C.x : ""} · linhas no banco: ${linhas}`,
    );
    if (erro.length) {
      const msg = erro[0].reason?.message?.split("\n").find((l) => l.trim()) ?? String(erro[0].reason);
      console.log(`      ${C.a}${msg.slice(0, 160)}${C.x}`);
    }
    return { ok: ok.length, erro: erro.length, codigos, linhas };
  }

  /* ⚠️ 2 é o caso REAL (painel + cron). 5 e 10 existem para o resultado não
     depender de a janela de corrida ser estreita: se 2 não colide por sorte de
     temporização, 10 colide. Um "0 falhas" com n=2 só é evidência se n=10
     também der 0. */
  const r2 = await rodada(2, "2 simultâneos (o caso real)");
  const r5 = await rodada(5, "5 simultâneos");
  const r10 = await rodada(10, "10 simultâneos");

  /* ── E o caso em que a linha JÁ EXISTE: é o comum em produção ─────────── */
  console.log("");
  const existente = `sonda-corrida-existente-${Date.now()}`;
  const base = await prisma.ad.create({
    data: {
      adAccountId: anuncio.adAccountId, campaignId: anuncio.campaignId, adSetId: anuncio.adSetId,
      fbAdId: existente, name: "sonda (pré-existente)", status: "UNKNOWN",
    },
  });
  criados.push(base.id);
  const jaExiste = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      prisma.ad.upsert({
        where: { adAccountId_fbAdId: { adAccountId: anuncio.adAccountId, fbAdId: existente } },
        update: { name: `sonda (update ${i})` },
        create: {
          adAccountId: anuncio.adAccountId, campaignId: anuncio.campaignId, adSetId: anuncio.adSetId,
          fbAdId: existente, name: "nunca deveria criar", status: "UNKNOWN",
        },
      }),
    ),
  );
  const falhas = jaExiste.filter((r) => r.status === "rejected");
  console.log(
    `  ${falhas.length === 0 ? C.v + "✓" : C.r + "✗"}${C.x} ${"10 UPDATES simultâneos".padEnd(26)} ` +
      `ok ${10 - falhas.length}/10 · falhas ${falhas.length}` +
      `${falhas.length ? " " + C.r + [...new Set(falhas.map((f) => f.reason?.code ?? "?"))].join(",") + C.x : ""}`,
  );

  /* ═══ O VEREDITO ═══════════════════════════════════════════════════════ */
  const colideNoCreate = r2.erro + r5.erro + r10.erro > 0;
  const duplicou = [r2, r5, r10].some((r) => r.linhas !== 1);

  console.log(`\n${C.n}VEREDITO${C.x}`);
  console.log(
    duplicou
      ? `  ${C.r}🔴 DUPLICOU LINHA — o índice único não segurou. Isto é corrupção, não erro.${C.x}`
      : `  ${C.v}✓ nunca duplicou: 1 linha por chave, em todas as rodadas${C.x}`,
  );
  console.log(
    colideNoCreate
      ? `  ${C.r}🔴 COLIDE: ${r2.erro + r5.erro + r10.erro} falhas nas três rodadas (${[...new Set([...r2.codigos, ...r5.codigos, ...r10.codigos])].join(", ")})\n` +
          `     ⛔ Em produção isso vira "conta com erro de sincronização" na tela,\n` +
          `        sem defeito de configuração — o mesmo disfarce do rate limit.${C.x}`
      : `  ${C.v}✓ NÃO colide: o upsert atravessou concorrência de 2, 5 e 10 sem lançar${C.x}\n` +
        `     ⚠️ Isto NÃO torna o lock dispensável: ele existe contra desperdício\n` +
        `        de quota da Graph, não contra corrida de escrita.`,
  );
} finally {
  /* ⛔ APAGA POR ID COLETADO NA CRIAÇÃO — nunca por `LIKE` nem por nome.
     Regra nº 4 do incidente de 29/07. */
  if (criados.length) {
    const r = await prisma.ad.deleteMany({ where: { id: { in: criados } } });
    console.log(`\n   limpeza: ${r.count} de ${criados.length} linhas criadas por esta sonda, apagadas por id\n`);
  }
  await prisma.$disconnect();
}
