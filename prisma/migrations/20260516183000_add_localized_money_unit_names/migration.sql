ALTER TABLE "Game"
ADD COLUMN "moneyUnitNameKo" TEXT,
ADD COLUMN "moneyUnitNameCn" TEXT,
ADD COLUMN "moneyUnitNameVn" TEXT,
ADD COLUMN "moneyUnitNamePh" TEXT,
ADD COLUMN "moneyUnitNameTh" TEXT;

UPDATE "Game"
SET "moneyUnitNameKo" = "moneyUnitName"
WHERE "moneyUnitNameKo" IS NULL;
