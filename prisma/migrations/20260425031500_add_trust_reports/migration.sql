CREATE TABLE "TrustReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "orderId" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TrustReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrustReport_status_severity_createdAt_idx" ON "TrustReport"("status", "severity", "createdAt");
CREATE INDEX "TrustReport_targetUserId_status_idx" ON "TrustReport"("targetUserId", "status");
CREATE INDEX "TrustReport_reporterId_createdAt_idx" ON "TrustReport"("reporterId", "createdAt");
CREATE INDEX "TrustReport_orderId_idx" ON "TrustReport"("orderId");

ALTER TABLE "TrustReport" ADD CONSTRAINT "TrustReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrustReport" ADD CONSTRAINT "TrustReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrustReport" ADD CONSTRAINT "TrustReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
