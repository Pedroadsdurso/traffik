-- Área PRINCIPAL: toda conta tem uma, criada sozinha, que não pode ser excluída.
--
-- Aditiva e com default `false`, então o build antigo ainda em produção sobre
-- este mesmo Supabase continua funcionando sem enxergar a coluna.
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Índice ÚNICO PARCIAL: no máximo uma principal por usuário.
--
-- Precisa ser parcial (`WHERE "isDefault"`). Um `UNIQUE(userId, isDefault)`
-- comum proibiria o usuário de ter duas áreas secundárias, porque as duas
-- teriam `false` — o índice parcial só indexa as linhas verdadeiras.
--
-- A garantia é do BANCO de propósito: `garantirAreaPrincipal()` roda em todo
-- carregamento de página e várias abas podem chamá-la ao mesmo tempo. Sem o
-- índice, duas requisições concorrentes criariam duas principais; com ele, a
-- segunda falha e cai no caminho de "já existe". Mesmo padrão do upsert
-- monotônico de vendas: quem decide o vencedor é o banco.
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_userId_default_key"
  ON "Workspace" ("userId") WHERE "isDefault";

-- Usuários que JÁ tinham áreas antes desta migration: a mais antiga vira a
-- principal. Nunca sobra usuário com áreas e nenhuma principal.
WITH primeira AS (
  SELECT DISTINCT ON ("userId") "id"
    FROM "Workspace"
   ORDER BY "userId", "createdAt" ASC
)
UPDATE "Workspace" w SET "isDefault" = true
  FROM primeira p
 WHERE w."id" = p."id"
   AND NOT EXISTS (SELECT 1 FROM "Workspace" x WHERE x."userId" = w."userId" AND x."isDefault");

-- Área principal não pode ficar arquivada: ela é o destino de fallback do
-- seletor, e uma principal arquivada deixaria o usuário sem para onde cair.
UPDATE "Workspace" SET "archived" = false WHERE "isDefault" AND "archived";
