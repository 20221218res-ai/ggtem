CREATE INDEX IF NOT EXISTS "Listing_status_category_created_idx"
  ON "Listing"("status", "category", "createdAt");

CREATE INDEX IF NOT EXISTS "Listing_active_filter_created_idx"
  ON "Listing"("status", "gameId", "serverId", "category", "createdAt");

CREATE INDEX IF NOT EXISTS "BuyRequest_status_category_created_idx"
  ON "BuyRequest"("status", "category", "createdAt");

CREATE INDEX IF NOT EXISTS "BuyRequest_active_filter_created_idx"
  ON "BuyRequest"("status", "gameId", "serverId", "category", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_buyer_updated_idx"
  ON "Order"("buyerId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Order_seller_updated_idx"
  ON "Order"("sellerId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_room_read_sender_idx"
  ON "ChatMessage"("roomId", "readAt", "senderId");

CREATE INDEX IF NOT EXISTS "Notification_user_read_type_created_idx"
  ON "Notification"("userId", "isRead", "type", "createdAt");
