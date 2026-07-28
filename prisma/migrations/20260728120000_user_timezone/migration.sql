-- Fuso de referência do usuário para TODA agregação por dia/hora.
-- Os instantes continuam gravados em UTC; esta coluna define apenas onde o dia
-- começa e termina para este usuário. Ver `src/lib/timezone.ts`.
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- `NotificationSettings.timezone` existia desde a migration inicial mas NENHUM
-- código lia ou escrevia nela. Manter as duas viraria duas fontes de verdade
-- para a mesma pergunta ("onde começa o dia deste usuário?"), que é justamente
-- a classe de bug que esta migration existe para fechar. O valor é copiado
-- antes de a coluna morta ser removida, caso alguém a tenha ajustado na mão.
UPDATE "User" u
SET "timezone" = n."timezone"
FROM "NotificationSettings" n
WHERE n."userId" = u."id"
  AND n."timezone" IS NOT NULL
  AND n."timezone" <> 'America/Sao_Paulo';

ALTER TABLE "NotificationSettings" DROP COLUMN "timezone";
