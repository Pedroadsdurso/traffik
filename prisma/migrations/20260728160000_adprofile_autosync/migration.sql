-- Sincronização automática do Facebook (sem clicar em "Sincronizar métricas").
--
-- `lastSyncedAt` = última sincronização concluída COM SUCESSO (é o que a UI
-- mostra como "atualizado há X"). `syncLockedAt` = reserva da execução atual,
-- usada como trava distribuída: o polling da UI bate a cada poucos segundos e,
-- sem a trava, cada requisição dispararia uma sincronização concorrente contra
-- a Graph API.
--
-- Só ADIÇÃO de colunas, de propósito: o banco é compartilhado com a produção,
-- e adicionar coluna é invisível para o build antigo (ao contrário de remover,
-- que derrubou o dashboard em 28/07 — ver a nota no CLAUDE.md).
ALTER TABLE "AdProfile" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "AdProfile" ADD COLUMN IF NOT EXISTS "syncLockedAt" TIMESTAMP(3);
