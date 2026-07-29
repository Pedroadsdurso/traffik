-- Áreas de Trabalho: descrição livre + 2 dimensões novas de filtro.
--
-- Tudo ADITIVO e com default: nenhuma área existente precisa de backfill, e o
-- build antigo que ainda roda em produção (banco Supabase COMPARTILHADO) segue
-- funcionando — ele simplesmente não seleciona estas colunas. É o oposto do
-- que a 20260728120000 fez ao DROPAR uma coluna ainda selecionada em prod.
--
-- `webhookIds` casa com `Sale.webhookId` (FK de verdade) e `pixelConfigIds`
-- com `PixelEvent.pixelConfigId`. Lista vazia = "não filtra por este campo",
-- mesma convenção de `accountIds`/`products`/`sources`.
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "webhookIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "pixelConfigIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
