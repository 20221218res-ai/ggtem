CREATE TABLE "AdminUserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUserNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminUserNote_userId_createdAt_idx" ON "AdminUserNote"("userId", "createdAt");
CREATE INDEX "AdminUserNote_adminId_createdAt_idx" ON "AdminUserNote"("adminId", "createdAt");

ALTER TABLE "AdminUserNote" ADD CONSTRAINT "AdminUserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminUserNote" ADD CONSTRAINT "AdminUserNote_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
