-- Dois estados que faltavam entre "gerada" e "aprovada".
--
-- PROBLEMA: PIX vencido e carrinho abandonado eram gravados como PENDENTE, e
-- inflavam o KPI "Vendas pendentes". Medido na produção em 30/07/2026:
-- 13 das 14 vendas pendentes estavam erradas — R$ 512,35 exibidos contra
-- R$ 169,80 reais (-67%).
--
-- POR QUE NÃO REUSAR "CANCELADA": ela é TERMINAL (força 2 no upsert monotônico),
-- e o dado real mostra a sequência PIX_GENERATED -> PIX_EXPIRED -> PIX_GENERATED
-- no MESMO pedido: o cliente volta a tentar. Com um status terminal, o
-- SALE_APPROVED seguinte não conseguiria sobrescrever e a venda paga sumiria do
-- faturamento. Perder receita para consertar um KPI seria péssimo negócio.
--
-- A escala fica: ABANDONADA < PENDENTE < EXPIRADA < APROVADA < terminais.
--
-- ADITIVA: `ALTER TYPE ... ADD VALUE` não altera nenhuma linha existente, e o
-- build antigo em produção continua funcionando enquanto ninguém GRAVAR os
-- valores novos. Por isso a ordem é migration -> deploy -> backfill.
ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'EXPIRADA';
ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'ABANDONADA';
