const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const PURCHASE_QUANTITY = "1000";
const PURCHASE_AMOUNT = "0.5";
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[escrow-order-smoke] ${message}${suffix}`);
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

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  let orderId = null;
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
    const sellerWallet = await ensureWallet(client, seller.id);

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
    const listing = await createSmokeListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
    });
    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);
    const beforePurchase = await readListingSnapshot(client, listing.id);
    const beforeBuyerWallet = await readWallet(client, buyer.id);
    const beforeSellerWallet = await readWallet(client, seller.id);

    logStep("purchase listing", { listingId: listing.id });
    const purchaseResult = await postJson("/api/market/purchase", buyerToken, {
      listingId: listing.id,
      quantity: PURCHASE_QUANTITY,
      amount: PURCHASE_AMOUNT,
    });
    orderId = purchaseResult.json.orderId;
    const afterPurchase = await readOrderSnapshot(client, orderId);

    assertEqual(afterPurchase.status, "ESCROW_LOCKED", "order status after purchase");
    assertClose(afterPurchase.buyerAvailable, decimal(beforeBuyerWallet.availableBalance) - decimal(PURCHASE_AMOUNT), "buyer available after purchase");
    assertClose(afterPurchase.buyerWithdrawable, decimal(beforeBuyerWallet.withdrawableBalance) - decimal(PURCHASE_AMOUNT), "buyer withdrawable after purchase");
    assertClose(afterPurchase.buyerEscrow, decimal(beforeBuyerWallet.escrowLockedBalance) + decimal(PURCHASE_AMOUNT), "buyer escrow after purchase");
    assertClose(afterPurchase.sellerAvailable, beforeSellerWallet.availableBalance, "seller available after purchase");
    assertClose(afterPurchase.sellerWithdrawable, beforeSellerWallet.withdrawableBalance, "seller withdrawable after purchase");
    assertClose(afterPurchase.availableQuantity, decimal(beforePurchase.availableQuantity) - decimal(PURCHASE_QUANTITY), "inventory available after purchase");
    assertClose(afterPurchase.lockedQuantity, decimal(beforePurchase.lockedQuantity) + decimal(PURCHASE_QUANTITY), "inventory locked after purchase");

    logStep("seller starts delivery", { orderId });
    await postJson("/api/market/seller-orders", sellerToken, {
      orderId,
      action: "START_DELIVERY",
    });
    const afterStart = await readOrderSnapshot(client, orderId);
    assertEqual(afterStart.status, "DELIVERY_IN_PROGRESS", "order status after start delivery");

    logStep("seller marks delivered", { orderId });
    await postJson("/api/market/seller-orders", sellerToken, {
      orderId,
      action: "MARK_DELIVERED",
    });
    const afterDelivered = await readOrderSnapshot(client, orderId);
    if (
      afterDelivered.status !== "DELIVERY_COMPLETED" &&
      afterDelivered.status !== "BUYER_CONFIRM_PENDING"
    ) {
      throw new Error(
        `order status after mark delivered: expected DELIVERY_COMPLETED or BUYER_CONFIRM_PENDING, got ${afterDelivered.status}`,
      );
    }

    logStep("buyer confirms delivery", { orderId });
    const confirmResult = await postJson("/api/market/buyer-orders", buyerToken, {
      orderId,
      action: "CONFIRM_DELIVERY",
    });
    assertEqual(confirmResult.json.status, "COMPLETED", "confirm delivery response status");

    const afterConfirm = await readOrderSnapshot(client, orderId);
    assertEqual(afterConfirm.status, "COMPLETED", "order status after buyer confirmation");
    if (!afterConfirm.completedAt) {
      throw new Error("Completed order does not have completedAt.");
    }
    assertClose(afterConfirm.buyerEscrow, beforeBuyerWallet.escrowLockedBalance, "buyer escrow after completion");
    assertClose(afterConfirm.sellerAvailable, decimal(beforeSellerWallet.availableBalance) + decimal(afterConfirm.sellerReceivableAmount), "seller available after completion");
    assertClose(afterConfirm.sellerWithdrawable, decimal(beforeSellerWallet.withdrawableBalance) + decimal(afterConfirm.sellerReceivableAmount), "seller withdrawable after completion");
    assertClose(afterConfirm.availableQuantity, afterPurchase.availableQuantity, "inventory available after completion");
    assertClose(afterConfirm.lockedQuantity, beforePurchase.lockedQuantity, "inventory locked after completion");
    assertClose(afterConfirm.soldQuantity, decimal(beforePurchase.soldQuantity) + decimal(PURCHASE_QUANTITY), "inventory sold after completion");

    logStep("attempt duplicate buyer confirmation", { orderId });
    const duplicateResult = await postJson(
      "/api/market/buyer-orders",
      buyerToken,
      {
        orderId,
        action: "CONFIRM_DELIVERY",
      },
      { allowFailure: true },
    );
    if (duplicateResult.response.ok) {
      throw new Error("Completed order was unexpectedly confirmed again.");
    }

    const afterDuplicate = await readOrderSnapshot(client, orderId);
    assertEqual(afterDuplicate.status, "COMPLETED", "order status after duplicate confirm attempt");
    assertClose(afterDuplicate.buyerEscrow, afterConfirm.buyerEscrow, "buyer escrow after duplicate attempt");
    assertClose(afterDuplicate.sellerAvailable, afterConfirm.sellerAvailable, "seller available after duplicate attempt");
    assertClose(afterDuplicate.sellerWithdrawable, afterConfirm.sellerWithdrawable, "seller withdrawable after duplicate attempt");
    assertClose(afterDuplicate.soldQuantity, afterConfirm.soldQuantity, "inventory sold after duplicate attempt");

    logStep("verify ledger and events", { orderId });
    const ledgerResult = await client.query(
      `select type, direction, bucket, amount::text
         from "WalletLedgerEntry"
        where "referenceType" = 'ORDER'
          and "referenceId" = $1
        order by "createdAt" asc`,
      [orderId],
    );
    const completedReleaseCount = ledgerResult.rows.filter(
      (entry) => entry.type === "ORDER_COMPLETED_RELEASE_TO_SELLER",
    ).length;
    const settlementCount = ledgerResult.rows.filter(
      (entry) => entry.type === "SETTLEMENT_AVAILABLE",
    ).length;
    if (completedReleaseCount !== 2 || settlementCount !== 1) {
      throw new Error(
        `Unexpected completion ledger counts: release=${completedReleaseCount}, settlement=${settlementCount}`,
      );
    }

    const eventResult = await client.query(
      `select count(*)::int as count
         from "OrderEvent"
        where "orderId" = $1 and status = 'COMPLETED'::"OrderStatus"`,
      [orderId],
    );
    if (eventResult.rows[0].count < 1) {
      throw new Error("Order completion event was not created.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          listingId: listing.id,
          orderId,
          orderNumber: afterConfirm.orderNumber,
          beforeBuyerWallet,
          beforeSellerWallet,
          afterPurchase,
          afterConfirm,
          duplicateStatus: duplicateResult.response.status,
          ledgerVerified: true,
          eventVerified: true,
          urls: {
            buyerOrder: `/my/orders/${orderId}`,
            buyerChat: `/my/orders/${orderId}/chat`,
            sellerOrder: `/my/listings/orders/${orderId}`,
            sellerChat: `/my/listings/orders/${orderId}/chat`,
            buyerWallet: "/my/wallet",
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (orderId) {
      logStep("last order id", { orderId });
    }
    await client.end();
  }
}

async function ensureUser(client, input) {
  const existing = await client.query(
    `select id, email, "displayName", role::text from "User" where email = $1`,
    [input.email],
  );
  if (existing.rows[0]) {
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
            "escrowLockedBalance"::text as "escrowLockedBalance"
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

async function createSmokeListing(client, input) {
  const listing = {
    id: id("listing"),
    title: `Lineage W 데포로쥬 게임머니 에스크로 테스트 ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`,
  };

  await client.query(
    `insert into "Listing" (id, "sellerId", "gameId", "serverId", category, title, description, "unitPrice", currency, status, "createdAt", "updatedAt")
     values ($1, $2, $3, $4, 'GAME_MONEY'::"ListingCategory", $5, $6, 0.0005, 'USDT', 'ACTIVE'::"ListingStatus", now(), now())`,
    [
      listing.id,
      input.sellerId,
      input.gameId,
      input.serverId,
      listing.title,
      "에스크로 주문 완료 검증용 테스트 판매글입니다.",
    ],
  );
  await client.query(
    `insert into "ListingInventory" (id, "listingId", "totalQuantity", "minimumQuantity", "availableQuantity", "lockedQuantity", "soldQuantity", version, "updatedAt")
     values ($1, $2, 100000, 1000, 100000, 0, 0, 0, now())`,
    [id("inventory"), listing.id],
  );

  return listing;
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

async function readListingSnapshot(client, listingId) {
  const result = await client.query(
    `select inv."availableQuantity"::text as "availableQuantity",
            inv."lockedQuantity"::text as "lockedQuantity",
            inv."soldQuantity"::text as "soldQuantity"
       from "ListingInventory" inv
      where inv."listingId" = $1`,
    [listingId],
  );
  if (!result.rows[0]) {
    throw new Error(`Inventory not found for listing ${listingId}`);
  }
  return result.rows[0];
}

async function readOrderSnapshot(client, orderId) {
  const result = await client.query(
    `select
       o.id,
       o."orderNumber",
       o.status::text,
       o.quantity::text,
       o."grossAmount"::text,
       o."platformFeeAmount"::text as "platformFeeAmount",
       o."sellerReceivableAmount"::text as "sellerReceivableAmount",
       o."completedAt",
       buyer.email as "buyerEmail",
       seller.email as "sellerEmail",
       buyer_wallet."availableBalance"::text as "buyerAvailable",
       buyer_wallet."withdrawableBalance"::text as "buyerWithdrawable",
       buyer_wallet."escrowLockedBalance"::text as "buyerEscrow",
       seller_wallet."availableBalance"::text as "sellerAvailable",
       seller_wallet."withdrawableBalance"::text as "sellerWithdrawable",
       inv."availableQuantity"::text as "availableQuantity",
       inv."lockedQuantity"::text as "lockedQuantity",
       inv."soldQuantity"::text as "soldQuantity"
     from "Order" o
     join "User" buyer on buyer.id = o."buyerId"
     join "User" seller on seller.id = o."sellerId"
     join "Wallet" buyer_wallet on buyer_wallet."userId" = buyer.id
     join "Wallet" seller_wallet on seller_wallet."userId" = seller.id
     join "ListingInventory" inv on inv."listingId" = o."listingId"
     where o.id = $1`,
    [orderId],
  );

  if (!result.rows[0]) {
    throw new Error(`Order not found: ${orderId}`);
  }

  return result.rows[0];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
