-- Procedência da venda gravada NA PRÓPRIA VENDA, não só na FK.
--
-- POR QUE: `Sale.webhookId` é `onDelete: SetNull` — correto, porque excluir uma
-- configuração nunca pode destruir dado de negócio. Mas a única forma de saber
-- de qual gateway uma venda veio era `sale.webhook.platform`, então trocar de
-- gateway APAGAVA a procedência de todo o histórico. A venda sobrevivia e
-- ficava indistinguível de uma ingerida por chave de API, que também nasce com
-- `webhookId` nulo.
--
-- Observado em produção em 31/07/2026: o usuário removeu a Cakto e as TRÊS
-- vendas dela (DUAS de teste, uma real) ficaram órfãs de contexto — sem backfill
-- possível, porque o webhook que respondia a pergunta já não existe.
--
-- ⚠️ Eram DOIS eventos de teste, não um: cada clique em "enviar teste" no painel
-- do gateway virou faturamento. É a medida do custo de não haver sinal de teste.
--
-- ADITIVA: uma coluna nullable, sem default e sem NOT NULL. O build antigo em
-- produção ignora a coluna que não conhece.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "platform" TEXT;

-- Índice para "vendas por gateway", que é a consulta que esta coluna habilita.
CREATE INDEX IF NOT EXISTS "Sale_userId_platform_idx" ON "Sale" ("userId", "platform");
