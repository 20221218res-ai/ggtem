CREATE TABLE "AdminSlaIncidentNote" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSlaIncidentNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminSlaIncidentNote_incidentId_createdAt_idx" ON "AdminSlaIncidentNote"("incidentId", "createdAt");

CREATE INDEX "AdminSlaIncidentNote_adminId_createdAt_idx" ON "AdminSlaIncidentNote"("adminId", "createdAt");

ALTER TABLE "AdminSlaIncidentNote" ADD CONSTRAINT "AdminSlaIncidentNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "AdminSlaIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminSlaIncidentNote" ADD CONSTRAINT "AdminSlaIncidentNote_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
