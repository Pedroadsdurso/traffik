-- Configuração passa a PERTENCER a uma Área de Trabalho.
--
-- ⚠️ TUDO ADITIVO E NULLABLE. Nenhum DROP, nenhum NOT NULL, nenhum RENAME.
-- O banco de produção roda um build antigo que ainda não conhece estas colunas;
-- ele continua funcionando porque nada que ele lê mudou. (Lição da migration
-- 20260728120000, que dropou coluna ainda selecionada em produção e derrubou o
-- dashboard inteiro.)
--
-- ⛔ O BACKFILL NÃO PREENCHE A PRINCIPAL. Ela é catch-all e filtra por
-- EXCLUSÃO — dar a ela uma lista de inclusão foi exatamente o que zerou o
-- dashboard em produção em 29/07/2026 (89 de 221 cliques e 12 de 14 vendas
-- sumiram por não casarem com campanha nenhuma). NULO aqui significa "sem
-- dono", e sem dono aparece na Principal por construção.

-- ── Colunas novas ────────────────────────────────────────────────────────────
ALTER TABLE "User"          ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

ALTER TABLE "Workspace"     ADD COLUMN "produtosDesempate" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "AdAccount"      ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Webhook"        ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "PixelConfig"    ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "AutomationRule" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Expense"        ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "ApiCredential"  ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Sale"           ADD COLUMN "apiCredentialId" TEXT;

-- ── FKs. TODAS `ON DELETE SET NULL`, nunca CASCADE ───────────────────────────
-- Excluir uma área não pode apagar webhook nem pixel: a URL já está colada no
-- painel do gateway e o script já está no site do cliente. Eles voltam a ser
-- da Principal.
ALTER TABLE "AdAccount"      ADD CONSTRAINT "AdAccount_workspaceId_fkey"      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Webhook"        ADD CONSTRAINT "Webhook_workspaceId_fkey"        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PixelConfig"    ADD CONSTRAINT "PixelConfig_workspaceId_fkey"    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense"        ADD CONSTRAINT "Expense_workspaceId_fkey"        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiCredential"  ADD CONSTRAINT "ApiCredential_workspaceId_fkey"  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale"           ADD CONSTRAINT "Sale_apiCredentialId_fkey"       FOREIGN KEY ("apiCredentialId") REFERENCES "ApiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdAccount_workspaceId_idx"      ON "AdAccount"("workspaceId");
CREATE INDEX "Webhook_workspaceId_idx"        ON "Webhook"("workspaceId");
CREATE INDEX "PixelConfig_workspaceId_idx"    ON "PixelConfig"("workspaceId");
CREATE INDEX "AutomationRule_workspaceId_idx" ON "AutomationRule"("workspaceId");
CREATE INDEX "Expense_workspaceId_idx"        ON "Expense"("workspaceId");
CREATE INDEX "ApiCredential_workspaceId_idx"  ON "ApiCredential"("workspaceId");

-- ── Backfill: SÓ das áreas SECUNDÁRIAS ───────────────────────────────────────
-- As listas gravadas numa área secundária são configuração real do usuário e
-- não podem se perder na troca de array para FK. As da PRINCIPAL são ignoradas
-- de propósito: `filtrosDaArea` já as ignorava, porque o escopo dela é derivado
-- do que as outras reivindicam. Copiá-las aqui recriaria o bug de 29/07.
--
-- `WHERE "workspaceId" IS NULL` torna o backfill idempotente e, se uma
-- duplicata legada existir (a validação de conta única nasceu depois dos
-- arrays), a área mais antiga vence — mesma regra que `contasOcupadas` já
-- aplicava na tela.
UPDATE "AdAccount" a SET "workspaceId" = w.id
FROM (SELECT DISTINCT ON (acc) id, "userId", acc FROM "Workspace", unnest("accountIds") acc
      WHERE NOT "isDefault" ORDER BY acc, "createdAt" ASC) w
WHERE a."workspaceId" IS NULL AND a.id = w.acc AND a."userId" = w."userId";

UPDATE "Webhook" h SET "workspaceId" = w.id
FROM (SELECT DISTINCT ON (hid) id, "userId", hid FROM "Workspace", unnest("webhookIds") hid
      WHERE NOT "isDefault" ORDER BY hid, "createdAt" ASC) w
WHERE h."workspaceId" IS NULL AND h.id = w.hid AND h."userId" = w."userId";

UPDATE "PixelConfig" p SET "workspaceId" = w.id
FROM (SELECT DISTINCT ON (pid) id, "userId", pid FROM "Workspace", unnest("pixelConfigIds") pid
      WHERE NOT "isDefault" ORDER BY pid, "createdAt" ASC) w
WHERE p."workspaceId" IS NULL AND p.id = w.pid AND p."userId" = w."userId";

-- Migra o filtro de produto das áreas secundárias para o campo de DESEMPATE.
-- `products` deixa de ser dimensão de filtro (o nome vem como texto livre do
-- gateway e quebrava em silêncio ao ser renomeado lá). Quem tinha produto
-- configurado não perde a intenção: ela vira desempate, que só age quando o
-- webhook é ambíguo e degrada para a Principal COM AVISO em vez de sumir.
UPDATE "Workspace" SET "produtosDesempate" = "products"
WHERE NOT "isDefault" AND cardinality("products") > 0;

-- `Expense` e `AutomationRule` ficam NULOS de propósito:
-- NULO = vale para todas as áreas. Ver o comentário das colunas no schema.
