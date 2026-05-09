ALTER TABLE "Game" ADD COLUMN "moneyUnitName" TEXT NOT NULL DEFAULT '게임머니';

UPDATE "Game"
SET "moneyUnitName" = '아데나'
WHERE lower("name") LIKE '%lineage%'
   OR "name" LIKE '%리니지%';
