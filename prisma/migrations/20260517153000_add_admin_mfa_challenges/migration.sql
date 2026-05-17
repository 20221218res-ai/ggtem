CREATE TABLE "AdminMfaChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestIpKey" TEXT,

  CONSTRAINT "AdminMfaChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminMfaChallenge_tokenHash_key" ON "AdminMfaChallenge"("tokenHash");
CREATE INDEX "AdminMfaChallenge_userId_expiresAt_idx" ON "AdminMfaChallenge"("userId", "expiresAt");

ALTER TABLE "AdminMfaChallenge"
  ADD CONSTRAINT "AdminMfaChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
