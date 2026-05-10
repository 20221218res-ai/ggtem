ALTER TABLE "Listing" ADD COLUMN "serverDetail" TEXT;
ALTER TABLE "BuyRequest" ADD COLUMN "serverDetail" TEXT;

CREATE INDEX "Listing_gameId_serverId_serverDetail_category_status_idx"
  ON "Listing"("gameId", "serverId", "serverDetail", "category", "status");

CREATE INDEX "BuyRequest_gameId_serverId_serverDetail_category_status_idx"
  ON "BuyRequest"("gameId", "serverId", "serverDetail", "category", "status");
