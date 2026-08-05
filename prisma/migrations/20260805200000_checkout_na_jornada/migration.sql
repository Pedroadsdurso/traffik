-- O funil passa a ser do RASTREAMENTO: a etapa "Initiate Checkout" vive na
-- JORNADA (Click), nao em PixelEvent.
--
-- Antes, navegador e webhook do gateway criavam cada um o seu PixelEvent e a
-- dedup era chaveada em `fbclid` -- que so existe para trafego de anuncio do
-- Facebook. Em trafego direto a chave era ausente e a MESMA jornada contava
-- duas vezes. Com o checkout marcado na jornada, as duas fontes escrevem na
-- mesma linha e duplicar deixa de ser possivel.
--
-- ADITIVA: tres colunas nullable e dois indices. O build antigo ignora coluna
-- que nao conhece, entao a ordem migration->deploy continua sendo a segura.
-- Sem backfill: `checkoutAt` nulo significa "nao chegou ao checkout", e o
-- historico de PixelEvent continua no banco (ver `npm run checkout:backfill`).

ALTER TABLE "Click" ADD COLUMN "checkoutAt" TIMESTAMP(3);
ALTER TABLE "Click" ADD COLUMN "checkoutSource" TEXT;

ALTER TABLE "PixelEvent" ADD COLUMN "clickId" TEXT;

CREATE INDEX "Click_userId_checkoutAt_idx" ON "Click"("userId", "checkoutAt");
CREATE INDEX "PixelEvent_clickId_idx" ON "PixelEvent"("clickId");

-- SetNull, nunca Cascade: apagar o clique nao pode apagar o evento que ja foi
-- despachado para a Meta.
ALTER TABLE "PixelEvent" ADD CONSTRAINT "PixelEvent_clickId_fkey"
  FOREIGN KEY ("clickId") REFERENCES "Click"("id") ON DELETE SET NULL ON UPDATE CASCADE;
