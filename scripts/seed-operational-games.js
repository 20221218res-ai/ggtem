const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");

loadLocalEnv();

const games = [
  {
    name: "Lineage Classic",
    code: "lineage-classic",
    nameKo: "리니지 클래식",
    nameCn: "天堂经典",
    nameVn: "Lineage Classic",
    namePh: "Lineage Classic",
    nameTh: "ไลน์เอจ คลาสสิก",
    moneyUnitName: "아데나",
    imageUrl: "/api/game-card/lineage-classic",
    imageAlt: "리니지 클래식 대표 이미지",
    sortOrder: 1,
    servers: [
      "데포로쥬",
      "켄라우헬",
      "질리언",
      "이실로테",
      "조우",
      "하딘",
      "케레니스",
      "오웬",
      "크리스터",
      "아인하사드",
      "아툰",
      "가드리아",
      "군터",
      "아스테어",
      "듀크데필",
      "발센",
      "어레인",
      "캐스톨",
      "세바스찬",
      "데컨",
      "파아그리오",
      "에바",
      "사이하",
      "마프르",
      "린델",
      "하이네",
      "로엔그린",
      "발라카스",
      "기타",
    ],
  },
  {
    name: "Aion 2",
    code: "aion-2",
    nameKo: "아이온2",
    nameCn: "永恒之塔2",
    nameVn: "Aion 2",
    namePh: "Aion 2",
    nameTh: "ไอออน 2",
    moneyUnitName: "키나",
    imageUrl: "/api/game-card/aion-2",
    imageAlt: "아이온2 대표 이미지",
    sortOrder: 2,
    servers: [
      "월드 거래소(천족)",
      "월드 거래소(마족)",
      "시엘(천족)",
      "네자칸(천족)",
      "바이젤(천족)",
      "카이시넬(천족)",
      "유스티엘(천족)",
      "아리엘(천족)",
      "프레기온(천족)",
      "메스람타에다(천족)",
      "히타나에(천족)",
      "나니아(천족)",
      "타하바타(천족)",
      "루티스(천족)",
      "페르노스(천족)",
      "다미누(천족)",
      "카사카(천족)",
      "바카르마(천족)",
      "챈가룽(천족)",
      "코치룽(천족)",
      "이슈타르(천족)",
      "티아마트(천족)",
      "포에타(천족)",
      "이스라펠(마족)",
      "지켈(마족)",
      "트리니엘(마족)",
      "루미엘(마족)",
      "마르쿠탄(마족)",
      "아스펠(마족)",
      "에레슈키갈(마족)",
      "브리트라(마족)",
      "네몬(마족)",
      "하달(마족)",
      "루드라(마족)",
      "울고른(마족)",
      "무닌(마족)",
      "오다르(마족)",
      "젠카카(마족)",
      "크로메데(마족)",
      "콰이링(마족)",
      "바바룽(마족)",
      "파포니르(마족)",
      "인드나흐(마족)",
      "이스할겐(마족)",
      "기타",
    ],
  },
  {
    name: "Lineage M",
    code: "lineage-m",
    nameKo: "리니지M",
    nameCn: "天堂M",
    nameVn: "Lineage M",
    namePh: "Lineage M",
    nameTh: "ไลน์เอจ M",
    moneyUnitName: "다이아",
    imageUrl: "/api/game-card/lineage-m",
    imageAlt: "리니지M 대표 이미지",
    sortOrder: 3,
    servers: [
      "데포",
      "판도",
      "듀크",
      "파푸",
      "린드",
      "군터",
      "하딘",
      "아툰",
      "케레",
      "이실",
      "켄라",
      "데스",
      "안타",
      "발라",
      "사이",
      "질리",
      "블루",
      "라스",
      "기르",
      "그림리퍼",
      "발록",
      "진 기르타스",
      "말하는섬",
      "윈다우드",
      "글루디오",
      "그레시아",
      "켄트",
      "오렌",
      "기타",
    ],
  },
  {
    name: "Lineage2M",
    code: "lineage2m",
    nameKo: "리니지2M",
    nameCn: "天堂2M",
    nameVn: "Lineage2M",
    namePh: "Lineage2M",
    nameTh: "ไลน์เอจ 2M",
    moneyUnitName: "다이아",
    imageUrl: "/api/game-card/lineage2m",
    imageAlt: "리니지2M 대표 이미지",
    sortOrder: 4,
    servers: [
      "지그",
      "리오",
      "거스",
      "아리",
      "테온",
      "아이",
      "바츠",
      "카인",
      "에리",
      "카스",
      "드비",
      "에르",
      "오필",
      "바이",
      "안타",
      "파푸",
      "린드",
      "에덴",
      "엘모아덴",
      "사이하",
      "라울",
      "데스나이트",
      "기타",
    ],
  },
  {
    name: "Lineage W",
    code: "lineage-w",
    nameKo: "리니지W",
    nameCn: "天堂W",
    nameVn: "Lineage W",
    namePh: "Lineage W",
    nameTh: "ไลน์เอจ W",
    moneyUnitName: "아데나",
    imageUrl: "/api/game-card/lineage-w",
    imageAlt: "리니지W 대표 이미지",
    sortOrder: 5,
    servers: [
      "데포로쥬",
      "사이하",
      "파아그리오",
      "마프르",
      "에바",
      "아인하사드",
      "그랑카인",
      "켄라우헬",
      "조우",
      "판도라",
      "데스나이트",
      "질리언",
      "군터",
      "아덴",
      "데몬",
      "아툰",
      "어레인",
      "하딘",
      "안타라스",
      "파푸리온",
      "오렌",
      "린드비오르",
      "발라카스",
      "아데나",
      "알폰스",
      "해골",
      "오크",
      "엔트",
      "페일러",
      "아리아",
    ],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  try {
    await client.query("BEGIN");

    const allowedCodes = games.map((game) => game.code);

    for (const game of games) {
      const gameResult = await client.query(
        `
          INSERT INTO "Game"
            ("id", "name", "code", "nameKo", "nameCn", "nameVn", "namePh", "nameTh", "moneyUnitName", "imageUrl", "imageAlt", "sortOrder", "isActive", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW())
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
            "isActive" = true
          RETURNING "id"
        `,
        [
          crypto.randomUUID(),
          game.name,
          game.code,
          game.nameKo,
          game.nameCn,
          game.nameVn,
          game.namePh,
          game.nameTh,
          game.moneyUnitName,
          game.imageUrl,
          game.imageAlt,
          game.sortOrder,
        ],
      );

      const gameId = gameResult.rows[0].id;
      const serverCodes = game.servers.map((serverName, index) =>
        toOrderedServerCode(serverName, index),
      );

      for (const [index, serverName] of game.servers.entries()) {
        const serverCode = toOrderedServerCode(serverName, index);

        const targetByCode = await client.query(
          `
            SELECT "id"
            FROM "GameServer"
            WHERE "gameId" = $1 AND "code" = $2
            LIMIT 1
          `,
          [gameId, serverCode],
        );

        if (targetByCode.rows.length > 0) {
          const targetId = targetByCode.rows[0].id;
          const duplicateByName = await client.query(
            `
              SELECT "id"
              FROM "GameServer"
              WHERE "gameId" = $1 AND "name" = $2 AND "id" <> $3
            `,
            [gameId, serverName, targetId],
          );
          const duplicateIds = duplicateByName.rows.map((row) => row.id);

          if (duplicateIds.length > 0) {
            await client.query(
              `
                UPDATE "Listing"
                SET "serverId" = $1
                WHERE "serverId" = ANY($2::text[])
              `,
              [targetId, duplicateIds],
            );

            await client.query(
              `
                UPDATE "BuyRequest"
                SET "serverId" = $1
                WHERE "serverId" = ANY($2::text[])
              `,
              [targetId, duplicateIds],
            );

            await client.query(
              `
                UPDATE "GameServer"
                SET "isActive" = false
                WHERE "id" = ANY($1::text[])
              `,
              [duplicateIds],
            );
          }

          await client.query(
            `
              UPDATE "GameServer"
              SET "name" = $2,
                  "isActive" = true
              WHERE "id" = $1
            `,
            [targetId, serverName],
          );
          continue;
        }

        const existingServer = await client.query(
          `
            SELECT "id"
            FROM "GameServer"
            WHERE "gameId" = $1 AND "name" = $2
            ORDER BY "isActive" DESC, "id" ASC
            LIMIT 1
          `,
          [gameId, serverName],
        );

        if (existingServer.rows.length > 0) {
          const targetId = existingServer.rows[0].id;
          const duplicateByName = await client.query(
            `
              SELECT "id"
              FROM "GameServer"
              WHERE "gameId" = $1 AND "name" = $2 AND "id" <> $3
            `,
            [gameId, serverName, targetId],
          );
          const duplicateIds = duplicateByName.rows.map((row) => row.id);

          if (duplicateIds.length > 0) {
            await client.query(
              `
                UPDATE "Listing"
                SET "serverId" = $1
                WHERE "serverId" = ANY($2::text[])
              `,
              [targetId, duplicateIds],
            );

            await client.query(
              `
                UPDATE "BuyRequest"
                SET "serverId" = $1
                WHERE "serverId" = ANY($2::text[])
              `,
              [targetId, duplicateIds],
            );

            await client.query(
              `
                UPDATE "GameServer"
                SET "isActive" = false
                WHERE "id" = ANY($1::text[])
              `,
              [duplicateIds],
            );
          }

          await client.query(
            `
              UPDATE "GameServer"
              SET "code" = $3,
                  "name" = $2,
                  "isActive" = true
              WHERE "id" = $1
            `,
            [targetId, serverName, serverCode],
          );
          continue;
        }

        await client.query(
          `
            INSERT INTO "GameServer" ("id", "gameId", "name", "code", "isActive")
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT ("gameId", "code") DO UPDATE SET
              "name" = EXCLUDED."name",
              "isActive" = true
          `,
          [crypto.randomUUID(), gameId, serverName, serverCode],
        );
      }

      await client.query(
        `
          UPDATE "GameServer"
          SET "isActive" = false
          WHERE "gameId" = $1 AND NOT ("code" = ANY($2::text[]))
        `,
        [gameId, serverCodes],
      );
    }

    await client.query(
      `
        UPDATE "Game"
        SET "isActive" = false
        WHERE NOT ("code" = ANY($1::text[]))
      `,
      [allowedCodes],
    );

    await client.query("COMMIT");
    console.log(`Seeded ${games.length} games and ${games.reduce((sum, game) => sum + game.servers.length, 0)} servers.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

function toOrderedServerCode(value, index) {
  return `${String(index + 1).padStart(3, "0")}-${toServerCode(value)}`;
}

function toServerCode(value) {
  const explicitCode = serverCodeOverrides.get(value);
  if (explicitCode) return explicitCode;

  const romanized = value
    .replace(/\(천족\)/g, "-elyos")
    .replace(/\(마족\)/g, "-asmodian")
    .replace(/월드 거래소/g, "world-market")
    .replace(/기타/g, "other")
    .replace(/리니지/g, "lineage")
    .replace(/데포로쥬/g, "deporoju")
    .replace(/켄라우헬/g, "ken-rauhel")
    .replace(/질리언/g, "jillian")
    .replace(/이실로테/g, "isilote")
    .replace(/조우/g, "jowoo")
    .replace(/하딘/g, "haden")
    .replace(/케레니스/g, "kerenis")
    .replace(/오웬/g, "owen")
    .replace(/크리스터/g, "crister")
    .replace(/아인하사드/g, "einhasad")
    .replace(/아툰/g, "aton")
    .replace(/가드리아/g, "gardia")
    .replace(/군터/g, "gunter")
    .replace(/아스테어/g, "astair")
    .replace(/듀크데필/g, "duke-defil")
    .replace(/발센/g, "balsen")
    .replace(/어레인/g, "eorain")
    .replace(/캐스톨/g, "castle")
    .replace(/세바스찬/g, "sebastian")
    .replace(/데컨/g, "deken")
    .replace(/파아그리오/g, "pagrio")
    .replace(/에바/g, "eva")
    .replace(/사이하/g, "saiha")
    .replace(/마프르/g, "mafre")
    .replace(/린델/g, "lindel")
    .replace(/하이네/g, "heine")
    .replace(/로엔그린/g, "roengreen")
    .replace(/발라카스/g, "balakas")
    .replace(/시엘/g, "siel")
    .replace(/네자칸/g, "nezakan")
    .replace(/바이젤/g, "baizel")
    .replace(/카이시넬/g, "kaisinel")
    .replace(/유스티엘/g, "yustiel")
    .replace(/아리엘/g, "ariel")
    .replace(/프레기온/g, "fregeon")
    .replace(/메스람타에다/g, "mesramtaeda")
    .replace(/히타나에/g, "hitanae")
    .replace(/나니아/g, "nania")
    .replace(/타하바타/g, "tahabata")
    .replace(/루티스/g, "rutis")
    .replace(/페르노스/g, "pernos")
    .replace(/다미누/g, "daminoo")
    .replace(/카사카/g, "kasaka")
    .replace(/바카르마/g, "bakarma")
    .replace(/챈가룽/g, "chaengarung")
    .replace(/코치룽/g, "kochirung")
    .replace(/이슈타르/g, "ishtar")
    .replace(/티아마트/g, "tiamat")
    .replace(/포에타/g, "poeta")
    .replace(/이스라펠/g, "israphel")
    .replace(/지켈/g, "jikel")
    .replace(/트리니엘/g, "triniel")
    .replace(/루미엘/g, "rumiel")
    .replace(/마르쿠탄/g, "markutan")
    .replace(/아스펠/g, "aspel")
    .replace(/에레슈키갈/g, "ereshkigal")
    .replace(/브리트라/g, "britra")
    .replace(/네몬/g, "nemon")
    .replace(/하달/g, "hadal")
    .replace(/루드라/g, "rudra")
    .replace(/울고른/g, "ulgorn")
    .replace(/무닌/g, "munin")
    .replace(/오다르/g, "odar")
    .replace(/젠카카/g, "zenkaka")
    .replace(/크로메데/g, "kromede")
    .replace(/콰이링/g, "quairing")
    .replace(/바바룽/g, "babarung")
    .replace(/파포니르/g, "paponir")
    .replace(/인드나흐/g, "indnah")
    .replace(/이스할겐/g, "ishalgen")
    .replace(/데포/g, "depo")
    .replace(/판도/g, "pando")
    .replace(/듀크/g, "duke")
    .replace(/파푸/g, "papu")
    .replace(/린드/g, "lind")
    .replace(/케레/g, "kere")
    .replace(/이실/g, "isil")
    .replace(/켄라/g, "kenra")
    .replace(/데스/g, "death")
    .replace(/안타/g, "anta")
    .replace(/발라/g, "bala")
    .replace(/질리/g, "jilli")
    .replace(/블루/g, "blue")
    .replace(/라스/g, "ras")
    .replace(/기르/g, "gir")
    .replace(/그림리퍼/g, "grimreaper")
    .replace(/발록/g, "balrog")
    .replace(/진 기르타스/g, "jin-girtas")
    .replace(/말하는섬/g, "talking-island")
    .replace(/윈다우드/g, "windawood")
    .replace(/글루디오/g, "gludio")
    .replace(/그레시아/g, "gracia")
    .replace(/켄트/g, "kent")
    .replace(/오렌/g, "oren")
    .replace(/지그/g, "zig")
    .replace(/리오/g, "rio")
    .replace(/거스/g, "girth")
    .replace(/아리/g, "ari")
    .replace(/테온/g, "theon")
    .replace(/아이/g, "ai")
    .replace(/바츠/g, "bartz")
    .replace(/카인/g, "kain")
    .replace(/에리/g, "eri")
    .replace(/카스/g, "kass")
    .replace(/드비/g, "dvi")
    .replace(/에르/g, "er")
    .replace(/오필/g, "opil")
    .replace(/바이/g, "bai")
    .replace(/에덴/g, "eden")
    .replace(/엘모아덴/g, "elmoaden")
    .replace(/라울/g, "raul")
    .replace(/데스나이트/g, "death-knight")
    .replace(/그랑카인/g, "gran-kain")
    .replace(/판도라/g, "pandora")
    .replace(/아덴/g, "aden")
    .replace(/데몬/g, "demon")
    .replace(/안타라스/g, "antharas")
    .replace(/파푸리온/g, "papurion")
    .replace(/린드비오르/g, "lindvior")
    .replace(/아데나/g, "adena")
    .replace(/알폰스/g, "alphonse")
    .replace(/해골/g, "skeleton")
    .replace(/오크/g, "orc")
    .replace(/엔트/g, "ent")
    .replace(/페일러/g, "faelor")
    .replace(/아리아/g, "aria");

  return romanized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const serverCodeOverrides = new Map([
  ["진 기르타스", "jin-girtas"],
  ["그림리퍼", "grimreaper"],
  ["데스나이트", "death-knight"],
]);

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex <= 0) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
