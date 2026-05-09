ALTER TABLE "TrustReport"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT;

CREATE UNIQUE INDEX "TrustReport_sourceType_sourceId_key"
ON "TrustReport"("sourceType", "sourceId");
