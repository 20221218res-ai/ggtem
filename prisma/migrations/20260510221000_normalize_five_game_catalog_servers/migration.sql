WITH allowed_games("name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt", "sortOrder") AS (
  VALUES
    ('Lineage Classic', 'lineage-classic', '리니지 클래식', '天堂经典', 'Lineage Classic', 'Lineage Classic', 'ไลน์เอจ คลาสสิก', '아데나', '/api/game-card/lineage-classic', 'Lineage Classic GGtem game card', 1),
    ('Aion 2', 'aion-2', '아이온2', '永恒之塔2', 'Aion 2', 'Aion 2', 'ไอออน 2', '키나', '/api/game-card/aion-2', 'Aion 2 GGtem game card', 2),
    ('Lineage M', 'lineage-m', '리니지M', '天堂M', 'Lineage M', 'Lineage M', 'ไลน์เอจ M', '다이아', '/api/game-card/lineage-m', 'Lineage M GGtem game card', 3),
    ('Lineage2M', 'lineage2m', '리니지2M', '天堂2M', 'Lineage2M', 'Lineage2M', 'ไลน์เอจ 2M', '다이아', '/api/game-card/lineage2m', 'Lineage2M GGtem game card', 4),
    ('Lineage W', 'lineage-w', '리니지W', '天堂W', 'Lineage W', 'Lineage W', 'ไลน์เอจ W', '아데나', '/api/game-card/lineage-w', 'Lineage W GGtem game card', 5)
)
INSERT INTO "Game" ("id", "name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt", "sortOrder", "isActive", "createdAt")
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
  allowed_games."sortOrder",
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
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true;

UPDATE "Game"
SET "isActive" = false
WHERE "code" NOT IN ('lineage-classic', 'aion-2', 'lineage-m', 'lineage2m', 'lineage-w');

WITH server_seed("gameCode", "name", "code") AS (
  VALUES
    ('lineage-classic', '데포로쥬', '001-deporojyu'),
    ('lineage-classic', '켄라우헬', '002-kenrauhel'),
    ('lineage-classic', '질리언', '003-jillian'),
    ('lineage-classic', '이실로테', '004-isilote'),
    ('lineage-classic', '조우', '005-joowu'),
    ('lineage-classic', '하딘', '006-hadin'),
    ('lineage-classic', '케레니스', '007-kerenis'),
    ('lineage-classic', '오웬', '008-owen'),
    ('lineage-classic', '크리스터', '009-christer'),
    ('lineage-classic', '아인하사드', '010-einhasad'),
    ('lineage-classic', '아툰', '011-atoon'),
    ('lineage-classic', '가드리아', '012-gadria'),
    ('lineage-classic', '군터', '013-gunter'),
    ('lineage-classic', '아스테어', '014-astair'),
    ('lineage-classic', '듀크데필', '015-duke-defil'),
    ('lineage-classic', '발센', '016-balsen'),
    ('lineage-classic', '어레인', '017-erein'),
    ('lineage-classic', '캐스톨', '018-castol'),
    ('lineage-classic', '서버스찬', '019-server-schan'),
    ('lineage-classic', '데컨', '020-deken'),
    ('lineage-classic', '파아그리오', '021-paagrio'),
    ('lineage-classic', '에바', '022-eva'),
    ('lineage-classic', '사이하', '023-saiha'),
    ('lineage-classic', '마프르', '024-maphr'),
    ('lineage-classic', '린델', '025-lindel'),
    ('lineage-classic', '하이네', '026-heine'),
    ('lineage-classic', '로엔그린', '027-roengrin'),
    ('lineage-classic', '발라카스', '028-valakas'),
    ('lineage-classic', '기타', '999-other'),
    ('aion-2', '월드 거래소(천족)', '001-world-elyos'),
    ('aion-2', '월드 거래소(마족)', '002-world-asmodian'),
    ('aion-2', '시엘(천족)', '003-siel-elyos'),
    ('aion-2', '네자칸(천족)', '004-nejakan-elyos'),
    ('aion-2', '바이젤(천족)', '005-vaizel-elyos'),
    ('aion-2', '카이시넬(천족)', '006-kaisinel-elyos'),
    ('aion-2', '유스티엘(천족)', '007-yustiel-elyos'),
    ('aion-2', '아리엘(천족)', '008-ariel-elyos'),
    ('aion-2', '프레기온(천족)', '009-fregion-elyos'),
    ('aion-2', '메스람타에다(천족)', '010-meslamtaeda-elyos'),
    ('aion-2', '히타니에(천족)', '011-hitanie-elyos'),
    ('aion-2', '나니아(천족)', '012-nania-elyos'),
    ('aion-2', '타하바타(천족)', '013-tahabata-elyos'),
    ('aion-2', '루터스(천족)', '014-luters-elyos'),
    ('aion-2', '페르노스(천족)', '015-pernos-elyos'),
    ('aion-2', '다미누(천족)', '016-daminu-elyos'),
    ('aion-2', '카사카(천족)', '017-kasaka-elyos'),
    ('aion-2', '바카르마(천족)', '018-bakarma-elyos'),
    ('aion-2', '챈가룽(천족)', '019-chengarung-elyos'),
    ('aion-2', '코치룽(천족)', '020-kochirung-elyos'),
    ('aion-2', '이슈타르(천족)', '021-ishtar-elyos'),
    ('aion-2', '티아마트(천족)', '022-tiamat-elyos'),
    ('aion-2', '포에타(천족)', '023-poeta-elyos'),
    ('aion-2', '이스라펠(마족)', '024-israphel-asmodian'),
    ('aion-2', '지켈(마족)', '025-zikel-asmodian'),
    ('aion-2', '트리니엘(마족)', '026-triniel-asmodian'),
    ('aion-2', '루미엘(마족)', '027-lumiel-asmodian'),
    ('aion-2', '마르쿠탄(마족)', '028-markutan-asmodian'),
    ('aion-2', '아스펠(마족)', '029-aspel-asmodian'),
    ('aion-2', '에레슈키갈(마족)', '030-ereshkigal-asmodian'),
    ('aion-2', '브리트라(마족)', '031-britra-asmodian'),
    ('aion-2', '네몬(마족)', '032-nemon-asmodian'),
    ('aion-2', '하달(마족)', '033-hadal-asmodian'),
    ('aion-2', '루드라(마족)', '034-rudra-asmodian'),
    ('aion-2', '울고른(마족)', '035-ulgorn-asmodian'),
    ('aion-2', '무닌(마족)', '036-munin-asmodian'),
    ('aion-2', '오다르(마족)', '037-odar-asmodian'),
    ('aion-2', '젠카카(마족)', '038-zenkaka-asmodian'),
    ('aion-2', '크로메데(마족)', '039-kromede-asmodian'),
    ('aion-2', '콰이링(마족)', '040-kuairing-asmodian'),
    ('aion-2', '바바룽(마족)', '041-babarung-asmodian'),
    ('aion-2', '파프니르(마족)', '042-pafnir-asmodian'),
    ('aion-2', '인드나흐(마족)', '043-indunach-asmodian'),
    ('aion-2', '이스할겐(마족)', '044-ishalgen-asmodian'),
    ('aion-2', '기타', '999-other'),
    ('lineage-m', '데포', '001-depo'),
    ('lineage-m', '판도', '002-pando'),
    ('lineage-m', '듀크', '003-duke'),
    ('lineage-m', '파푸', '004-papu'),
    ('lineage-m', '린드', '005-lind'),
    ('lineage-m', '군터', '006-gunter'),
    ('lineage-m', '하딘', '007-hadin'),
    ('lineage-m', '아툰', '008-atoon'),
    ('lineage-m', '케레', '009-kere'),
    ('lineage-m', '이실', '010-isil'),
    ('lineage-m', '케라', '011-kera'),
    ('lineage-m', '데스', '012-death'),
    ('lineage-m', '안타', '013-anta'),
    ('lineage-m', '발라', '014-vala'),
    ('lineage-m', '사이', '015-sai'),
    ('lineage-m', '질리', '016-jilli'),
    ('lineage-m', '블루', '017-blue'),
    ('lineage-m', '라스', '018-las'),
    ('lineage-m', '기르', '019-gir'),
    ('lineage-m', '그림리퍼', '020-grim-reaper'),
    ('lineage-m', '발록', '021-balrog'),
    ('lineage-m', '진 기르타스', '022-jin-girtas'),
    ('lineage-m', '말하는섬', '023-talking-island'),
    ('lineage-m', '윈다우드', '024-windawood'),
    ('lineage-m', '글루디오', '025-gludio'),
    ('lineage-m', '그레시아', '026-gracia'),
    ('lineage-m', '켄트', '027-kent'),
    ('lineage-m', '오렌', '028-oren'),
    ('lineage-m', '기타', '999-other'),
    ('lineage2m', '지그', '001-zigg'),
    ('lineage2m', '리오', '002-rio'),
    ('lineage2m', '거스', '003-gus'),
    ('lineage2m', '아리', '004-ari'),
    ('lineage2m', '테온', '005-theon'),
    ('lineage2m', '아이', '006-ai'),
    ('lineage2m', '바츠', '007-bartz'),
    ('lineage2m', '카인', '008-kain'),
    ('lineage2m', '에리', '009-eri'),
    ('lineage2m', '카스', '010-kas'),
    ('lineage2m', '드비', '011-devi'),
    ('lineage2m', '에르', '012-er'),
    ('lineage2m', '오필', '013-opil'),
    ('lineage2m', '바이', '014-bai'),
    ('lineage2m', '안타', '015-anta'),
    ('lineage2m', '파푸', '016-papu'),
    ('lineage2m', '린드', '017-lind'),
    ('lineage2m', '에덴', '018-eden'),
    ('lineage2m', '엘모아덴', '019-elmoreden'),
    ('lineage2m', '사이하', '020-saiha'),
    ('lineage2m', '라울', '021-raul'),
    ('lineage2m', '데스나이트', '022-death-knight'),
    ('lineage2m', '기타', '999-other'),
    ('lineage-w', '데포로쥬', '001-deporojyu'),
    ('lineage-w', '사이하', '002-saiha'),
    ('lineage-w', '파아그리오', '003-paagrio'),
    ('lineage-w', '마프르', '004-maphr'),
    ('lineage-w', '에바', '005-eva'),
    ('lineage-w', '아인하사드', '006-einhasad'),
    ('lineage-w', '그랑카인', '007-grankain'),
    ('lineage-w', '켄라우헬', '008-kenrauhel'),
    ('lineage-w', '조우', '009-joowu'),
    ('lineage-w', '판도라', '010-pandora'),
    ('lineage-w', '데스나이트', '011-death-knight'),
    ('lineage-w', '질리언', '012-jillian'),
    ('lineage-w', '군터', '013-gunter'),
    ('lineage-w', '아덴', '014-aden'),
    ('lineage-w', '데몬', '015-demon'),
    ('lineage-w', '아툰', '016-atoon'),
    ('lineage-w', '어레인', '017-erein'),
    ('lineage-w', '하딘', '018-hadin'),
    ('lineage-w', '안타라스', '019-antharas'),
    ('lineage-w', '파푸리온', '020-papurion'),
    ('lineage-w', '오렌', '021-oren'),
    ('lineage-w', '린드비오르', '022-lindvior'),
    ('lineage-w', '발라카스', '023-valakas'),
    ('lineage-w', '아데나', '024-adena'),
    ('lineage-w', '알폰스', '025-alphonse'),
    ('lineage-w', '해골', '026-skeleton'),
    ('lineage-w', '오크', '027-orc'),
    ('lineage-w', '엔트', '028-ent'),
    ('lineage-w', '페일러', '029-failer'),
    ('lineage-w', '아리아', '030-aria')
),
active_seed AS (
  SELECT "Game"."id" AS "gameId", server_seed."gameCode", server_seed."name", server_seed."code"
  FROM server_seed
  JOIN "Game" ON "Game"."code" = server_seed."gameCode"
)
INSERT INTO "GameServer" ("id", "gameId", "name", "code", "isActive")
SELECT gen_random_uuid()::text, active_seed."gameId", active_seed."name", active_seed."code", true
FROM active_seed
ON CONFLICT ("gameId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "isActive" = true;

WITH allowed_server AS (
  SELECT "Game"."id" AS "gameId", server_seed."code"
  FROM (
    VALUES
      ('lineage-classic', '001-deporojyu'), ('lineage-classic', '002-kenrauhel'), ('lineage-classic', '003-jillian'), ('lineage-classic', '004-isilote'), ('lineage-classic', '005-joowu'), ('lineage-classic', '006-hadin'), ('lineage-classic', '007-kerenis'), ('lineage-classic', '008-owen'), ('lineage-classic', '009-christer'), ('lineage-classic', '010-einhasad'), ('lineage-classic', '011-atoon'), ('lineage-classic', '012-gadria'), ('lineage-classic', '013-gunter'), ('lineage-classic', '014-astair'), ('lineage-classic', '015-duke-defil'), ('lineage-classic', '016-balsen'), ('lineage-classic', '017-erein'), ('lineage-classic', '018-castol'), ('lineage-classic', '019-server-schan'), ('lineage-classic', '020-deken'), ('lineage-classic', '021-paagrio'), ('lineage-classic', '022-eva'), ('lineage-classic', '023-saiha'), ('lineage-classic', '024-maphr'), ('lineage-classic', '025-lindel'), ('lineage-classic', '026-heine'), ('lineage-classic', '027-roengrin'), ('lineage-classic', '028-valakas'), ('lineage-classic', '999-other'),
      ('aion-2', '001-world-elyos'), ('aion-2', '002-world-asmodian'), ('aion-2', '003-siel-elyos'), ('aion-2', '004-nejakan-elyos'), ('aion-2', '005-vaizel-elyos'), ('aion-2', '006-kaisinel-elyos'), ('aion-2', '007-yustiel-elyos'), ('aion-2', '008-ariel-elyos'), ('aion-2', '009-fregion-elyos'), ('aion-2', '010-meslamtaeda-elyos'), ('aion-2', '011-hitanie-elyos'), ('aion-2', '012-nania-elyos'), ('aion-2', '013-tahabata-elyos'), ('aion-2', '014-luters-elyos'), ('aion-2', '015-pernos-elyos'), ('aion-2', '016-daminu-elyos'), ('aion-2', '017-kasaka-elyos'), ('aion-2', '018-bakarma-elyos'), ('aion-2', '019-chengarung-elyos'), ('aion-2', '020-kochirung-elyos'), ('aion-2', '021-ishtar-elyos'), ('aion-2', '022-tiamat-elyos'), ('aion-2', '023-poeta-elyos'), ('aion-2', '024-israphel-asmodian'), ('aion-2', '025-zikel-asmodian'), ('aion-2', '026-triniel-asmodian'), ('aion-2', '027-lumiel-asmodian'), ('aion-2', '028-markutan-asmodian'), ('aion-2', '029-aspel-asmodian'), ('aion-2', '030-ereshkigal-asmodian'), ('aion-2', '031-britra-asmodian'), ('aion-2', '032-nemon-asmodian'), ('aion-2', '033-hadal-asmodian'), ('aion-2', '034-rudra-asmodian'), ('aion-2', '035-ulgorn-asmodian'), ('aion-2', '036-munin-asmodian'), ('aion-2', '037-odar-asmodian'), ('aion-2', '038-zenkaka-asmodian'), ('aion-2', '039-kromede-asmodian'), ('aion-2', '040-kuairing-asmodian'), ('aion-2', '041-babarung-asmodian'), ('aion-2', '042-pafnir-asmodian'), ('aion-2', '043-indunach-asmodian'), ('aion-2', '044-ishalgen-asmodian'), ('aion-2', '999-other'),
      ('lineage-m', '001-depo'), ('lineage-m', '002-pando'), ('lineage-m', '003-duke'), ('lineage-m', '004-papu'), ('lineage-m', '005-lind'), ('lineage-m', '006-gunter'), ('lineage-m', '007-hadin'), ('lineage-m', '008-atoon'), ('lineage-m', '009-kere'), ('lineage-m', '010-isil'), ('lineage-m', '011-kera'), ('lineage-m', '012-death'), ('lineage-m', '013-anta'), ('lineage-m', '014-vala'), ('lineage-m', '015-sai'), ('lineage-m', '016-jilli'), ('lineage-m', '017-blue'), ('lineage-m', '018-las'), ('lineage-m', '019-gir'), ('lineage-m', '020-grim-reaper'), ('lineage-m', '021-balrog'), ('lineage-m', '022-jin-girtas'), ('lineage-m', '023-talking-island'), ('lineage-m', '024-windawood'), ('lineage-m', '025-gludio'), ('lineage-m', '026-gracia'), ('lineage-m', '027-kent'), ('lineage-m', '028-oren'), ('lineage-m', '999-other'),
      ('lineage2m', '001-zigg'), ('lineage2m', '002-rio'), ('lineage2m', '003-gus'), ('lineage2m', '004-ari'), ('lineage2m', '005-theon'), ('lineage2m', '006-ai'), ('lineage2m', '007-bartz'), ('lineage2m', '008-kain'), ('lineage2m', '009-eri'), ('lineage2m', '010-kas'), ('lineage2m', '011-devi'), ('lineage2m', '012-er'), ('lineage2m', '013-opil'), ('lineage2m', '014-bai'), ('lineage2m', '015-anta'), ('lineage2m', '016-papu'), ('lineage2m', '017-lind'), ('lineage2m', '018-eden'), ('lineage2m', '019-elmoreden'), ('lineage2m', '020-saiha'), ('lineage2m', '021-raul'), ('lineage2m', '022-death-knight'), ('lineage2m', '999-other'),
      ('lineage-w', '001-deporojyu'), ('lineage-w', '002-saiha'), ('lineage-w', '003-paagrio'), ('lineage-w', '004-maphr'), ('lineage-w', '005-eva'), ('lineage-w', '006-einhasad'), ('lineage-w', '007-grankain'), ('lineage-w', '008-kenrauhel'), ('lineage-w', '009-joowu'), ('lineage-w', '010-pandora'), ('lineage-w', '011-death-knight'), ('lineage-w', '012-jillian'), ('lineage-w', '013-gunter'), ('lineage-w', '014-aden'), ('lineage-w', '015-demon'), ('lineage-w', '016-atoon'), ('lineage-w', '017-erein'), ('lineage-w', '018-hadin'), ('lineage-w', '019-antharas'), ('lineage-w', '020-papurion'), ('lineage-w', '021-oren'), ('lineage-w', '022-lindvior'), ('lineage-w', '023-valakas'), ('lineage-w', '024-adena'), ('lineage-w', '025-alphonse'), ('lineage-w', '026-skeleton'), ('lineage-w', '027-orc'), ('lineage-w', '028-ent'), ('lineage-w', '029-failer'), ('lineage-w', '030-aria')
  ) AS server_seed("gameCode", "code")
  JOIN "Game" ON "Game"."code" = server_seed."gameCode"
)
UPDATE "GameServer"
SET "isActive" = false
WHERE "gameId" IN (SELECT "id" FROM "Game" WHERE "code" IN ('lineage-classic', 'aion-2', 'lineage-m', 'lineage2m', 'lineage-w'))
  AND NOT EXISTS (
    SELECT 1
    FROM allowed_server
    WHERE allowed_server."gameId" = "GameServer"."gameId"
      AND allowed_server."code" = "GameServer"."code"
  );
