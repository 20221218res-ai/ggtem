CREATE TABLE "AdminSlaIncident" (
  "id" TEXT NOT NULL,
  "queueKey" TEXT NOT NULL,
  "activeKey" TEXT,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL,
  "priorityScore" INTEGER NOT NULL,
  "slaLabel" TEXT NOT NULL,
  "previewLabel" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "AdminSlaIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSlaIncident_activeKey_key"
ON "AdminSlaIncident"("activeKey");

CREATE INDEX "AdminSlaIncident_status_lastDetectedAt_idx"
ON "AdminSlaIncident"("status", "lastDetectedAt");

CREATE INDEX "AdminSlaIncident_queueKey_status_idx"
ON "AdminSlaIncident"("queueKey", "status");
