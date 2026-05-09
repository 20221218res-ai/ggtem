CREATE TABLE "AdminFinanceCloseReport" (
  "id" TEXT NOT NULL,
  "range" TEXT NOT NULL,
  "fromAt" TIMESTAMP(3) NOT NULL,
  "toAt" TIMESTAMP(3) NOT NULL,
  "entryCount" INTEGER NOT NULL,
  "uniqueUsers" INTEGER NOT NULL,
  "creditAmount" DECIMAL(18,6) NOT NULL,
  "debitAmount" DECIMAL(18,6) NOT NULL,
  "netAmount" DECIMAL(18,6) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "note" TEXT,
  "closedById" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminFinanceCloseReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminFinanceCloseReport_range_closedAt_idx" ON "AdminFinanceCloseReport"("range", "closedAt");
CREATE INDEX "AdminFinanceCloseReport_closedById_closedAt_idx" ON "AdminFinanceCloseReport"("closedById", "closedAt");
