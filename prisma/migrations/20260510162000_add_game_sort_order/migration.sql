ALTER TABLE "Game" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 100;

UPDATE "Game"
SET "sortOrder" = CASE "code"
  WHEN 'lineage-classic' THEN 1
  WHEN 'aion-2' THEN 2
  WHEN 'lineage-m' THEN 3
  WHEN 'lineage2m' THEN 4
  WHEN 'lineage-w' THEN 5
  ELSE 100
END;

CREATE INDEX "Game_isActive_sortOrder_idx" ON "Game"("isActive", "sortOrder");
