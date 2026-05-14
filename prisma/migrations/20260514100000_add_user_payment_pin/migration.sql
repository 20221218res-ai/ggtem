ALTER TABLE "User"
  ADD COLUMN "paymentPinHash" TEXT,
  ADD COLUMN "paymentPinSetAt" TIMESTAMP(3),
  ADD COLUMN "paymentPinUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "paymentPinResetAt" TIMESTAMP(3);
