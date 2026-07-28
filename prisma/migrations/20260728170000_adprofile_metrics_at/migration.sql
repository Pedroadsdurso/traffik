-- Ritmo separado para métricas e estrutura (ver `src/lib/facebook/autoSync.ts`).
-- Estrutura muda raramente e custa 4 chamadas à Graph; o gasto muda o tempo
-- todo e custa 1. Sem separar os dois, baixar o intervalo estouraria o rate
-- limit da Meta sem entregar nada a mais.
--
-- Aditiva, como as anteriores: o banco é compartilhado com a produção.
ALTER TABLE "AdProfile" ADD COLUMN IF NOT EXISTS "lastMetricsAt" TIMESTAMP(3);
