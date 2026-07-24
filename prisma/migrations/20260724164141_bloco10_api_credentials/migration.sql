-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiCredential_key_key" ON "ApiCredential"("key");

-- CreateIndex
CREATE INDEX "ApiCredential_userId_idx" ON "ApiCredential"("userId");

-- CreateIndex
CREATE INDEX "ApiCredential_key_idx" ON "ApiCredential"("key");

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
