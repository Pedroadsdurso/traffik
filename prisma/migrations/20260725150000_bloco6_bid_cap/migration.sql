-- Bloco 6: bid cap e estratégia de lance, exibidos como colunas do gerenciador.
ALTER TABLE "Campaign" ADD COLUMN "bidStrategy" TEXT;
ALTER TABLE "AdSet" ADD COLUMN "bidAmount" DECIMAL(14,2);
