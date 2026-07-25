-- Bloco 5: persiste os eventos do pixel próprio para alimentar o funil
-- (o estágio "Initiate Checkout" não tinha fonte de dados).

CREATE TABLE "PixelEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventId" TEXT,
    "url" TEXT,
    "fbclid" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "pixelConfigId" TEXT,

    CONSTRAINT "PixelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PixelEvent_userId_event_timestamp_idx" ON "PixelEvent"("userId", "event", "timestamp");

ALTER TABLE "PixelEvent" ADD CONSTRAINT "PixelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
