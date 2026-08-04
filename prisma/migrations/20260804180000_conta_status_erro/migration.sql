-- Status da conta de anuncio na Meta + ultimo erro de sincronizacao.
--
-- ADITIVA: quatro colunas, tres nullable e uma com DEFAULT. Nenhum DROP,
-- RENAME ou NOT NULL sem default -- o build antigo que roda em producao ignora
-- coluna que nao conhece e continua funcionando. Ver a licao da 20260728120000.
--
-- Sem backfill de proposito: `accountStatus` NULO significa "ainda nao
-- sincronizado com este codigo", e a traducao trata nulo como "nao informado",
-- nunca como "com problema".
ALTER TABLE "AdAccount" ADD COLUMN "accountStatus"   INTEGER;
ALTER TABLE "AdAccount" ADD COLUMN "lastSyncError"   TEXT;
ALTER TABLE "AdAccount" ADD COLUMN "lastSyncErrorAt" TIMESTAMP(3);
ALTER TABLE "AdAccount" ADD COLUMN "syncErrorCount"  INTEGER NOT NULL DEFAULT 0;
