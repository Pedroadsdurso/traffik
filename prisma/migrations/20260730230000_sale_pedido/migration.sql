-- Agrupador de checkout: order bump e upsell viram linhas separadas do MESMO
-- pedido.
--
-- POR QUE: um checkout com order bump gera 2 linhas de venda. Contá-las como 2
-- conversões derruba o CPA pela metade e infla a taxa de conversão do funil — e
-- os dois continuam parecendo números plausíveis.
--
-- Faturamento soma LINHAS; conversões contam PEDIDOS DISTINTOS.
--
-- ADITIVA e NULLABLE de propósito: venda já gravada fica com pedidoId NULO, e
-- `chaveDoPedido()` cai no próprio id — cada venda antiga é o seu pedido, que é
-- exatamente o comportamento anterior. Nenhum número histórico muda.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "pedidoId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "itemTipo" TEXT NOT NULL DEFAULT 'principal';

-- Contar pedidos distintos por usuário e período é a consulta quente do painel.
CREATE INDEX IF NOT EXISTS "Sale_userId_pedidoId_idx" ON "Sale"("userId", "pedidoId");
