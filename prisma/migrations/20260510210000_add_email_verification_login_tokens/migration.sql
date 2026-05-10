CREATE TABLE "EmailVerificationLoginToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationLoginToken_tokenHash_key" ON "EmailVerificationLoginToken"("tokenHash");

CREATE INDEX "EmailVerificationLoginToken_userId_expiresAt_idx" ON "EmailVerificationLoginToken"("userId", "expiresAt");

ALTER TABLE "EmailVerificationLoginToken"
ADD CONSTRAINT "EmailVerificationLoginToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
