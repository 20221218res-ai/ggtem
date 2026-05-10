CREATE TABLE "SupportInquiry" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportInquiry_status_createdAt_idx" ON "SupportInquiry"("status", "createdAt");
CREATE INDEX "SupportInquiry_userId_createdAt_idx" ON "SupportInquiry"("userId", "createdAt");
CREATE INDEX "SupportInquiry_category_createdAt_idx" ON "SupportInquiry"("category", "createdAt");

ALTER TABLE "SupportInquiry"
  ADD CONSTRAINT "SupportInquiry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
