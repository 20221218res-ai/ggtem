const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const SELLER_EMAIL = "seller-detail-copy-test@ggitem.local";

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readDatabaseUrl() {
  const envText = fs.readFileSync(".env.local", "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL is missing from .env.local");
  return match[1];
}

function assertIncludes(text, needle, message) {
  if (!text.includes(needle)) {
    throw new Error(`${message}: expected page to include ${needle}`);
  }
}

function assertNotIncludes(text, needle, message) {
  if (text.includes(needle)) {
    throw new Error(`${message}: expected page not to include ${needle}`);
  }
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-detail-copy-test",
      role: "SELLER",
    });
    await ensureWallet(client, seller.id);
    const catalog = await ensureGameAndServer(client);
    const sellerToken = await createSession(client, seller.id);
    const unique = Date.now().toString(36);
    const listingInput = {
      gameId: catalog.gameId,
      serverId: catalog.serverId,
      category: "GAME_MONEY",
      title: `Detail Copy game money sale ${unique}`,
      description: `Detail Copy seller description ${unique}`,
      unitPrice: "0.0005",
      quantity: "90000",
      minimumQuantity: "1000",
    };
    const createResult = await createListingViaApi(sellerToken, listingInput);
    const detailHtml = await fetchText(`/listings/${createResult.listingId}`);

    for (const copy of [
      listingInput.title,
      listingInput.description,
      "판매 단가",
      "최소 수량",
      "구매 가능",
      "판매자 정보",
      "판매자가 작성한 글",
      "즉시 구매",
      "구매 수량",
      "구매 가능 재고",
      "에스크로",
      "채팅",
      "등록",
    ]) {
      assertIncludes(detailHtml, copy, `listing detail copy: ${copy}`);
    }

    for (const broken of ["�"]) {
      assertNotIncludes(detailHtml, broken, `broken copy marker: ${broken}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          listingId: createResult.listingId,
          checked: [
            "listing detail current Korean copy",
            "purchase panel current Korean copy",
            "seller-created title and description",
            "no replacement-character mojibake marker",
          ],
          url: `/listings/${createResult.listingId}`,
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

  return result;
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return text;
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
              "displayName" = $2,
              "emailVerifiedAt" = coalesce("emailVerifiedAt", now()),
              "updatedAt" = now()
        where id = $3`,
      [input.role, input.displayName, existing.rows[0].id],
    );
    return { ...existing.rows[0], displayName: input.displayName, role: input.role };
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
  let game = await client.query(`select id from "Game" where name = 'Lineage W' limit 1`);
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
    `select id from "GameServer" where "gameId" = $1 and name = '데포로쥬' limit 1`,
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

  return { gameId, serverId };
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
