CREATE INDEX "Listing_status_createdAt_idx" ON "public"."Listing"("status", "createdAt");
CREATE INDEX "Listing_status_unitPrice_idx" ON "public"."Listing"("status", "unitPrice");
CREATE INDEX "BuyRequest_status_createdAt_idx" ON "public"."BuyRequest"("status", "createdAt");
CREATE INDEX "BuyRequest_status_unitPrice_idx" ON "public"."BuyRequest"("status", "unitPrice");
