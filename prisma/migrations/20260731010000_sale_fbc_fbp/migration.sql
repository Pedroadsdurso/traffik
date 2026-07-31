-- Cookies de correspondência da Meta, como o GATEWAY os enviou.
--
-- POR QUE: a Cakto manda `fbc` e `fbp` no payload; a Kirvano manda `cookies.fbp`
-- em 45 de 46 eventos reais. Os dois eram descartados, e o `fbp` NUNCA chegou à
-- CAPI — é um sinal de correspondência perdido em toda venda, a mesma categoria
-- do telefone sem DDI.
--
-- O `fbc` guardado é o REAL, o mesmo que está no navegador do comprador. Até
-- agora a CAPI fabricava um com `Date.now()`, cujo timestamp é o do
-- PROCESSAMENTO da venda, não o do clique no anúncio.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "fbc" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "fbp" TEXT;
