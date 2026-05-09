const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const SELLER_EMAIL = "seller-create-flow-test@ggitem.local";

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readDatabaseUrl() {
  const envText = fs.readFileSync(".env.local", "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL is missing from .env.local");
  return match[1];
}

function assertEqual(actual, expected, message) {
  if (String(actual) !== String(expected)) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(text, needle, message) {
  if (!text.includes(needle)) {
    throw new Error(`${message}: expected ${text} to include ${needle}`);
  }
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-create-flow-test",
      role: "SELLER",
    });
    await ensureWallet(client, seller.id);
    const catalog = await ensureGameAndServer(client);
    const sellerToken = await createSession(client, seller.id);

    const cases = [
      {
        category: "GAME_MONEY",
        title: "Flow Test 게임머니 판매",
        description: "게임머니 판매 등록 흐름을 검증하는 테스트입니다.",
        unitPrice: "0.0005",
        quantity: "100000",
        minimumQuantity: "1000",
      },
      {
        category: "GAME_ITEM",
        title: "Flow Test 아이템 판매",
        description: "아이템 판매 등록 흐름을 검증하는 테스트입니다.",
        unitPrice: "5",
        quantity: "3",
        minimumQuantity: "1",
      },
      {
        category: "GAME_ACCOUNT",
        accountTransferType: "GOOGLE",
        title: "Flow Test 계정 판매",
        description: "구글 계정 이전 방식의 계정 판매 등록 흐름을 검증하는 테스트입니다.",
        unitPrice: "30",
        quantity: "1",
        minimumQuantity: "1",
      },
    ];

    const created = [];
    for (const item of cases) {
      const result = await createListingViaApi(sellerToken, {
        gameId: catalog.gameId,
        serverId: catalog.serverId,
        ...item,
      });
      assertEqual(result.status, "ACTIVE", `${item.category} listing status`);
      assertIncludes(result.message, "\uD310\uB9E4\uAE00", `${item.category} success message`);
      await assertListingPersisted(client, result.listingId, item, catalog);
      created.push({ category: item.category, listingId: result.listingId });
    }

    const missingServerResponse = await fetch(`${BASE_URL}/api/market/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `ggitem_session=${sellerToken}`,
      },
      body: JSON.stringify({
        gameId: catalog.gameId,
        category: "GAME_MONEY",
        title: "\uC11C\uBC84 \uC5C6\uB294 \uD310\uB9E4\uAE00",
        unitPrice: "1",
        quantity: "10",
        minimumQuantity: "1",
      }),
    });
    const missingServerResult = await missingServerResponse.json();
    assertEqual(missingServerResponse.status, 400, "missing server status");
    assertIncludes(
      missingServerResult.message,
      "\uC11C\uBC84",
      "missing server validation message",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          created,
          checked: [
            "GAME_MONEY create",
            "GAME_ITEM create",
            "GAME_ACCOUNT create",
            "single server required",
            "admin game/server catalog used by seller listing API",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

async function createListingViaApi(token, body) {
  const response = await fetch(`${BASE_URL}/api/market/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${token}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(`create listing failed (${response.status}): ${JSON.stringify(result)}`);
  }

  if (!result.listingId) {
    throw new Error(`create listing response missing listingId: ${JSON.stringify(result)}`);
  }

  return result;
}

async function assertListingPersisted(client, listingId, expected, catalog) {
  const result = await client.query(
    `select l.category::text,
            l.title,
            l.description,
            l."unitPrice"::text as "unitPrice",
            l.status::text,
            l."serverId",
            g.name as "gameName",
            s.name as "serverName",
            inv."totalQuantity"::text as "totalQuantity",
            inv."minimumQuantity"::text as "minimumQuantity",
            inv."availableQuantity"::text as "availableQuantity",
            inv."lockedQuantity"::text as "lockedQuantity",
            inv."soldQuantity"::text as "soldQuantity"
       from "Listing" l
       join "Game" g on g.id = l."gameId"
       join "GameServer" s on s.id = l."serverId"
       join "ListingInventory" inv on inv."listingId" = l.id
      where l.id = $1`,
    [listingId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`listing not found: ${listingId}`);
  }

  assertEqual(row.category, expected.category, `${expected.category} category`);
  assertEqual(row.title, expected.title, `${expected.category} title`);
  assertEqual(row.description, expected.description, `${expected.category} description`);
  assertEqual(row.unitPrice, toDecimal6(expected.unitPrice), `${expected.category} unitPrice`);
  assertEqual(row.status, "ACTIVE", `${expected.category} persisted status`);
  assertEqual(row.serverId, catalog.serverId, `${expected.category} serverId`);
  assertEqual(row.gameName, catalog.gameName, `${expected.category} gameName`);
  assertEqual(row.serverName, catalog.serverName, `${expected.category} serverName`);
  assertEqual(row.totalQuantity, toDecimal6(expected.quantity), `${expected.category} totalQuantity`);
  assertEqual(
    row.minimumQuantity,
    toDecimal6(expected.minimumQuantity),
    `${expected.category} minimumQuantity`,
  );
  assertEqual(
    row.availableQuantity,
    toDecimal6(expected.quantity),
    `${expected.category} availableQuantity`,
  );
  assertEqual(row.lockedQuantity, "0.000000", `${expected.category} lockedQuantity`);
  assertEqual(row.soldQuantity, "0.000000", `${expected.category} soldQuantity`);
}

function toDecimal6(value) {
  return Number(value).toFixed(6);
}

async function ensureUser(client, input) {
  const existing = await client.query(
    `select id, email, "displayName", role::text from "User" where email = $1`,
    [input.email],
  );
  if (existing.rows[0]) {
    await client.query(
      `update "User"
          set role = $1::"UserRole",
              status = 'ACTIVE'::"UserStatus",
              "emailVerifiedAt" = coalesce("emailVerifiedAt", now()),
              "updatedAt" = now()
        where id = $2`,
      [input.role, existing.rows[0].id],
    );
    return { ...existing.rows[0], role: input.role };
  }

  const user = {
    id: id("user"),
    email: input.email,
    displayName: input.displayName,
    role: input.role,
  };
  await client.query(
    `insert into "User" (id, email, "displayName", role, status, "emailVerifiedAt", "createdAt", "updatedAt")
     values ($1, $2, $3, $4::"UserRole", 'ACTIVE'::"UserStatus", now(), now(), now())`,
    [user.id, user.email, user.displayName, user.role],
  );
  return user;
}

async function ensureWallet(client, userId) {
  await client.query(
    `insert into "Wallet" (id, "userId", currency, "availableBalance", "escrowLockedBalance", "buyRequestLocked", "pendingSettlement", "withdrawableBalance", "withdrawalLocked", "createdAt", "updatedAt")
     values ($1, $2, 'USDT', 1000, 0, 0, 0, 1000, 0, now(), now())
     on conflict ("userId") do update
       set currency = 'USDT',
           "availableBalance" = greatest("Wallet"."availableBalance", 1000),
           "withdrawableBalance" = greatest("Wallet"."withdrawableBalance", 1000),
           "updatedAt" = now()`,
    [id("wallet"), userId],
  );
}

async function ensureGameAndServer(client) {
  let game = await client.query(`select id, name from "Game" where name = 'Lineage W' limit 1`);
  let gameId = game.rows[0]?.id;
  if (!gameId) {
    gameId = id("game");
    await client.query(
      `insert into "Game" (id, name, code, "isActive", "createdAt")
       values ($1, 'Lineage W', $2, true, now())`,
      [gameId, `LINEAGE_W_${Date.now()}`],
    );
  }
  await client.query(`update "Game" set "isActive" = true where id = $1`, [gameId]);

  let server = await client.query(
    `select id, name from "GameServer" where "gameId" = $1 and name = '데포로쥬' limit 1`,
    [gameId],
  );
  let serverId = server.rows[0]?.id;
  if (!serverId) {
    serverId = id("server");
    await client.query(
      `insert into "GameServer" (id, "gameId", name, code, "isActive")
       values ($1, $2, '데포로쥬', $3, true)`,
      [serverId, gameId, `DEPOROJU_${Date.now()}`],
    );
  }
  await client.query(`update "GameServer" set "isActive" = true where id = $1`, [
    serverId,
  ]);

  return { gameId, gameName: "Lineage W", serverId, serverName: "데포로쥬" };
}

async function createSession(client, userId) {
  const token = randomUUID();
  await client.query(
    `insert into "Session" (id, "userId", token, "expiresAt", "createdAt", "lastSeenAt")
     values ($1, $2, $3, now() + interval '1 day', now(), now())`,
    [id("session"), userId, token],
  );
  return token;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
