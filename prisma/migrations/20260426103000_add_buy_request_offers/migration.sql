CREATE TABLE "BuyRequestOffer" (
    "id" TEXT NOT NULL,
    "buyRequestId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" TEXT,
    "quantity" DECIMAL(24,6) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "totalAmount" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyRequestOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuyRequestOffer_buyRequestId_status_createdAt_idx" ON "BuyRequestOffer"("buyRequestId", "status", "createdAt");
CREATE INDEX "BuyRequestOffer_sellerId_status_createdAt_idx" ON "BuyRequestOffer"("sellerId", "status", "createdAt");
CREATE INDEX "BuyRequestOffer_listingId_idx" ON "BuyRequestOffer"("listingId");
CREATE UNIQUE INDEX "BuyRequestOffer_buyRequestId_sellerId_listingId_key" ON "BuyRequestOffer"("buyRequestId", "sellerId", "listingId");

ALTER TABLE "BuyRequestOffer" ADD CONSTRAINT "BuyRequestOffer_buyRequestId_fkey" FOREIGN KEY ("buyRequestId") REFERENCES "BuyRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyRequestOffer" ADD CONSTRAINT "BuyRequestOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyRequestOffer" ADD CONSTRAINT "BuyRequestOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
