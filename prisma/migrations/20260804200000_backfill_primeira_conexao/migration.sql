-- Historico da primeira conexao. ADITIVA: uma coluna nullable.
--
-- NULO = ainda nao buscamos o historico desta conta. O proximo ciclo completo
-- usa a janela larga e carimba.
--
-- ⚠️ SEM backfill do backfill, de proposito: as contas que ja existem tambem
-- nunca tiveram o historico buscado (o auto-sync so pede 2 dias), entao NULO e
-- a resposta correta para elas. Preenche-las agora as faria pular a busca que
-- e justamente o motivo desta coluna existir.
ALTER TABLE "AdAccount" ADD COLUMN "backfillFeitoEm" TIMESTAMP(3);
