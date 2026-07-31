-- Taxa do gateway e comissões REPORTADAS pelo próprio gateway, por venda.
--
-- POR QUE: a Kirvano manda `fee` e o bloco `fiscal` em 36 de 46 eventos reais; a
-- Cakto manda `fees` e `commissions[]`. Até agora tudo isso era descartado e o
-- desconto saía de uma taxa MÉDIA cadastrada à mão em Taxas e Despesas.
--
-- ⛔ NULLABLE, e a diferença entre NULL e 0 é o ponto:
--   NULL = o gateway NÃO informou  -> usa a taxa cadastrada pelo usuário
--   0    = o gateway informou que NÃO cobrou -> desconta zero
-- Colapsar os dois em 0 faria o Faturamento Líquido aparecer MAIOR que a
-- realidade, com o número continuando plausível. É a REGRA 1 do contrato de
-- gateways, agora no schema.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "taxaGateway" DECIMAL(14,2);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "coproducao" DECIMAL(14,2);
