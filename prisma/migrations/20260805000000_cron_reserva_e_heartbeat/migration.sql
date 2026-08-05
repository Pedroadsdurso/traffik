-- Reserva do relatorio + batimento das rotinas agendadas. ADITIVA.
--
-- `lastReportAt` e a reserva que impede relatorio duplicado sob concorrencia: a
-- guarda por consulta que existia resolve chamada SEQUENCIAL e nao resolve
-- simultanea. Mesma corrida do run-rules.
--
-- `ExecucaoCron` existe porque agendador externo avisa quando a execucao FALHA,
-- e nenhum avisa quando ele proprio PARA. A deteccao tem de ser invertida.
ALTER TABLE "NotificationSettings" ADD COLUMN "lastReportAt" TIMESTAMP(3);

CREATE TABLE "ExecucaoCron" (
  "rota"      TEXT NOT NULL,
  "ultimaEm"  TIMESTAMP(3) NOT NULL,
  "ok"        BOOLEAN NOT NULL DEFAULT true,
  "duracaoMs" INTEGER NOT NULL DEFAULT 0,
  "erro"      TEXT,
  CONSTRAINT "ExecucaoCron_pkey" PRIMARY KEY ("rota")
);
