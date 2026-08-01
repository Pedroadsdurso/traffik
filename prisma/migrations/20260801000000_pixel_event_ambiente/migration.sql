-- Ambiente de origem do evento de pixel: produção (NULO) ou efêmero.
--
-- ADITIVA: uma coluna nullable, sem default e sem backfill. O build antigo em
-- produção não conhece a coluna e a ignora — a ordem segura continua sendo
-- MIGRATION primeiro, deploy depois.
--
-- ⚠️ NULO = "produção, ou não sabemos", e é o que preserva o histórico: toda
-- linha anterior a esta coluna continua contando no funil, exatamente como
-- antes. Marcar por omissão tiraria do funil todo evento server-side (o
-- InitiateCheckout que nasce do webhook do gateway não tem URL).
--
-- O backfill do histórico é OPCIONAL e roda à parte (`npm run eventos:marcar`),
-- justamente para que aplicar a migration não mude número nenhum na tela.
ALTER TABLE "PixelEvent" ADD COLUMN IF NOT EXISTS "ambiente" TEXT;

-- O funil e o feed filtram por `ambiente IS NULL` em toda carga do dashboard.
CREATE INDEX IF NOT EXISTS "PixelEvent_userId_ambiente_timestamp_idx"
  ON "PixelEvent" ("userId", "ambiente", "timestamp");
