ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "nameKo" TEXT,
  ADD COLUMN IF NOT EXISTS "nameCn" TEXT,
  ADD COLUMN IF NOT EXISTS "nameVn" TEXT,
  ADD COLUMN IF NOT EXISTS "namePh" TEXT,
  ADD COLUMN IF NOT EXISTS "nameTh" TEXT;

WITH game_seed("name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt") AS (
  VALUES
    ('Lineage W', 'lineage-w', '리니지W', '天堂W', 'Lineage W', 'Lineage W', 'ไลน์เอจ W', '아데나', '/api/game-card/lineage-w', 'Lineage W GGtem game card'),
    ('Lineage Classic', 'lineage-classic', '리니지 클래식', '天堂经典', 'Lineage Classic', 'Lineage Classic', 'ไลน์เอจ คลาสสิก', '아데나', '/api/game-card/lineage-classic', 'Lineage Classic GGtem game card'),
    ('Aion 2', 'aion-2', '아이온2', '永恒之塔2', 'Aion 2', 'Aion 2', 'ไอออน 2', '키나', '/api/game-card/aion-2', 'Aion 2 GGtem game card'),
    ('Lineage M', 'lineage-m', '리니지M', '天堂M', 'Lineage M', 'Lineage M', 'ไลน์เอจ M', '다이아', '/api/game-card/lineage-m', 'Lineage M GGtem game card'),
    ('MapleStory Worlds', 'maplestory-worlds', '메이플스토리월드', '冒险岛世界', 'MapleStory Worlds', 'MapleStory Worlds', 'เมเปิลสตอรี่เวิลด์', '메소', '/api/game-card/maplestory-worlds', 'MapleStory Worlds GGtem game card'),
    ('Lord Nine', 'lord-nine', '로드나인', '洛德九', 'Lord Nine', 'Lord Nine', 'ลอร์ดไนน์', '다이아', '/api/game-card/lord-nine', 'Lord Nine GGtem game card'),
    ('Chosun Hyeopgaekjeon Classic', 'chosun-hyeopgaekjeon-classic', '조선협객전 클래식', '朝鲜侠客传经典', 'Chosun Hyeopgaekjeon Classic', 'Chosun Hyeopgaekjeon Classic', 'โชซอนฮยอบแกกจอน คลาสสิก', '전', '/api/game-card/chosun-hyeopgaekjeon-classic', 'Chosun Hyeopgaekjeon Classic GGtem game card'),
    ('Vampir', 'vampir', '뱀피르', '吸血鬼', 'Vampir', 'Vampir', 'แวมไพร์', '골드', '/api/game-card/vampir', 'Vampir GGtem game card'),
    ('Night Crows', 'night-crows', '나이트 크로우', '夜鸦', 'Night Crows', 'Night Crows', 'ไนท์โครว์', '다이아', '/api/game-card/night-crows', 'Night Crows GGtem game card'),
    ('Lineage2M', 'lineage2m', '리니지2M', '天堂2M', 'Lineage2M', 'Lineage2M', 'ไลน์เอจ 2M', '다이아', '/api/game-card/lineage2m', 'Lineage2M GGtem game card'),
    ('Archetic Land', 'archetic-land', '아키텍트 랜드 오브 엑자일', 'Architect: Land of Exiles', 'Archetic Land', 'Archetic Land', 'อาร์คีเทคติก แลนด์', '골드', '/api/game-card/archetic-land', 'Archetic Land GGtem game card'),
    ('RF Online Next', 'rf-online-next', 'RF온라인 넥스트', 'RF Online Next', 'RF Online Next', 'RF Online Next', 'RF Online Next', '크레딧', '/api/game-card/rf-online-next', 'RF Online Next GGtem game card'),
    ('Ragnarok Online', 'ragnarok-online', '라그나로크 온라인', '仙境传说', 'Ragnarok Online', 'Ragnarok Online', 'แร็กนาร็อกออนไลน์', '제니', '/api/game-card/ragnarok-online', 'Ragnarok Online GGtem game card'),
    ('Dungeon & Fighter', 'dungeon-fighter', '던전앤파이터', '地下城与勇士', 'Dungeon & Fighter', 'Dungeon & Fighter', 'ดันเจี้ยนไฟเตอร์', '골드', '/api/game-card/dungeon-fighter', 'Dungeon & Fighter GGtem game card'),
    ('Odin: Valhalla Rising', 'odin-valhalla-rising', '오딘: 발할라 라이징', '奥丁：英灵殿崛起', 'Odin: Valhalla Rising', 'Odin: Valhalla Rising', 'โอดิน: วัลฮัลลาไรซิง', '다이아', '/api/game-card/odin-valhalla-rising', 'Odin: Valhalla Rising GGtem game card'),
    ('Genshin Impact', 'genshin-impact', '원신', '原神', 'Genshin Impact', 'Genshin Impact', 'เกนชินอิมแพกต์', '원석', '/api/game-card/genshin-impact', 'Genshin Impact GGtem game card')
)
INSERT INTO "Game" ("id", "name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  game_seed."name",
  game_seed."code",
  game_seed."nameKo",
  game_seed."nameCn",
  game_seed."nameVn",
  game_seed."namePh",
  game_seed."nameTh",
  game_seed."moneyUnitName",
  game_seed."imageUrl",
  game_seed."imageAlt",
  true,
  now()
FROM game_seed
ON CONFLICT ("name") DO UPDATE SET
  "code" = EXCLUDED."code",
  "nameKo" = EXCLUDED."nameKo",
  "nameCn" = EXCLUDED."nameCn",
  "nameVn" = EXCLUDED."nameVn",
  "namePh" = EXCLUDED."namePh",
  "nameTh" = EXCLUDED."nameTh",
  "moneyUnitName" = COALESCE(NULLIF("Game"."moneyUnitName", ''), EXCLUDED."moneyUnitName"),
  "imageUrl" = COALESCE("Game"."imageUrl", EXCLUDED."imageUrl"),
  "imageAlt" = COALESCE("Game"."imageAlt", EXCLUDED."imageAlt");

WITH server_seed("gameCode", "name", "code") AS (
  VALUES
    ('lineage-w', 'Aphrodite', 'aphrodite'),
    ('lineage-classic', 'Global', 'global'),
    ('aion-2', 'Global', 'global'),
    ('lineage-m', 'Global', 'global'),
    ('maplestory-worlds', 'Global', 'global'),
    ('lord-nine', 'Global', 'global'),
    ('chosun-hyeopgaekjeon-classic', 'Global', 'global'),
    ('vampir', 'Global', 'global'),
    ('night-crows', 'Global', 'global'),
    ('lineage2m', 'Global', 'global'),
    ('archetic-land', 'Global', 'global'),
    ('rf-online-next', 'Global', 'global'),
    ('ragnarok-online', 'Global', 'global'),
    ('dungeon-fighter', 'Global', 'global'),
    ('odin-valhalla-rising', 'Global', 'global'),
    ('genshin-impact', 'Global', 'global')
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
WHERE NOT EXISTS (
  SELECT 1
  FROM "GameServer"
  WHERE "GameServer"."gameId" = "Game"."id"
    AND "GameServer"."code" = server_seed."code"
);
