CREATE TYPE "WithdrawalChain" AS ENUM ('TRC20', 'BEP20');

ALTER TABLE "WithdrawalRequest"
  ADD COLUMN "fee" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN "netAmount" DECIMAL(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN "chain" "WithdrawalChain",
  ADD COLUMN "riskFlags" JSONB,
  ADD COLUMN "requestIpKey" TEXT,
  ADD COLUMN "deviceKey" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3);

UPDATE "WithdrawalRequest"
SET
  "netAmount" = "amount",
  "chain" = CASE
    WHEN upper("destination") LIKE '%BEP20%' THEN 'BEP20'::"WithdrawalChain"
    ELSE 'TRC20'::"WithdrawalChain"
  END
WHERE "netAmount" = 0;

CREATE INDEX "WithdrawalRequest_status_requestedAt_idx"
  ON "WithdrawalRequest"("status", "requestedAt");

CREATE INDEX "WithdrawalRequest_requestIpKey_requestedAt_idx"
  ON "WithdrawalRequest"("requestIpKey", "requestedAt");

CREATE INDEX "WithdrawalRequest_deviceKey_requestedAt_idx"
  ON "WithdrawalRequest"("deviceKey", "requestedAt");

CREATE TABLE "WithdrawalLog" (
  "id" TEXT NOT NULL,
  "withdrawalRequestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "statusFrom" TEXT,
  "statusTo" TEXT,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WithdrawalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WithdrawalLog_withdrawalRequestId_createdAt_idx"
  ON "WithdrawalLog"("withdrawalRequestId", "createdAt");

CREATE INDEX "WithdrawalLog_userId_createdAt_idx"
  ON "WithdrawalLog"("userId", "createdAt");

ALTER TABLE "WithdrawalLog"
  ADD CONSTRAINT "WithdrawalLog_withdrawalRequestId_fkey"
  FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
