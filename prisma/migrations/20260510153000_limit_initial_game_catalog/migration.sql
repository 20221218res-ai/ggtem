WITH allowed_games("name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt") AS (
  VALUES
    ('Aion 2', 'aion-2', '아이온2', '永恒之塔2', 'Aion 2', 'Aion 2', 'ไอออน 2', '키나', '/api/game-card/aion-2', 'Aion 2 GGtem game card'),
    ('Lineage Classic', 'lineage-classic', '리니지 클래식', '天堂经典', 'Lineage Classic', 'Lineage Classic', 'ไลน์เอจ คลาสสิก', '아데나', '/api/game-card/lineage-classic', 'Lineage Classic GGtem game card'),
    ('Lineage M', 'lineage-m', '리니지M', '天堂M', 'Lineage M', 'Lineage M', 'ไลน์เอจ M', '다이아', '/api/game-card/lineage-m', 'Lineage M GGtem game card'),
    ('Lineage W', 'lineage-w', '리니지W', '天堂W', 'Lineage W', 'Lineage W', 'ไลน์เอจ W', '아데나', '/api/game-card/lineage-w', 'Lineage W GGtem game card'),
    ('Lineage2M', 'lineage2m', '리니지2M', '天堂2M', 'Lineage2M', 'Lineage2M', 'ไลน์เอจ 2M', '다이아', '/api/game-card/lineage2m', 'Lineage2M GGtem game card')
)
INSERT INTO "Game" ("id", "name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  allowed_games."name",
  allowed_games."code",
  allowed_games."nameKo",
  allowed_games."nameCn",
  allowed_games."nameVn",
  allowed_games."namePh",
  allowed_games."nameTh",
  allowed_games."moneyUnitName",
  allowed_games."imageUrl",
  allowed_games."imageAlt",
  true,
  now()
FROM allowed_games
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "nameKo" = EXCLUDED."nameKo",
  "nameCn" = EXCLUDED."nameCn",
  "nameVn" = EXCLUDED."nameVn",
  "namePh" = EXCLUDED."namePh",
  "nameTh" = EXCLUDED."nameTh",
  "moneyUnitName" = EXCLUDED."moneyUnitName",
  "imageUrl" = EXCLUDED."imageUrl",
  "imageAlt" = EXCLUDED."imageAlt",
  "isActive" = true;

UPDATE "Game"
SET "isActive" = false
WHERE "code" NOT IN ('aion-2', 'lineage-classic', 'lineage-m', 'lineage-w', 'lineage2m')
  AND "isActive" = true;

WITH server_seed("gameCode", "name", "code") AS (
  VALUES
    ('aion-2', 'Global', 'global'),
    ('lineage-classic', 'Global', 'global'),
    ('lineage-m', 'Global', 'global'),
    ('lineage-w', 'Aphrodite', 'aphrodite'),
    ('lineage2m', 'Global', 'global')
)
INSERT INTO "GameServer" ("id", "gameId", "name", "code", "isActive")
SELECT
  gen_random_uuid()::text,
  "Game"."id",
  server_seed."name",
  server_seed."code",
  true
FROM server_seed
JOIN "Game" ON "Game"."code" = server_seed."gameCode"
ON CONFLICT ("gameId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isActive" = true;
