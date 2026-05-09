CREATE TABLE "DepositWalletAddress" (
    "id" TEXT NOT NULL,
    "chain" "WithdrawalChain" NOT NULL,
    "label" TEXT NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "networkName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "minimumAmount" DECIMAL(18,6) NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositWalletAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepositWalletAddress_chain_key" ON "DepositWalletAddress"("chain");
CREATE INDEX "DepositWalletAddress_isActive_sortOrder_idx" ON "DepositWalletAddress"("isActive", "sortOrder");
CREATE INDEX "DepositWalletAddress_updatedByAdminId_updatedAt_idx" ON "DepositWalletAddress"("updatedByAdminId", "updatedAt");
