CREATE TABLE "AdminInviteToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminInviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminInviteToken_tokenHash_key" ON "AdminInviteToken"("tokenHash");
CREATE INDEX "AdminInviteToken_userId_expiresAt_idx" ON "AdminInviteToken"("userId", "expiresAt");
CREATE INDEX "AdminInviteToken_createdById_createdAt_idx" ON "AdminInviteToken"("createdById", "createdAt");

ALTER TABLE "AdminInviteToken" ADD CONSTRAINT "AdminInviteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminInviteToken" ADD CONSTRAINT "AdminInviteToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
