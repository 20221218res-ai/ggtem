ALTER TABLE "Game"
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imageStoragePath" TEXT,
  ADD COLUMN "imageAlt" TEXT;

ALTER TABLE "Game" ALTER COLUMN "moneyUnitName" SET DEFAULT '게임머니';

UPDATE "Game"
SET "moneyUnitName" = '게임머니'
WHERE "moneyUnitName" = '寃뚯엫癒몃땲';