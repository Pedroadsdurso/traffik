-- Fim da visão consolidada ("Todas as áreas").
--
-- O usuário está SEMPRE dentro de uma área. O estado "sem área"
-- (`workspaceId IS NULL`), que representava o consolidado, deixa de existir
-- como dado.

-- 1. Toda conta precisa de uma área PRINCIPAL antes do backfill. A
--    `garantirAreaPrincipal()` do código só roda quando o usuário abre o
--    painel; aqui cobrimos quem ainda não abriu, para não sobrar layout órfão.
--    A principal nasce com TODAS as contas, webhooks e pixels da conta — é o
--    que faz "todos os dados atuais ficarem vinculados a ela".
INSERT INTO "Workspace" ("id","userId","name","color","description","isDefault","createdAt","updatedAt","accountIds","webhookIds","pixelConfigIds")
SELECT
  'ws' || replace(gen_random_uuid()::text, '-', ''),
  u."id",
  'Principal',
  '#8b5cf6',
  'Operação padrão. Esta área não pode ser excluída.',
  true,
  now(),
  now(),
  COALESCE((SELECT array_agg(a."id") FROM "AdAccount"   a WHERE a."userId" = u."id"), ARRAY[]::text[]),
  COALESCE((SELECT array_agg(w."id") FROM "Webhook"     w WHERE w."userId" = u."id"), ARRAY[]::text[]),
  COALESCE((SELECT array_agg(p."id") FROM "PixelConfig" p WHERE p."userId" = u."id"), ARRAY[]::text[])
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Workspace" x WHERE x."userId" = u."id" AND x."isDefault");

-- 2. Layout salvo para "Todas as áreas" (workspaceId NULL) passa a ser o
--    layout da PRINCIPAL.
--
--    ⚠️ Antes é preciso resolver a colisão: o `@@unique(userId, workspaceId,
--    viewport)` não impedia a coexistência de uma linha NULL com a linha da
--    principal, porque o Postgres trata NULL como distinto no UNIQUE. Ao
--    preencher o NULL as duas viram a mesma chave. Vence a mais recente —
--    perder a customização mais nova seria pior do que perder a antiga.
DELETE FROM "DashboardLayout" d
WHERE d."workspaceId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "DashboardLayout" o
     WHERE o."userId" = d."userId"
       AND o."viewport" = d."viewport"
       AND o."workspaceId" IS NOT NULL
       AND o."workspaceId" = (SELECT w."id" FROM "Workspace" w WHERE w."userId" = d."userId" AND w."isDefault")
       AND o."updatedAt" >= d."updatedAt"
  );

-- Duas linhas NULL do mesmo viewport (possível justamente porque NULL não
-- colide no UNIQUE) também precisam virar uma só antes do backfill.
DELETE FROM "DashboardLayout" d
WHERE d."workspaceId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "DashboardLayout" o
     WHERE o."userId" = d."userId" AND o."viewport" = d."viewport"
       AND o."workspaceId" IS NULL
       AND (o."updatedAt" > d."updatedAt" OR (o."updatedAt" = d."updatedAt" AND o."id" > d."id"))
  );

-- A recíproca: se sobrou a linha NULL e existe a da principal mais ANTIGA,
-- a da principal é que sai.
DELETE FROM "DashboardLayout" o
WHERE o."workspaceId" IS NOT NULL
  AND o."workspaceId" = (SELECT w."id" FROM "Workspace" w WHERE w."userId" = o."userId" AND w."isDefault")
  AND EXISTS (
    SELECT 1 FROM "DashboardLayout" d
     WHERE d."userId" = o."userId" AND d."viewport" = o."viewport" AND d."workspaceId" IS NULL
  );

UPDATE "DashboardLayout" d
   SET "workspaceId" = (SELECT w."id" FROM "Workspace" w WHERE w."userId" = d."userId" AND w."isDefault")
 WHERE d."workspaceId" IS NULL;

-- 3. Preferência gravada como "sem área" passa a apontar para a principal.
UPDATE "User" u
   SET "lastWorkspaceId" = (SELECT w."id" FROM "Workspace" w WHERE w."userId" = u."id" AND w."isDefault")
 WHERE u."lastWorkspaceId" IS NULL;

-- ⚠️ A coluna `DashboardLayout.workspaceId` CONTINUA NULLABLE de propósito.
--
-- O banco é COMPARTILHADO com a produção, que ainda roda um build antigo capaz
-- de inserir NULL ali. Marcar NOT NULL agora faria o "Salvar layout" daquele
-- build estourar — exatamente o erro da migration 20260728120000, que dropou
-- uma coluna ainda em uso e derrubou o dashboard. O código novo trata o campo
-- como obrigatório; o NOT NULL entra num deploy futuro, depois que todos os
-- ambientes estiverem rodando este código.
