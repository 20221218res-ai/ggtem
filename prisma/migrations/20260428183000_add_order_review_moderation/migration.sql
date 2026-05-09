CREATE TABLE "OrderReviewModeration" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "reason" TEXT,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReviewModeration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderReviewModeration_reviewId_key" ON "OrderReviewModeration"("reviewId");
CREATE INDEX "OrderReviewModeration_status_updatedAt_idx" ON "OrderReviewModeration"("status", "updatedAt");
CREATE INDEX "OrderReviewModeration_moderatedById_moderatedAt_idx" ON "OrderReviewModeration"("moderatedById", "moderatedAt");

ALTER TABLE "OrderReviewModeration" ADD CONSTRAINT "OrderReviewModeration_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "OrderReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
