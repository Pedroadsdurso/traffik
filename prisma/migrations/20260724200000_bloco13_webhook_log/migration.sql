-- Bloco 13: log cru dos payloads recebidos por webhook, para a aba Testes.

-- CreateEnum
CREATE TYPE "WebhookLogStatus" AS ENUM ('RECEBIDO', 'PROCESSADO', 'REJEITADO', 'ERRO');

-- CreateTable
CREATE TABLE "WebhookLog" (
    "gateway" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payloadRaw" JSONB NOT NULL,
    "status" "WebhookLogStatus" NOT NULL DEFAULT 'RECEBIDO',
    "message" TEXT,
    "httpStatus" INTEGER,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "webhookId" TEXT,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookLog_userId_createdAt_idx" ON "WebhookLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_gateway_idx" ON "WebhookLog"("gateway");

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
