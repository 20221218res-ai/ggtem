ALTER TYPE "WalletLedgerType" ADD VALUE IF NOT EXISTS 'PREMIUM_PROMOTION_PURCHASED';

ALTER TABLE "Listing"
  ADD COLUMN "premiumStartedAt" TIMESTAMP(3),
  ADD COLUMN "premiumEndsAt" TIMESTAMP(3),
  ADD COLUMN "premiumDurationHours" INTEGER,
  ADD COLUMN "premiumFeeAmount" DECIMAL(18, 6);

ALTER TABLE "BuyRequest"
  ADD COLUMN "premiumStartedAt" TIMESTAMP(3),
  ADD COLUMN "premiumEndsAt" TIMESTAMP(3),
  ADD COLUMN "premiumDurationHours" INTEGER,
  ADD COLUMN "premiumFeeAmount" DECIMAL(18, 6);

CREATE INDEX "Listing_premiumEndsAt_idx" ON "Listing"("premiumEndsAt");
CREATE INDEX "BuyRequest_premiumEndsAt_idx" ON "BuyRequest"("premiumEndsAt");
