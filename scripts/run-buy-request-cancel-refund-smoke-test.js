const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const REQUEST_QUANTITY = "1000";
const REQUEST_UNIT_PRICE = "0.0005";
const REQUEST_TOTAL = "0.5";

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[buy-request-cancel-smoke] ${message}${suffix}`);
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readDatabaseUrl() {
  const envText = fs.readFileSync(".env.local", "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL is missing from .env.local");
  return match[1];
}

function decimal(value) {
  return Number(value);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, message) {
  const diff = Math.abs(decimal(actual) - decimal(expected));
  if (diff > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertNonOk(response, message) {
  if (response.ok) {
    throw new Error(`${message}: unexpectedly returned ${response.status}`);
  }
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  let firstBuyRequestId = null;
  let secondBuyRequestId = null;
  let orderId = null;

  try {
    logStep("prepare users, wallets, game, and server");
    const buyer = await ensureUser(client, {
      email: BUYER_EMAIL,
      displayName: "user-demo",
      role: "CUSTOMER",
    });
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-flow-test",
      role: "SELLER",
    });
    await ensureWallet(client, buyer.id);
    await ensureWallet(client, seller.id);
    await topUpWalletIfNeeded(client, buyer.id, 10);
    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);

    logStep("buyer creates an active buy request");
    const beforeCreateWallet = await readWallet(client, buyer.id);
    const createResult = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CREATE",
      gameId: game.id,
      serverId: server.id,
      category: "GAME_MONEY",
      title: `Smoke cancel request ${Date.now()}`,
      description: "구매요청 취소/예약금 반환 검증용 요청입니다.",
      quantity: REQUEST_QUANTITY,
      unitPrice: REQUEST_UNIT_PRICE,
      expiresInDays: 3,
    });
    assertEqual(createResult.status, 200, "create buy request status");
    firstBuyRequestId = createResult.json.buyRequestId;

    const afterCreate = await readBuyRequestSnapshot(client, firstBuyRequestId);
    assertEqual(afterCreate.status, "ACTIVE", "buy request status after create");
    assertClose(afterCreate.lockAmount, REQUEST_TOTAL, "lock amount after create");
    assertClose(
      afterCreate.buyerAvailable,
      decimal(beforeCreateWallet.availableBalance) - decimal(REQUEST_TOTAL),
      "buyer available after create",
    );
    assertClose(
      afterCreate.buyerWithdrawable,
      decimal(beforeCreateWallet.withdrawableBalance) - decimal(REQUEST_TOTAL),
      "buyer withdrawable after create",
    );
    assertClose(
      afterCreate.buyerBuyRequestLocked,
      decimal(beforeCreateWallet.buyRequestLocked) + decimal(REQUEST_TOTAL),
      "buyer buy-request locked after create",
    );

    logStep("buyer cancels active buy request", { buyRequestId: firstBuyRequestId });
    const cancelResult = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CANCEL",
      buyRequestId: firstBuyRequestId,
    });
    assertEqual(cancelResult.status, 200, "cancel buy request status");
    assertEqual(cancelResult.json.status, "CANCELED", "cancel response status");

    const afterCancel = await readBuyRequestSnapshot(client, firstBuyRequestId);
    assertEqual(afterCancel.status, "CANCELED", "buy request status after cancel");
    assertClose(afterCancel.lockAmount, "0", "lock amount after cancel");
    assertClose(afterCancel.buyerAvailable, beforeCreateWallet.availableBalance, "buyer available after cancel");
    assertClose(afterCancel.buyerWithdrawable, beforeCreateWallet.withdrawableBalance, "buyer withdrawable after cancel");
    assertClose(afterCancel.buyerBuyRequestLocked, beforeCreateWallet.buyRequestLocked, "buyer locked after cancel");
    await assertBuyRequestReleaseLedger(client, firstBuyRequestId);

    logStep("duplicate cancel and seller sale to canceled request are blocked");
    const duplicateCancel = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CANCEL",
      buyRequestId: firstBuyRequestId,
    });
    assertNonOk(duplicateCancel, "duplicate cancel");

    const sellCanceled = await postJson("/api/market/buy-request-instant-sale", sellerToken, {
      buyRequestId: firstBuyRequestId,
    });
    assertNonOk(sellCanceled, "seller sale to canceled buy request");

    logStep("cancel is blocked after instant sale starts");
    const secondCreate = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CREATE",
      gameId: game.id,
      serverId: server.id,
      category: "GAME_MONEY",
      title: `Smoke accepted request ${Date.now()}`,
      description: "즉시판매 후 구매요청 취소 차단 검증용 요청입니다.",
      quantity: REQUEST_QUANTITY,
      unitPrice: REQUEST_UNIT_PRICE,
      expiresInDays: 3,
    });
    assertEqual(secondCreate.status, 200, "create second buy request status");
    secondBuyRequestId = secondCreate.json.buyRequestId;

    const instantSale = await postJson("/api/market/buy-request-instant-sale", sellerToken, {
      buyRequestId: secondBuyRequestId,
    });
    assertEqual(instantSale.status, 200, "instant sale status");
    orderId = instantSale.json.orderId;

    const cancelAccepted = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CANCEL",
      buyRequestId: secondBuyRequestId,
    });
    assertNonOk(cancelAccepted, "cancel accepted buy request");

    const acceptedSnapshot = await readBuyRequestSnapshot(client, secondBuyRequestId);
    assertEqual(acceptedSnapshot.status, "ACCEPTED", "accepted request remains accepted");
    assertClose(acceptedSnapshot.lockAmount, "0", "accepted request lock amount stays zero");

    logStep("cleanup accepted-order escrow by buyer cancel", { orderId });
    const orderCancel = await postJson("/api/market/buyer-orders", buyerToken, {
      orderId,
      action: "CANCEL_ORDER",
    });
    assertEqual(orderCancel.status, 200, "cleanup order cancel status");
    assertEqual(orderCancel.json.status, "CANCELED", "cleanup order status");
    const afterOrderCancel = await readBuyRequestSnapshot(client, secondBuyRequestId);
    assertEqual(
      afterOrderCancel.status,
      "CANCELED",
      "accepted buy request status after linked order cancel",
    );
    assertClose(afterOrderCancel.lockAmount, "0", "linked buy request lock amount after order cancel");

    console.log(
      JSON.stringify(
        {
          ok: true,
          canceledBuyRequestId: firstBuyRequestId,
          acceptedBuyRequestId: secondBuyRequestId,
          cleanupOrderId: orderId,
          afterCancel,
          afterOrderCancel,
          urls: {
            myBuyRequests: "/my/buy-requests",
            buyRequests: "/listings?mode=buy",
            cleanupOrder: `/my/orders/${orderId}`,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
    if (firstBuyRequestId || secondBuyRequestId || orderId) {
      logStep("last ids", { firstBuyRequestId, secondBuyRequestId, orderId });
    }
  }
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
  let json = {};
  try {
    json = await response.json();
  } catch {
    json = {};
  }
  return { ok: response.ok, status: response.status, json };
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
  const existing = await client.query(`select id from "Wallet" where "userId" = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0];

  const wallet = { id: id("wallet") };
  await client.query(
    `insert into "Wallet" (id, "userId", currency, "availableBalance", "escrowLockedBalance", "buyRequestLocked", "pendingSettlement", "withdrawableBalance", "withdrawalLocked", "createdAt", "updatedAt")
     values ($1, $2, 'USDT', 0, 0, 0, 0, 0, 0, now(), now())`,
    [wallet.id, userId],
  );
  return wallet;
}

async function topUpWalletIfNeeded(client, userId, minimumAmount) {
  const wallet = await readWallet(client, userId);
  if (decimal(wallet.availableBalance) >= minimumAmount && decimal(wallet.withdrawableBalance) >= minimumAmount) {
    return;
  }
  await client.query(
    `update "Wallet"
        set "availableBalance" = $1,
            "withdrawableBalance" = $1,
            "updatedAt" = now()
      where "userId" = $2`,
    [minimumAmount.toFixed(6), userId],
  );
}

async function readWallet(client, userId) {
  const result = await client.query(
    `select "availableBalance"::text as "availableBalance",
            "withdrawableBalance"::text as "withdrawableBalance",
            "escrowLockedBalance"::text as "escrowLockedBalance",
            "buyRequestLocked"::text as "buyRequestLocked"
       from "Wallet"
      where "userId" = $1`,
    [userId],
  );
  if (!result.rows[0]) throw new Error(`Wallet not found for user ${userId}`);
  return result.rows[0];
}

async function ensureGame(client) {
  const existing = await client.query(`select id, name from "Game" where name = 'Lineage W' limit 1`);
  if (existing.rows[0]) {
    await client.query(`update "Game" set "isActive" = true where id = $1`, [existing.rows[0].id]);
    return existing.rows[0];
  }

  const game = { id: id("game"), name: "Lineage W" };
  await client.query(
    `insert into "Game" (id, name, code, "isActive", "createdAt")
     values ($1, 'Lineage W', $2, true, now())`,
    [game.id, `LINEAGE_W_${Date.now()}`],
  );
  return game;
}

async function ensureServer(client, gameId) {
  const existing = await client.query(
    `select id, name from "GameServer" where "gameId" = $1 and "isActive" = true order by name asc limit 1`,
    [gameId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const server = { id: id("server"), name: "데포로쥬" };
  await client.query(
    `insert into "GameServer" (id, "gameId", name, code, "isActive")
     values ($1, $2, $3, $4, true)`,
    [server.id, gameId, server.name, `DEPOROJU_${Date.now()}`],
  );
  return server;
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

async function readBuyRequestSnapshot(client, buyRequestId) {
  const result = await client.query(
    `select
       br.id,
       br.status::text,
       br."lockAmount"::text as "lockAmount",
       buyer_wallet."availableBalance"::text as "buyerAvailable",
       buyer_wallet."withdrawableBalance"::text as "buyerWithdrawable",
       buyer_wallet."escrowLockedBalance"::text as "buyerEscrow",
       buyer_wallet."buyRequestLocked"::text as "buyerBuyRequestLocked"
     from "BuyRequest" br
     join "Wallet" buyer_wallet on buyer_wallet."userId" = br."buyerId"
     where br.id = $1`,
    [buyRequestId],
  );
  if (!result.rows[0]) throw new Error(`Buy request not found: ${buyRequestId}`);
  return result.rows[0];
}

async function assertBuyRequestReleaseLedger(client, buyRequestId) {
  const result = await client.query(
    `select direction::text, bucket::text, amount::text
       from "WalletLedgerEntry"
      where "referenceType" = 'BUY_REQUEST'
        and "referenceId" = $1
        and type = 'BUY_REQUEST_RELEASED'::"WalletLedgerType"`,
    [buyRequestId],
  );

  const expected = [
    ["DEBIT", "BUY_REQUEST_LOCKED"],
    ["CREDIT", "AVAILABLE"],
    ["CREDIT", "WITHDRAWABLE"],
  ];

  if (result.rows.length !== expected.length) {
    throw new Error(`Unexpected BUY_REQUEST_RELEASED ledger count: ${JSON.stringify(result.rows)}`);
  }

  for (const [direction, bucket] of expected) {
    const exists = result.rows.some(
      (entry) =>
        entry.direction === direction &&
        entry.bucket === bucket &&
        Math.abs(decimal(entry.amount) - decimal(REQUEST_TOTAL)) <= 0.000001,
    );
    if (!exists) {
      throw new Error(`Missing BUY_REQUEST_RELEASED ${direction}/${bucket}: ${JSON.stringify(result.rows)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
