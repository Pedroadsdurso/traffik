-- Status de VEICULAÇÃO (`effective_status` da Meta).
--
-- `status` é o que foi CONFIGURADO (ACTIVE, PAUSED, ARCHIVED, DELETED).
-- `effectiveStatus` é se está REALMENTE veiculando. Uma campanha ACTIVE pode
-- não entregar nada: conjunto pausado, anúncio reprovado, conta sem forma de
-- pagamento, fora da janela de agendamento.
--
-- ADITIVA: três colunas nullable, sem default e sem backfill. O build antigo
-- que ainda roda em produção não conhece estas colunas e as ignora — é o
-- oposto do incidente da 20260728120000, que DROPOU coluna ainda selecionada.
--
-- ⚠️ Nulo = ainda não sincronizado com o código que pede o campo, NUNCA "não
-- está veiculando". Quem preenche é o primeiro sync após o deploy.
ALTER TABLE "Campaign" ADD COLUMN "effectiveStatus" TEXT;
ALTER TABLE "AdSet"    ADD COLUMN "effectiveStatus" TEXT;
ALTER TABLE "Ad"       ADD COLUMN "effectiveStatus" TEXT;
