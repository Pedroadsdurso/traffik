-- Bloco 2: layout do grid arrastável do Dashboard, por usuário e por viewport.

-- CreateTable
CREATE TABLE "DashboardLayout" (
    "id" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardLayout_userId_idx" ON "DashboardLayout"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardLayout_userId_viewport_key" ON "DashboardLayout"("userId", "viewport");

-- AddForeignKey
ALTER TABLE "DashboardLayout" ADD CONSTRAINT "DashboardLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
