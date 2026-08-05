/**
 * A reserva das rotinas resiste a chamada CONCORRENTE?
 *
 * Escreve no banco de DEV, passa pelo guard e limpa por id.
 */
import "dotenv/config";
import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
exigirBancoDeDesenvolvimento();

import { prisma } from "@/lib/prisma";
import { estadoDasRotinas, registrarExecucao } from "@/lib/cronBatimento";

let ok = 0, mau = 0;
const eq = (n, a, b) => {
  const bom = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${bom ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${n}`);
  if (!bom) console.log(`      obtido ${JSON.stringify(a)} | esperado ${JSON.stringify(b)}`);
  if (bom) ok++; else mau++;
};

const criados = [];
try {
  console.log("\n1. Reserva da REGRA — o padrao do updateMany condicional\n");
  const u = await prisma.user.findFirst({ where: { email: "dev@exemplo.dev" }, select: { id: true } });
  if (!u) throw new Error("rode npm run seed:dev");

  const r = await prisma.automationRule.create({
    data: { userId: u.id, name: "PROBE reserva", level: "CAMPAIGN", action: "PAUSAR",
            conditions: [], calcPeriod: "hoje", frequencyMin: 60, dailyRunLimit: 5, active: true },
  });
  criados.push(r.id);

  const limite = new Date(Date.now() - 60 * 60_000);
  const reservar = () => prisma.automationRule.updateMany({
    where: { id: r.id, OR: [{ lastRunAt: null }, { lastRunAt: { lt: limite } }] },
    data: { lastRunAt: new Date() },
  });

  // 🔴 O caso que importa: DOIS chamadores ao mesmo tempo.
  const [a, b] = await Promise.all([reservar(), reservar()]);
  eq("duas reservas simultaneas: exatamente UMA vence", a.count + b.count, 1);

  const terceira = await reservar();
  eq("uma terceira tentativa dentro da janela tambem perde", terceira.count, 0);

  console.log("\n2. Reserva do RELATORIO\n");
  const s0 = await prisma.notificationSettings.findFirst({ where: { userId: u.id }, select: { userId: true, lastReportAt: true } });
  if (s0) {
    const antes = s0.lastReportAt;
    const inicioDaHora = new Date(Date.now() - (Date.now() % 3_600_000));
    const res = () => prisma.notificationSettings.updateMany({
      where: { userId: u.id, OR: [{ lastReportAt: null }, { lastReportAt: { lt: inicioDaHora } }] },
      data: { lastReportAt: new Date() },
    });
    const [x, y] = await Promise.all([res(), res()]);
    eq("duas geracoes simultaneas do relatorio: UMA vence", x.count + y.count, 1);
    await prisma.notificationSettings.updateMany({ where: { userId: u.id }, data: { lastReportAt: antes } });
  } else {
    console.log("  (sem NotificationSettings no dev — pulado)");
  }

  console.log("\n3. Batimento\n");
  const antes = await estadoDasRotinas();
  const semLinha = antes.find((x) => x.rota === "manutencao");
  eq("rotina que nunca rodou NAO conta como atrasada", semLinha.atrasada, false);

  await registrarExecucao("manutencao", { ok: true, duracaoMs: 123 });
  const depois = await estadoDasRotinas();
  const agora = depois.find((x) => x.rota === "manutencao");
  eq("registrou o batimento", agora.ultimaEm != null, true);
  eq("recem-registrada nao esta atrasada", agora.atrasada, false);
  eq("e nao esta em falha", agora.falhou, false);

  await registrarExecucao("manutencao", { ok: false, duracaoMs: 9, erro: "explodiu" });
  const comFalha = (await estadoDasRotinas()).find((x) => x.rota === "manutencao");
  eq("falha e sinal DIFERENTE de silencio", [comFalha.falhou, comFalha.atrasada], [true, false]);

  // atrasada de verdade: finge que rodou ha muito tempo
  await prisma.execucaoCron.update({ where: { rota: "manutencao" }, data: { ultimaEm: new Date(Date.now() - 72 * 3600_000), ok: true, erro: null } });
  const velha = (await estadoDasRotinas()).find((x) => x.rota === "manutencao");
  eq("72h sem rodar numa rotina diaria = atrasada", velha.atrasada, true);
} finally {
  if (criados.length) await prisma.automationRule.deleteMany({ where: { id: { in: criados } } });
  await prisma.execucaoCron.deleteMany({ where: { rota: "manutencao" } });
  console.log("\n  \x1b[2mlimpo\x1b[0m");
  await prisma.$disconnect();
}

console.log(`\n\x1b[1m${ok + mau} asserções, ${mau} falha(s)\x1b[0m\n`);
process.exitCode = mau ? 1 : 0;
