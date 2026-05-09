const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "buyer-purchase-validation-test@ggitem.local";
const SELLER_EMAIL = "seller-purchase-validation-test@ggitem.local";

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
  if (!String(text).includes(needle)) {
    throw new Error(`${message}: expected ${text} to include ${needle}`);
  }
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const buyer = await ensureUser(client, {
      email: BUYER_EMAIL,
      displayName: "buyer-purchase-validation",
      role: "CUSTOMER",
    });
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-purchase-validation",
      role: "SELLER",
    });
    await ensureWallet(client, buyer.id, "100");
    await ensureWallet(client, seller.id, "100");
    const catalog = await ensureGameAndServer(client);
    const listing = await createListing(client, {
      sellerId: seller.id,
      gameId: catalog.gameId,
      serverId: catalog.serverId,
      title: `Purchase Validation 판매글 ${Date.now().toString(36)}`,
      quantity: "10000",
      minimumQuantity: "1000",
      unitPrice: "0.0005",
    });
    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);

    await expectPurchaseError(
      buyerToken,
      { quantity: "1000", amount: "0.5" },
      "구매할 매물과 수량 정보",
      "missing listing id",
    );
    await expectPurchaseError(
      buyerToken,
      { listingId: listing.id, amount: "0.5" },
      "구매할 매물과 수량 정보",
      "missing quantity",
    );
    await expectPurchaseError(
      sellerToken,
      { listingId: listing.id, quantity: "1000", amount: "0.5" },
      "본인이 등록한 매물",
      "self purchase",
    );
    await expectPurchaseError(
      buyerToken,
      { listingId: listing.id, quantity: "999", amount: "0.4995" },
      "최소 수량보다 적습니다",
      "below minimum quantity",
    );
    await expectPurchaseError(
      buyerToken,
      { listingId: listing.id, quantity: "10001", amount: "5.0005" },
      "구매 가능한 재고보다 많습니다",
      "above available quantity",
    );
    await expectPurchaseError(
      buyerToken,
      { listingId: listing.id, quantity: "1000", amount: "0.4" },
      "매물 가격과 일치하지 않습니다",
      "amount mismatch",
    );

    await setWalletBalance(client, buyer.id, "0.1");
    await expectPurchaseError(
      buyerToken,
      { listingId: listing.id, quantity: "1000", amount: "0.5" },
      "보유 잔액이 부족합니다",
      "insufficient balance",
    );

    await setWalletBalance(client, buyer.id, "100");
    const success = await postPurchase(buyerToken, {
      listingId: listing.id,
      quantity: "1000",
      amount: "0.5",
    });
    assertEqual(success.status, 200, "purchase success status");
    assertEqual(success.json.status, "ESCROW_LOCKED", "purchase success order status");
    assertEqual(success.json.amount, "0.5", "purchase success amount");
    assertEqual(success.json.inventory.availableQuantity, "9000", "remaining inventory");

    console.log(
      JSON.stringify(
        {
          ok: true,
          listingId: listing.id,
          orderId: success.json.orderId,
          checked: [
            "missing listing/quantity message",
            "self purchase blocked",
            "minimum quantity blocked",
            "available inventory blocked",
            "amount mismatch blocked",
            "insufficient balance blocked",
            "success escrow purchase",
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

async function expectPurchaseError(token, body, expectedMessagePart, label) {
  const result = await postPurchase(token, body);
  if (result.status !== 400) {
    throw new Error(
      `${label} status: expected 400, got ${result.status}; response: ${result.json.message || "empty"}`,
    );
  }
  assertIncludes(result.json.message, expectedMessagePart, `${label} message`);
}

async function postPurchase(token, body) {
  let lastResult = { status: 0, json: { message: "" } };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}/api/market/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `ggitem_session=${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    let json = {};
    if (text && contentType.includes("application/json")) {
      json = JSON.parse(text);
    } else if (text) {
      json = { message: text.slice(0, 500) };
    }
    lastResult = { status: response.status, json };
    if (response.status < 500 || attempt === 3) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  return lastResult;
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

async function ensureWallet(client, userId, amount) {
  await client.query(
    `insert into "Wallet" (id, "userId", currency, "availableBalance", "escrowLockedBalance", "buyRequestLocked", "pendingSettlement", "withdrawableBalance", "withdrawalLocked", "createdAt", "updatedAt")
     values ($1, $2, 'USDT', $3, 0, 0, 0, $3, 0, now(), now())
     on conflict ("userId") do update
       set currency = 'USDT',
           "availableBalance" = $3,
           "escrowLockedBalance" = 0,
           "buyRequestLocked" = 0,
           "pendingSettlement" = 0,
           "withdrawableBalance" = $3,
           "withdrawalLocked" = 0,
           "updatedAt" = now()`,
    [id("wallet"), userId, amount],
  );
}

async function setWalletBalance(client, userId, amount) {
  await client.query(
    `update "Wallet"
        set "availableBalance" = $1,
            "withdrawableBalance" = $1,
            "updatedAt" = now()
      where "userId" = $2`,
    [amount, userId],
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

async function createListing(client, input) {
  const listingId = id("listing");
  await client.query(
    `insert into "Listing" (id, "sellerId", "gameId", "serverId", category, title, description, "unitPrice", currency, status, "createdAt", "updatedAt")
     values ($1, $2, $3, $4, 'GAME_MONEY'::"ListingCategory", $5, $6, $7, 'USDT', 'ACTIVE'::"ListingStatus", now(), now())`,
    [
      listingId,
      input.sellerId,
      input.gameId,
      input.serverId,
      input.title,
      `${input.title} description`,
      input.unitPrice,
    ],
  );
  await client.query(
    `insert into "ListingInventory" (id, "listingId", "totalQuantity", "minimumQuantity", "availableQuantity", "lockedQuantity", "soldQuantity", version, "updatedAt")
     values ($1, $2, $3, $4, $3, 0, 0, 0, now())`,
    [id("inventory"), listingId, input.quantity, input.minimumQuantity],
  );
  return { id: listingId };
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
