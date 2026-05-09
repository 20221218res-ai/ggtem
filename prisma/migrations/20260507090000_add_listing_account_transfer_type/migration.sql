ALTER TABLE "Listing" ADD COLUMN "accountTransferType" TEXT;

CREATE INDEX "Listing_category_accountTransferType_idx" ON "Listing"("category", "accountTransferType");
CREATE INDEX "BuyRequest_category_accountTransferType_idx" ON "BuyRequest"("category", "accountTransferType");
