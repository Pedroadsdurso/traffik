-- `Webhook.platform` deixa de ser enum e vira String.
--
-- POR QUÊ: o domínio válido é o REGISTRO (`lib/gateways/registro.ts`), não o
-- banco. Com enum, cada gateway novo custava uma migration + ordem de deploy —
-- atrito recorrente exatamente onde o critério de aceite pede zero.
--
-- 🔴 ISTO É UM BUG DE PRODUÇÃO, não uma melhoria: o código já grava "CAKTO", e
-- o enum não tem esse valor. Salvar um webhook da Cakto falhava com "Não foi
-- possível salvar o webhook". O cast em `createWebhook` calava o TypeScript
-- sobre justamente o que estourava no Postgres.
--
-- SEGURA: `::text` preserva os valores existentes byte a byte (KIRVANO,
-- HOTMART, KIWIFY, CUSTOM continuam as mesmas strings). O build ANTIGO ainda em
-- produção lê texto onde esperava enum e não quebra — os valores continuam
-- sendo membros válidos do enum que o cliente Prisma dele conhece.
--
-- ⚠️ Ordem: migration -> deploy -> só então dá para criar webhook da Cakto.
-- Criar antes do deploy gravaria "CAKTO", que o build antigo não sabe ler.
ALTER TABLE "Webhook" ALTER COLUMN "platform" DROP DEFAULT;
ALTER TABLE "Webhook" ALTER COLUMN "platform" TYPE TEXT USING "platform"::text;
ALTER TABLE "Webhook" ALTER COLUMN "platform" SET DEFAULT 'CUSTOM';

-- ⚠️ O TIPO `WebhookPlatform` fica no banco, órfão, DE PROPÓSITO. Removê-lo
-- agora quebraria o cliente Prisma do build antigo, que ainda o declara. Ele
-- pode ser dropado num segundo deploy — ou nunca, já que um tipo sem coluna não
-- custa nada.
