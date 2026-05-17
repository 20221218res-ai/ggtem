ALTER TABLE "AdminMfaChallenge"
  ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE INDEX "AdminMfaChallenge_userId_createdAt_idx" ON "AdminMfaChallenge"("userId", "createdAt");
