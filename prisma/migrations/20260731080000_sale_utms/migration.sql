-- Cópia dos UTMs do clique, gravada NA PRÓPRIA VENDA.
--
-- POR QUE: `Sale.clickId` é `onDelete: SetNull` — correto, porque excluir uma
-- configuração nunca pode destruir dado de negócio. Mas a campanha, o criativo
-- e a fonte de uma venda existiam SÓ em `sale.click.utmCampaign`. Apagar o
-- clique preservava o dinheiro e apagava a procedência dele para sempre — e é
-- dessa procedência que saem ROAS, CPA, ranking de criativos e a atribuição por
-- Área de Trabalho.
--
-- É a mesma lição da 20260731030000 (`Sale.platform`), aplicada ao campo que
-- vale mais: **todo atributo que responde "de onde isto veio?" tem de ser
-- copiado para a linha no momento em que ela nasce.** O join é conveniência; a
-- cópia é o registro.
--
-- ⛔ A CÓPIA NÃO VIRA A FONTE. Os leitores continuam usando a cadeia
-- `Sale → Click` enquanto o clique existir (`lib/vendas/utmsDaVenda.ts`); isto
-- aqui é o fallback. Duas fontes para a mesma pergunta divergem sempre.
--
-- ADITIVA: seis colunas nullable, sem default e sem NOT NULL. O build antigo em
-- produção ignora coluna que não conhece, então roda em qualquer ordem.
--
-- SEM ÍNDICE de propósito: nenhuma consulta filtra por estas colunas hoje (a
-- atribuição continua passando pelo `Click`, que já é indexado). Índice sem
-- leitor só encarece a escrita de toda venda.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "fbclid" TEXT;
