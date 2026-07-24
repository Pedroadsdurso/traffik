-- AlterTable
ALTER TABLE "PixelConfig" ALTER COLUMN "pixelId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MetaPixel" (
    "id" TEXT NOT NULL,
    "pixelId" TEXT NOT NULL,
    "accessToken" TEXT,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pixelConfigId" TEXT NOT NULL,

    CONSTRAINT "MetaPixel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaPixel_pixelConfigId_idx" ON "MetaPixel"("pixelConfigId");

-- AddForeignKey
ALTER TABLE "MetaPixel" ADD CONSTRAINT "MetaPixel_pixelConfigId_fkey" FOREIGN KEY ("pixelConfigId") REFERENCES "PixelConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
