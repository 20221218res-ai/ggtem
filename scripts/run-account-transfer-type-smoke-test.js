const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";

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

function assertOk(value, message) {
  if (!value) throw new Error(message);
}

async function postJson(path, token, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-flow-test",
      role: "SELLER",
    });
    const buyer = await ensureUser(client, {
      email: BUYER_EMAIL,
      displayName: "user-demo",
      role: "CUSTOMER",
    });
    await ensureWallet(client, seller.id);
    await ensureWallet(client, buyer.id);

    const catalog = await ensureGameAndServer(client);
    const sellerToken = await createSession(client, seller.id);
    const buyerToken = await createSession(client, buyer.id);

    const listingTitle = `Account type listing ${Date.now()}`;
    const listing = await postJson("/api/market/listings", sellerToken, {
      gameId: catalog.gameId,
      serverId: catalog.serverId,
      category: "GAME_ACCOUNT",
      accountTransferType: "GOOGLE",
      title: listingTitle,
      description: "Google account transfer smoke test listing.",
      unitPrice: "33",
      quantity: "1",
      minimumQuantity: "1",
    });

    const persistedListing = await client.query(
      `select category::text, "accountTransferType", title
         from "Listing"
        where id = $1`,
      [listing.listingId],
    );
    assertOk(persistedListing.rows[0], "created account listing was not persisted");
    assertEqual(persistedListing.rows[0].category, "GAME_ACCOUNT", "listing category");
    assertEqual(
      persistedListing.rows[0].accountTransferType,
      "GOOGLE",
      "listing account transfer type",
    );
    assertEqual(persistedListing.rows[0].title, listingTitle, "listing title");

    const buyRequestTitle = `Account type buy request ${Date.now()}`;
    const buyRequest = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CREATE",
      gameId: catalog.gameId,
      serverId: catalog.serverId,
      category: "GAME_ACCOUNT",
      accountTransferType: "GAME_COMPANY",
      accountRank: "High",
      title: buyRequestTitle,
      description: "Game company account transfer smoke test buy request.",
      quantity: "1",
      unitPrice: "44",
      expiresInDays: 1,
    });

    const persistedBuyRequest = await client.query(
      `select category::text, "accountTransferType", title
         from "BuyRequest"
        where id = $1`,
      [buyRequest.buyRequestId],
    );
    assertOk(persistedBuyRequest.rows[0], "created account buy request was not persisted");
    assertEqual(persistedBuyRequest.rows[0].category, "GAME_ACCOUNT", "buy request category");
    assertEqual(
      persistedBuyRequest.rows[0].accountTransferType,
      "GAME_COMPANY",
      "buy request account transfer type",
    );
    assertEqual(persistedBuyRequest.rows[0].title, buyRequestTitle, "buy request title");

    const filteredListing = await client.query(
      `select id
         from "Listing"
        where id = $1
          and category = 'GAME_ACCOUNT'::"ListingCategory"
          and "accountTransferType" = 'GOOGLE'`,
      [listing.listingId],
    );
    const filteredBuyRequest = await client.query(
      `select id
         from "BuyRequest"
        where id = $1
          and category = 'GAME_ACCOUNT'::"ListingCategory"
          and "accountTransferType" = 'GAME_COMPANY'`,
      [buyRequest.buyRequestId],
    );
    assertEqual(filteredListing.rowCount, 1, "listing account type filter match");
    assertEqual(filteredBuyRequest.rowCount, 1, "buy request account type filter match");

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: [
            "account listing stores GOOGLE transfer type",
            "account buy request stores GAME_COMPANY transfer type",
            "account type filter matches listing",
            "account type filter matches buy request",
          ],
          listingId: listing.listingId,
          buyRequestId: buyRequest.buyRequestId,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
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
      `insert into "Game" (id, name, code, "moneyUnitName", "isActive", "createdAt")
       values ($1, 'Lineage W', $2, 'Adena', true, now())`,
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
