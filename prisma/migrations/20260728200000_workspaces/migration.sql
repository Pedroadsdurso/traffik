-- Áreas de Trabalho: um conjunto de filtros salvo com um nome.
--
-- ⚠️ Deliberadamente NÃO é multi-tenant. Nenhuma tabela de dados ganha coluna,
-- nada é migrado, nenhum script ou webhook precisa ser regenerado. A área só
-- decide o que a tela mostra — os dados continuam todos do usuário.
--
-- Tudo aditivo e nulo por padrão, como as migrations anteriores: o banco é
-- compartilhado com a produção e o build antigo ignora colunas que não conhece.
CREATE TABLE "Workspace" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "color"      TEXT,
    "archived"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "products"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources"    TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId"     TEXT NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Última área aberta. SetNull: excluir a área não pode derrubar o usuário.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastWorkspaceId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_lastWorkspaceId_fkey"
  FOREIGN KEY ("lastWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Layout por área. NULO = layout de "Todas as áreas", que é o que os layouts
-- já existentes viram automaticamente — sem backfill e sem perder configuração.
ALTER TABLE "DashboardLayout" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DashboardLayout_workspaceId_idx" ON "DashboardLayout"("workspaceId");

-- Troca o único: no Postgres NULL é distinto em UNIQUE, então a linha de
-- "Todas as áreas" convive com as das áreas.
DROP INDEX IF EXISTS "DashboardLayout_userId_viewport_key";
CREATE UNIQUE INDEX "DashboardLayout_userId_workspaceId_viewport_key"
  ON "DashboardLayout"("userId", "workspaceId", "viewport");
