ALTER TABLE "Listing" ADD COLUMN "sellerGameNickname" TEXT;
ALTER TABLE "BuyRequest" ADD COLUMN "buyerGameNickname" TEXT;
ALTER TABLE "Order" ADD COLUMN "buyerGameNickname" TEXT;
ALTER TABLE "Order" ADD COLUMN "sellerGameNickname" TEXT;
