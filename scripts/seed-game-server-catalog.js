const fs = require("node:fs");
const crypto = require("node:crypto");
const { Client } = require("pg");

loadEnv();

const catalog = [
  {
    code: "lineage-classic",
    name: "Lineage Classic",
    nameKo: "리니지 클래식",
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
      "캐슬",
      "세바스찬",
      "데켄",
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
    code: "aion-2",
    name: "Aion 2",
    nameKo: "아이온2",
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
    code: "lineage-m",
    name: "Lineage M",
    nameKo: "리니지M",
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
    code: "lineage2m",
    name: "Lineage2M",
    nameKo: "리니지2M",
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
    code: "lineage-w",
    name: "Lineage W",
    nameKo: "리니지W",
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
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("begin");
    for (const game of catalog) {
      const gameId = await upsertGame(client, game);
      const activeCodes = [];

      for (let index = 0; index < game.servers.length; index += 1) {
        const name = game.servers[index];
        const code = `${game.code}-${String(index + 1).padStart(2, "0")}`;
        activeCodes.push(code);
        await upsertServer(client, gameId, name, code);
      }

      await client.query(
        `update "GameServer"
           set "isActive" = false
         where "gameId" = $1
           and not ("code" = any($2::text[]))`,
        [gameId, activeCodes],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  console.log(`Seeded ${catalog.length} games and their active server catalog.`);
}

async function upsertGame(client, game) {
  const id = crypto.randomUUID();
  const result = await client.query(
    `insert into "Game" (
        id, name, code, "nameKo", "nameCn", "nameVn", "namePh", "nameTh",
        "moneyUnitName", "imageUrl", "imageAlt", "sortOrder", "isActive", "createdAt"
      )
      values (
        $1, $2, $3, $4, null, $2, $2, null,
        $5, $6, $7, $8, true, now()
      )
      on conflict (code) do update set
        name = excluded.name,
        "nameKo" = excluded."nameKo",
        "nameVn" = excluded."nameVn",
        "namePh" = excluded."namePh",
        "moneyUnitName" = excluded."moneyUnitName",
        "imageUrl" = excluded."imageUrl",
        "imageAlt" = excluded."imageAlt",
        "sortOrder" = excluded."sortOrder",
        "isActive" = true
      returning id`,
    [
      id,
      game.name,
      game.code,
      game.nameKo,
      game.code === "aion-2" ? "키나" : game.code.includes("lineage-m") || game.code === "lineage2m" ? "다이아" : "아데나",
      `/api/game-card/${game.code}`,
      `${game.name} 대표 이미지`,
      game.sortOrder,
    ],
  );

  return result.rows[0].id;
}

async function upsertServer(client, gameId, name, code) {
  await client.query(
    `insert into "GameServer" (id, "gameId", name, code, "isActive")
     values ($1, $2, $3, $4, true)
     on conflict ("gameId", code) do update set
       name = excluded.name,
       "isActive" = true`,
    [crypto.randomUUID(), gameId, name, code],
  );
}

function loadEnv() {
  for (const fileName of [".env.local", ".env"]) {
    if (!fs.existsSync(fileName)) {
      continue;
    }

    const lines = fs.readFileSync(fileName, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex);
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = rawValue.replace(/^"|"$/g, "");
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
