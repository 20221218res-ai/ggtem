CREATE TABLE "OrderAccountCredential" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyerFirstViewedAt" TIMESTAMP(3),
    "buyerLastViewedAt" TIMESTAMP(3),
    "buyerViewCount" INTEGER NOT NULL DEFAULT 0,
    "sellerLastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAccountCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderAccountCredential_orderId_key" ON "OrderAccountCredential"("orderId");
CREATE INDEX "OrderAccountCredential_sellerId_submittedAt_idx" ON "OrderAccountCredential"("sellerId", "submittedAt");
CREATE INDEX "OrderAccountCredential_buyerId_submittedAt_idx" ON "OrderAccountCredential"("buyerId", "submittedAt");

ALTER TABLE "OrderAccountCredential"
ADD CONSTRAINT "OrderAccountCredential_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
