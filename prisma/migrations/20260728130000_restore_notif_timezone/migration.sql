-- Restaura `NotificationSettings.timezone`, que a migration anterior
-- (20260728120000_user_timezone) removeu por ser código morto.
--
-- O drop estava tecnicamente certo e operacionalmente errado: o banco Supabase
-- é COMPARTILHADO entre o dev e a produção, e a produção roda um build antigo
-- cujo cliente Prisma ainda seleciona essa coluna. Assim que ela sumiu, todo
-- carregamento do dashboard passou a estourar 500 — `getNotificationSettings()`
-- roda no layout de `/dashboard`.
--
-- Lição: com banco compartilhado, remover coluna só é seguro DEPOIS que todos
-- os ambientes estiverem rodando o código que deixou de usá-la. A coluna volta
-- a existir e permanece sem uso; quem manda no fuso é `User.timezone`.
ALTER TABLE "NotificationSettings"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- Devolve o valor que tinha sido copiado para o usuário, para as duas colunas
-- não ficarem divergentes enquanto a antiga ainda existir.
UPDATE "NotificationSettings" n
SET "timezone" = u."timezone"
FROM "User" u
WHERE u."id" = n."userId";
