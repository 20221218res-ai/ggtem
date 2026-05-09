const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const REQUEST_QUANTITY = "1000";
const REQUEST_UNIT_PRICE = "0.0005";
const REQUEST_TOTAL = "0.5";
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[buy-request-instant-sale-smoke] ${message}${suffix}`);
}

function readDatabaseUrl() {
  const envText = fs.readFileSync(".env.local", "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  return match[1];
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
  if (Math.abs(decimal(actual) - decimal(expected)) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${url} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(path, token, body, options = {}) {
  const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok && !options.allowFailure) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return { response, json };
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  let orderId = null;
  let buyRequestId = null;
  logStep("connect database");
  await client.connect();

  try {
    logStep("prepare users and wallets");
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
    const buyerWallet = await ensureWallet(client, buyer.id);
    await ensureWallet(client, seller.id);
    await client.query(
      `update "Wallet"
         set "availableBalance" = greatest("availableBalance", 100::numeric),
             "withdrawableBalance" = greatest("withdrawableBalance", 100::numeric),
             "updatedAt" = now()
       where id = $1`,
      [buyerWallet.id],
    );

    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);
    const beforeRequestBuyerWallet = await readWallet(client, buyer.id);
    const beforeRequestSellerWallet = await readWallet(client, seller.id);

    logStep("buyer creates buy request");
    const createResult = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CREATE",
      gameId: game.id,
      serverId: server.id,
      category: "GAME_MONEY",
      title: `Lineage W 데포로쥬 구매요청 즉시판매 테스트 ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`,
      description: "판매자가 즉시판매를 눌러 주문으로 전환하는 테스트 구매요청입니다.",
      quantity: REQUEST_QUANTITY,
      unitPrice: REQUEST_UNIT_PRICE,
      expiresInDays: 1,
    });
    buyRequestId = createResult.json.buyRequestId;
    const afterCreate = await readBuyRequestSnapshot(client, buyRequestId);

    assertEqual(afterCreate.status, "ACTIVE", "buy request status after create");
    assertClose(afterCreate.lockAmount, REQUEST_TOTAL, "buy request lock amount after create");
    assertClose(
      afterCreate.buyerAvailable,
      decimal(beforeRequestBuyerWallet.availableBalance) - decimal(REQUEST_TOTAL),
      "buyer available after buy request create",
    );
    assertClose(
      afterCreate.buyerWithdrawable,
      decimal(beforeRequestBuyerWallet.withdrawableBalance) - decimal(REQUEST_TOTAL),
      "buyer withdrawable after buy request create",
    );
    assertClose(
      afterCreate.buyerBuyRequestLocked,
      decimal(beforeRequestBuyerWallet.buyRequestLocked) + decimal(REQUEST_TOTAL),
      "buyer buy-request locked after create",
    );

    logStep("buyer cannot sell to own buy request");
    const selfSale = await postJson(
      "/api/market/buy-request-instant-sale",
      buyerToken,
      { buyRequestId },
      { allowFailure: true },
    );
    if (selfSale.response.ok) {
      throw new Error("Buyer unexpectedly sold to their own buy request.");
    }

    logStep("seller instantly sells to buy request", { buyRequestId });
    const instantSale = await postJson(
      "/api/market/buy-request-instant-sale",
      sellerToken,
      { buyRequestId },
    );
    orderId = instantSale.json.orderId;
    const afterInstantSale = await readBuyRequestOrderSnapshot(client, {
      buyRequestId,
      orderId,
    });

    assertEqual(afterInstantSale.buyRequestStatus, "ACCEPTED", "buy request status after instant sale");
    assertClose(afterInstantSale.buyRequestLockAmount, "0", "buy request lock amount after instant sale");
    assertEqual(afterInstantSale.orderStatus, "ESCROW_LOCKED", "order status after instant sale");
    assertEqual(afterInstantSale.listingStatus, "HIDDEN", "instant sale hidden listing status");
    assertClose(afterInstantSale.inventoryAvailable, "0", "instant sale inventory available");
    assertClose(afterInstantSale.inventoryLocked, REQUEST_QUANTITY, "instant sale inventory locked");
    assertClose(
      afterInstantSale.buyerBuyRequestLocked,
      beforeRequestBuyerWallet.buyRequestLocked,
      "buyer buy-request locked after instant sale",
    );
    assertClose(
      afterInstantSale.buyerEscrow,
      decimal(beforeRequestBuyerWallet.escrowLockedBalance) + decimal(REQUEST_TOTAL),
      "buyer escrow after instant sale",
    );
    assertClose(
      afterInstantSale.sellerAvailable,
      beforeRequestSellerWallet.availableBalance,
      "seller available after instant sale",
    );

    logStep("duplicate instant sale is blocked");
    const duplicateInstantSale = await postJson(
      "/api/market/buy-request-instant-sale",
      sellerToken,
      { buyRequestId },
      { allowFailure: true },
    );
    if (duplicateInstantSale.response.ok) {
      throw new Error("Accepted buy request was unexpectedly sold again.");
    }

    logStep("seller delivers and buyer confirms", { orderId });
    await postJson("/api/market/seller-orders", sellerToken, {
      orderId,
      action: "START_DELIVERY",
    });
    await postJson("/api/market/seller-orders", sellerToken, {
      orderId,
      action: "MARK_DELIVERED",
    });
    const confirmResult = await postJson("/api/market/buyer-orders", buyerToken, {
      orderId,
      action: "CONFIRM_DELIVERY",
    });
    assertEqual(confirmResult.json.status, "COMPLETED", "confirm response status");

    const afterConfirm = await readBuyRequestOrderSnapshot(client, {
      buyRequestId,
      orderId,
    });
    assertEqual(afterConfirm.buyRequestStatus, "COMPLETED", "buy request status after order completion");
    assertEqual(afterConfirm.orderStatus, "COMPLETED", "order status after completion");
    assertClose(afterConfirm.buyerEscrow, beforeRequestBuyerWallet.escrowLockedBalance, "buyer escrow after completion");
    assertClose(
      afterConfirm.sellerAvailable,
      decimal(beforeRequestSellerWallet.availableBalance) + decimal(afterConfirm.sellerReceivableAmount),
      "seller available after completion",
    );
    assertClose(
      afterConfirm.sellerWithdrawable,
      decimal(beforeRequestSellerWallet.withdrawableBalance) + decimal(afterConfirm.sellerReceivableAmount),
      "seller withdrawable after completion",
    );
    assertClose(afterConfirm.inventoryLocked, "0", "inventory locked after completion");
    assertClose(afterConfirm.inventorySold, REQUEST_QUANTITY, "inventory sold after completion");

    await assertLedgerEntries(client, {
      orderId,
      type: "BUYER_ESCROW_LOCKED",
      expected: [
        ["DEBIT", "BUY_REQUEST_LOCKED"],
        ["CREDIT", "ESCROW_LOCKED"],
      ],
    });
    await assertLedgerEntries(client, {
      orderId,
      type: "ORDER_COMPLETED_RELEASE_TO_SELLER",
      expected: [
        ["DEBIT", "ESCROW_LOCKED", afterConfirm.grossAmount],
        ["CREDIT", "AVAILABLE", afterConfirm.sellerReceivableAmount],
      ],
    });
    await assertLedgerEntries(client, {
      orderId,
      type: "SETTLEMENT_AVAILABLE",
      expected: [["CREDIT", "WITHDRAWABLE", afterConfirm.sellerReceivableAmount]],
    });
    await assertLedgerEntries(client, {
      orderId,
      type: "PLATFORM_FEE_COLLECTED",
      expected: [["CREDIT", "PLATFORM_REVENUE", afterConfirm.platformFeeAmount]],
    });

    const chatRoomCount = await client.query(
      `select count(*)::int as count from "ChatRoom" where "orderId" = $1`,
      [orderId],
    );
    if (chatRoomCount.rows[0].count !== 1) {
      throw new Error("Instant sale order chat room was not created.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          buyRequestId,
          orderId,
          orderNumber: afterConfirm.orderNumber,
          listingId: afterConfirm.listingId,
          beforeRequestBuyerWallet,
          beforeRequestSellerWallet,
          afterCreate,
          afterInstantSale,
          afterConfirm,
          selfSaleStatus: selfSale.response.status,
          duplicateInstantSaleStatus: duplicateInstantSale.response.status,
          urls: {
            buyRequests: "/listings?mode=buy",
            myBuyRequests: "/my/buy-requests",
            buyerOrder: `/my/orders/${orderId}`,
            buyerChat: `/my/orders/${orderId}/chat`,
            sellerOrder: `/my/listings/orders/${orderId}`,
            sellerChat: `/my/listings/orders/${orderId}/chat`,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (buyRequestId || orderId) {
      logStep("last ids", { buyRequestId, orderId });
    }
    await client.end();
  }
}

async function assertLedgerEntries(client, input) {
  const result = await client.query(
    `select type, direction, bucket, amount::text
       from "WalletLedgerEntry"
      where "referenceType" = 'ORDER'
        and "referenceId" = $1
        and type = $2::"WalletLedgerType"`,
    [input.orderId, input.type],
  );

  if (result.rows.length !== input.expected.length) {
    throw new Error(`Unexpected ${input.type} ledger count: ${JSON.stringify(result.rows)}`);
  }

  for (const [direction, bucket, expectedAmount] of input.expected) {
    const amount = expectedAmount ?? REQUEST_TOTAL;
    const exists = result.rows.some(
      (entry) =>
        entry.direction === direction &&
        entry.bucket === bucket &&
        Math.abs(decimal(entry.amount) - decimal(amount)) <= 0.000001,
    );
    if (!exists) {
      throw new Error(`Missing ${input.type} ${direction}/${bucket} ledger entry: ${JSON.stringify(result.rows)}`);
    }
  }
}

async function ensureUser(client, input) {
  const existing = await client.query(
    `select id, email, "displayName", role::text from "User" where email = $1`,
    [input.email],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].role !== input.role) {
      await client.query(
        `update "User" set role = $1::"UserRole", status = 'ACTIVE'::"UserStatus", "emailVerifiedAt" = coalesce("emailVerifiedAt", now()), "updatedAt" = now() where id = $2`,
        [input.role, existing.rows[0].id],
      );
      return { ...existing.rows[0], role: input.role };
    }
    return existing.rows[0];
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
  const existing = await client.query(
    `select id from "Wallet" where "userId" = $1`,
    [userId],
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const wallet = { id: id("wallet") };
  await client.query(
    `insert into "Wallet" (id, "userId", currency, "availableBalance", "escrowLockedBalance", "buyRequestLocked", "pendingSettlement", "withdrawableBalance", "withdrawalLocked", "createdAt", "updatedAt")
     values ($1, $2, 'USDT', 0, 0, 0, 0, 0, 0, now(), now())`,
    [wallet.id, userId],
  );
  return wallet;
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
  if (!result.rows[0]) {
    throw new Error(`Wallet not found for user ${userId}`);
  }
  return result.rows[0];
}

async function ensureGame(client) {
  const existing = await client.query(
    `select id, name from "Game" where name = 'Lineage W' limit 1`,
  );
  if (existing.rows[0]) {
    await client.query(`update "Game" set "isActive" = true where id = $1`, [
      existing.rows[0].id,
    ]);
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
  if (existing.rows[0]) {
    return existing.rows[0];
  }

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
       br.quantity::text,
       br."unitPrice"::text as "unitPrice",
       br."totalAmount"::text as "totalAmount",
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

  if (!result.rows[0]) {
    throw new Error(`Buy request not found: ${buyRequestId}`);
  }

  return result.rows[0];
}

async function readBuyRequestOrderSnapshot(client, input) {
  const result = await client.query(
    `select
       br.id as "buyRequestId",
       br.status::text as "buyRequestStatus",
       br."lockAmount"::text as "buyRequestLockAmount",
       o.id as "orderId",
       o."orderNumber",
       o.status::text as "orderStatus",
       o."grossAmount"::text as "grossAmount",
       o."platformFeeAmount"::text as "platformFeeAmount",
       o."sellerReceivableAmount"::text as "sellerReceivableAmount",
       o."completedAt",
       l.id as "listingId",
       l.status::text as "listingStatus",
       buyer_wallet."availableBalance"::text as "buyerAvailable",
       buyer_wallet."withdrawableBalance"::text as "buyerWithdrawable",
       buyer_wallet."escrowLockedBalance"::text as "buyerEscrow",
       buyer_wallet."buyRequestLocked"::text as "buyerBuyRequestLocked",
       seller_wallet."availableBalance"::text as "sellerAvailable",
       seller_wallet."withdrawableBalance"::text as "sellerWithdrawable",
       inv."availableQuantity"::text as "inventoryAvailable",
       inv."lockedQuantity"::text as "inventoryLocked",
       inv."soldQuantity"::text as "inventorySold"
     from "BuyRequest" br
     join "BuyRequestOffer" offer on offer."buyRequestId" = br.id and offer.status = 'ACCEPTED'
     join "Listing" l on l.id = offer."listingId"
     join "Order" o on o.id = $2 and o."listingId" = l.id
     join "Wallet" buyer_wallet on buyer_wallet."userId" = br."buyerId"
     join "Wallet" seller_wallet on seller_wallet."userId" = o."sellerId"
     join "ListingInventory" inv on inv."listingId" = l.id
     where br.id = $1`,
    [input.buyRequestId, input.orderId],
  );

  if (!result.rows[0]) {
    throw new Error(`Buy request order snapshot not found: ${JSON.stringify(input)}`);
  }

  return result.rows[0];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
