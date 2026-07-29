-- Limites de segurança das regras de automação (Bloco 8).
--
-- ⚠️ ADITIVA E NULLABLE. Não existe nenhuma regra cadastrada hoje, então não há
-- backfill — mas o motor trata NULO de forma FAIL-CLOSED: sem teto de
-- orçamento ele RECUSA aumentar, em vez de aumentar sem limite.
--
-- 🔴 Por que o teto é a coluna mais importante daqui: uma regra "+20%" sem teto
-- multiplica o orçamento a cada execução (100 → 120 → 144 → 173…), com
-- dinheiro real, e nada no código anterior impedia.
ALTER TABLE "AutomationRule" ADD COLUMN "targetProducts" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AutomationRule" ADD COLUMN "maxBudget" DECIMAL(14,2);
ALTER TABLE "AutomationRule" ADD COLUMN "windowStartHour" INTEGER;
ALTER TABLE "AutomationRule" ADD COLUMN "windowEndHour" INTEGER;
