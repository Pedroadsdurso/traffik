-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REEMBOLSADA', 'CHARGEBACK', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CARTAO', 'BOLETO', 'OUTRO');

-- CreateEnum
CREATE TYPE "WebhookPlatform" AS ENUM ('KIRVANO', 'HOTMART', 'KIWIFY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RuleLevel" AS ENUM ('CAMPAIGN', 'ADSET', 'AD');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('ATIVAR', 'PAUSAR', 'AJUSTAR_ORCAMENTO');

-- CreateEnum
CREATE TYPE "RuleRunStatus" AS ENUM ('SUCESSO', 'SEM_ACAO', 'ERRO');

-- CreateEnum
CREATE TYPE "PixelEventType" AS ENUM ('LEAD', 'ADD_TO_CART', 'INITIATE_CHECKOUT', 'PURCHASE');

-- CreateEnum
CREATE TYPE "PurchaseSendMode" AS ENUM ('TODAS', 'APENAS_APROVADAS');

-- CreateEnum
CREATE TYPE "PurchaseValueMode" AS ENUM ('VALOR_DA_VENDA', 'VALOR_FIXO');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('TAXA_GATEWAY', 'IMPOSTO', 'DESPESA_RECORRENTE');

-- CreateEnum
CREATE TYPE "ExpenseCalc" AS ENUM ('PERCENTUAL', 'FIXO');

-- CreateEnum
CREATE TYPE "ExpenseRecurrence" AS ENUM ('UNICA', 'DIARIA', 'SEMANAL', 'MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VENDA_PENDENTE', 'VENDA_APROVADA', 'RELATORIO', 'REGRA_EXECUTADA', 'SISTEMA');

-- CreateEnum
CREATE TYPE "ReportPattern" AS ENUM ('STATUS_LUCRO', 'RESUMO_DETALHADO', 'NOTIFICACOES_CRIATIVAS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdProfile" (
    "id" TEXT NOT NULL,
    "fbUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "pictureUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AdProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "fbAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "timezone" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "adProfileId" TEXT,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "fbCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "objective" TEXT,
    "dailyBudget" DECIMAL(14,2),
    "lifetimeBudget" DECIMAL(14,2),
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adAccountId" TEXT NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" TEXT NOT NULL,
    "fbAdSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "dailyBudget" DECIMAL(14,2),
    "lifetimeBudget" DECIMAL(14,2),
    "optimizationGoal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,

    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "fbAdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "fbCreativeId" TEXT,
    "name" TEXT,
    "title" TEXT,
    "body" TEXT,
    "thumbnailUrl" TEXT,
    "imageUrl" TEXT,
    "videoId" TEXT,
    "callToAction" TEXT,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adId" TEXT NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAdMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "cpm" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adId" TEXT NOT NULL,

    CONSTRAINT "DailyAdMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "ttclid" TEXT,
    "url" TEXT,
    "referrer" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "value" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "product" TEXT NOT NULL,
    "productId" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDENTE',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'OUTRO',
    "buyerEmail" TEXT,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "country" TEXT,
    "matchMethod" TEXT,
    "rawPayload" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "clickId" TEXT,
    "webhookId" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "WebhookPlatform" NOT NULL DEFAULT 'CUSTOM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixelConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pixelId" TEXT NOT NULL,
    "accessToken" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'META',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "adAccountId" TEXT,

    CONSTRAINT "PixelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixelEventRule" (
    "id" TEXT NOT NULL,
    "eventType" "PixelEventType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "detection" JSONB,
    "sendMode" "PurchaseSendMode" DEFAULT 'APENAS_APROVADAS',
    "valueMode" "PurchaseValueMode" DEFAULT 'VALOR_DA_VENDA',
    "fixedValue" DECIMAL(14,2),
    "targetProduct" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pixelConfigId" TEXT NOT NULL,

    CONSTRAINT "PixelEventRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetProduct" TEXT,
    "adAccountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "level" "RuleLevel" NOT NULL DEFAULT 'CAMPAIGN',
    "nameFilter" TEXT,
    "action" "RuleAction" NOT NULL,
    "actionParams" JSONB,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "calcPeriod" TEXT NOT NULL DEFAULT 'hoje',
    "frequencyMin" INTEGER NOT NULL DEFAULT 30,
    "dailyRunLimit" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRuleLog" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RuleRunStatus" NOT NULL,
    "details" JSONB,
    "message" TEXT,
    "affected" INTEGER NOT NULL DEFAULT 0,
    "ruleId" TEXT NOT NULL,

    CONSTRAINT "AutomationRuleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "saleId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "notifyPendingSale" BOOLEAN NOT NULL DEFAULT true,
    "notifyApprovedSale" BOOLEAN NOT NULL DEFAULT true,
    "showValue" BOOLEAN NOT NULL DEFAULT true,
    "showProductName" BOOLEAN NOT NULL DEFAULT true,
    "showUtmCampaign" BOOLEAN NOT NULL DEFAULT true,
    "showDashboardName" BOOLEAN NOT NULL DEFAULT false,
    "report08" BOOLEAN NOT NULL DEFAULT false,
    "report12" BOOLEAN NOT NULL DEFAULT false,
    "report18" BOOLEAN NOT NULL DEFAULT false,
    "report23" BOOLEAN NOT NULL DEFAULT true,
    "reportPattern" "ReportPattern" NOT NULL DEFAULT 'STATUS_LUCRO',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "calc" "ExpenseCalc" NOT NULL DEFAULT 'PERCENTUAL',
    "amount" DECIMAL(14,4) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "recurrence" "ExpenseRecurrence" NOT NULL DEFAULT 'UNICA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardPreference" (
    "id" TEXT NOT NULL,
    "visibility" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AdProfile_userId_idx" ON "AdProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdProfile_userId_fbUserId_key" ON "AdProfile"("userId", "fbUserId");

-- CreateIndex
CREATE INDEX "AdAccount_userId_idx" ON "AdAccount"("userId");

-- CreateIndex
CREATE INDEX "AdAccount_adProfileId_idx" ON "AdAccount"("adProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_userId_fbAccountId_key" ON "AdAccount"("userId", "fbAccountId");

-- CreateIndex
CREATE INDEX "Campaign_adAccountId_idx" ON "Campaign"("adAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_adAccountId_fbCampaignId_key" ON "Campaign"("adAccountId", "fbCampaignId");

-- CreateIndex
CREATE INDEX "AdSet_campaignId_idx" ON "AdSet"("campaignId");

-- CreateIndex
CREATE INDEX "AdSet_adAccountId_idx" ON "AdSet"("adAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AdSet_adAccountId_fbAdSetId_key" ON "AdSet"("adAccountId", "fbAdSetId");

-- CreateIndex
CREATE INDEX "Ad_campaignId_idx" ON "Ad"("campaignId");

-- CreateIndex
CREATE INDEX "Ad_adSetId_idx" ON "Ad"("adSetId");

-- CreateIndex
CREATE INDEX "Ad_adAccountId_idx" ON "Ad"("adAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Ad_adAccountId_fbAdId_key" ON "Ad"("adAccountId", "fbAdId");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_adId_key" ON "Creative"("adId");

-- CreateIndex
CREATE INDEX "DailyAdMetric_date_idx" ON "DailyAdMetric"("date");

-- CreateIndex
CREATE INDEX "DailyAdMetric_adId_idx" ON "DailyAdMetric"("adId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAdMetric_adId_date_key" ON "DailyAdMetric"("adId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Click_clickId_key" ON "Click"("clickId");

-- CreateIndex
CREATE INDEX "Click_clickId_idx" ON "Click"("clickId");

-- CreateIndex
CREATE INDEX "Click_utmCampaign_idx" ON "Click"("utmCampaign");

-- CreateIndex
CREATE INDEX "Click_timestamp_idx" ON "Click"("timestamp");

-- CreateIndex
CREATE INDEX "Click_userId_timestamp_idx" ON "Click"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "Click_fbclid_idx" ON "Click"("fbclid");

-- CreateIndex
CREATE INDEX "Click_ip_idx" ON "Click"("ip");

-- CreateIndex
CREATE INDEX "Sale_clickId_idx" ON "Sale"("clickId");

-- CreateIndex
CREATE INDEX "Sale_timestamp_idx" ON "Sale"("timestamp");

-- CreateIndex
CREATE INDEX "Sale_userId_timestamp_idx" ON "Sale"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_buyerEmail_idx" ON "Sale"("buyerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_userId_externalId_key" ON "Sale"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_token_key" ON "Webhook"("token");

-- CreateIndex
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");

-- CreateIndex
CREATE INDEX "Webhook_token_idx" ON "Webhook"("token");

-- CreateIndex
CREATE INDEX "PixelConfig_userId_idx" ON "PixelConfig"("userId");

-- CreateIndex
CREATE INDEX "PixelConfig_adAccountId_idx" ON "PixelConfig"("adAccountId");

-- CreateIndex
CREATE INDEX "PixelEventRule_pixelConfigId_idx" ON "PixelEventRule"("pixelConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "PixelEventRule_pixelConfigId_eventType_key" ON "PixelEventRule"("pixelConfigId", "eventType");

-- CreateIndex
CREATE INDEX "AutomationRule_userId_idx" ON "AutomationRule"("userId");

-- CreateIndex
CREATE INDEX "AutomationRule_active_idx" ON "AutomationRule"("active");

-- CreateIndex
CREATE INDEX "AutomationRuleLog_ruleId_ranAt_idx" ON "AutomationRuleLog"("ruleId", "ranAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_timestamp_idx" ON "Notification"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- CreateIndex
CREATE INDEX "Expense_userId_type_idx" ON "Expense"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardPreference_userId_key" ON "DashboardPreference"("userId");

-- AddForeignKey
ALTER TABLE "AdProfile" ADD CONSTRAINT "AdProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_adProfileId_fkey" FOREIGN KEY ("adProfileId") REFERENCES "AdProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAdMetric" ADD CONSTRAINT "DailyAdMetric_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "Click"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelConfig" ADD CONSTRAINT "PixelConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelConfig" ADD CONSTRAINT "PixelConfig_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelEventRule" ADD CONSTRAINT "PixelEventRule_pixelConfigId_fkey" FOREIGN KEY ("pixelConfigId") REFERENCES "PixelConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRuleLog" ADD CONSTRAINT "AutomationRuleLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardPreference" ADD CONSTRAINT "DashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
