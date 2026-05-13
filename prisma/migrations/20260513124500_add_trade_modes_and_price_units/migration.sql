ALTER TABLE "Listing"
ADD COLUMN "tradeMode" TEXT NOT NULL DEFAULT 'SPLIT',
ADD COLUMN "priceUnitQuantity" DECIMAL(24, 6) NOT NULL DEFAULT 1;

ALTER TABLE "BuyRequest"
ADD COLUMN "tradeMode" TEXT NOT NULL DEFAULT 'BULK',
ADD COLUMN "priceUnitQuantity" DECIMAL(24, 6) NOT NULL DEFAULT 1,
ADD COLUMN "minimumQuantity" DECIMAL(24, 6) NOT NULL DEFAULT 1,
ADD COLUMN "remainingQuantity" DECIMAL(24, 6) NOT NULL DEFAULT 0;

UPDATE "BuyRequest"
SET "remainingQuantity" = "quantity",
    "minimumQuantity" = "quantity"
WHERE "remainingQuantity" = 0;

UPDATE "Listing"
SET "priceUnitQuantity" = 10000
WHERE "category" = 'GAME_MONEY'
  AND "priceUnitQuantity" = 1;

UPDATE "BuyRequest"
SET "priceUnitQuantity" = 10000
WHERE "category" = 'GAME_MONEY'
  AND "priceUnitQuantity" = 1;

CREATE INDEX "Listing_category_tradeMode_idx" ON "Listing"("category", "tradeMode");
CREATE INDEX "BuyRequest_category_tradeMode_idx" ON "BuyRequest"("category", "tradeMode");
