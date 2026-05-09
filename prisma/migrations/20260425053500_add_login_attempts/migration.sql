CREATE TABLE "LoginAttempt" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ipKey" TEXT NOT NULL,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginAttempt_email_ipKey_key" ON "LoginAttempt"("email", "ipKey");
CREATE INDEX "LoginAttempt_email_lockedUntil_idx" ON "LoginAttempt"("email", "lockedUntil");
CREATE INDEX "LoginAttempt_ipKey_lockedUntil_idx" ON "LoginAttempt"("ipKey", "lockedUntil");
