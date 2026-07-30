-- Faturamento Líquido precisa descontar coprodução/afiliado e custo de produto,
-- que não existiam como tipo de despesa. Sem eles, o líquido só descontava
-- gateway e imposto e ficava MAIOR que a realidade — o mesmo erro silencioso que
-- o aviso âmbar da tela de Taxas existe para denunciar.
--
-- ⚠️ ADITIVO: só acrescenta valores ao enum. O build antigo em produção não
-- conhece os valores novos, mas também não os recebe — nenhuma linha existente
-- muda de tipo. É o oposto do incidente da 20260728120000, que DROPOU coluna.
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'COPRODUCAO';
ALTER TYPE "ExpenseType" ADD VALUE IF NOT EXISTS 'CUSTO_PRODUTO';
