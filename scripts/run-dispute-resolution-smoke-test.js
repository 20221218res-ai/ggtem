const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const ADMIN_EMAIL = "super-demo@ggitem.local";
const PURCHASE_QUANTITY = "1000";
const PURCHASE_AMOUNT = "0.5";
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[dispute-smoke] ${message}${suffix}`);
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
  logStep("connect database");
  await client.connect();

  const createdOrderIds = [];
  try {
    logStep("prepare actors and wallets");
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
    const admin = await ensureUser(client, {
      email: ADMIN_EMAIL,
      displayName: "super-demo",
      role: "SUPER",
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
    const adminToken = await createSession(client, admin.id);

    const refundCase = await createDisputedOrder(client, {
      buyer,
      seller,
      gameId: game.id,
      serverId: server.id,
      buyerToken,
      label: "refund",
    });
    createdOrderIds.push(refundCase.orderId);
    await resolveRefundCase(client, {
      ...refundCase,
      adminToken,
    });

    const releaseCase = await createDisputedOrder(client, {
      buyer,
      seller,
      gameId: game.id,
      serverId: server.id,
      buyerToken,
      label: "release",
    });
    createdOrderIds.push(releaseCase.orderId);
    await resolveReleaseCase(client, {
      ...releaseCase,
      adminToken,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          refundOrderId: refundCase.orderId,
          refundOrderNumber: refundCase.afterDispute.orderNumber,
          releaseOrderId: releaseCase.orderId,
          releaseOrderNumber: releaseCase.afterDispute.orderNumber,
          urls: {
            adminDisputes: "/admin/disputes",
            refundAdminOrder: `/admin/orders?orderId=${refundCase.orderId}&query=${refundCase.orderId}`,
            releaseAdminOrder: `/admin/orders?orderId=${releaseCase.orderId}&query=${releaseCase.orderId}`,
            audit: "/admin/audit",
            financeLedger: "/admin/finance/ledger",
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (createdOrderIds.length > 0) {
      logStep("created order ids", { orderIds: createdOrderIds });
    }
    await client.end();
  }
}

async function createDisputedOrder(client, input) {
  const beforeBuyerWallet = await readWallet(client, input.buyer.id);
  const beforeSellerWallet = await readWallet(client, input.seller.id);
  const listing = await createSmokeListing(client, {
    sellerId: input.seller.id,
    gameId: input.gameId,
    serverId: input.serverId,
    label: input.label,
  });
  const beforeInventory = await readListingSnapshot(client, listing.id);

  logStep("purchase listing", { label: input.label, listingId: listing.id });
  const purchaseResult = await postJson("/api/market/purchase", input.buyerToken, {
    listingId: listing.id,
    quantity: PURCHASE_QUANTITY,
    amount: PURCHASE_AMOUNT,
  });
  const orderId = purchaseResult.json.orderId;
  const afterPurchase = await readOrderSnapshot(client, orderId);
  assertEqual(afterPurchase.status, "ESCROW_LOCKED", `${input.label} order status after purchase`);

  logStep("buyer reports problem", { label: input.label, orderId });
  const disputeResult = await postJson("/api/market/buyer-orders", input.buyerToken, {
    orderId,
    action: "REPORT_PROBLEM",
    reason: `${input.label} smoke dispute evidence is ready for admin review.`,
  });
  assertEqual(disputeResult.json.status, "DISPUTED", `${input.label} dispute response status`);

  const afterDispute = await readOrderSnapshot(client, orderId);
  assertEqual(afterDispute.status, "DISPUTED", `${input.label} order status after report`);
  assertClose(
    afterDispute.buyerAvailable,
    decimal(beforeBuyerWallet.availableBalance) - decimal(PURCHASE_AMOUNT),
    `${input.label} buyer available while disputed`,
  );
  assertClose(
    afterDispute.buyerEscrow,
    decimal(beforeBuyerWallet.escrowLockedBalance) + decimal(PURCHASE_AMOUNT),
    `${input.label} buyer escrow while disputed`,
  );
  assertClose(
    afterDispute.availableQuantity,
    decimal(beforeInventory.availableQuantity) - decimal(PURCHASE_QUANTITY),
    `${input.label} inventory available while disputed`,
  );
  assertClose(
    afterDispute.lockedQuantity,
    decimal(beforeInventory.lockedQuantity) + decimal(PURCHASE_QUANTITY),
    `${input.label} inventory locked while disputed`,
  );

  return {
    orderId,
    listingId: listing.id,
    beforeBuyerWallet,
    beforeSellerWallet,
    beforeInventory,
    afterPurchase,
    afterDispute,
  };
}

async function resolveRefundCase(client, input) {
  logStep("admin refunds buyer", { orderId: input.orderId });
  const result = await postJson("/api/admin/orders", input.adminToken, {
    orderId: input.orderId,
    action: "REFUND_BUYER",
    note: "Smoke test: buyer refund after dispute.",
  });
  assertEqual(result.json.status, "REFUNDED", "refund response status");

  const afterResolve = await readOrderSnapshot(client, input.orderId);
  assertEqual(afterResolve.status, "REFUNDED", "refund order status");
  if (!afterResolve.canceledAt) {
    throw new Error("Refunded dispute order does not have canceledAt.");
  }
  assertClose(afterResolve.buyerAvailable, input.beforeBuyerWallet.availableBalance, "buyer available after dispute refund");
  assertClose(afterResolve.buyerWithdrawable, input.beforeBuyerWallet.withdrawableBalance, "buyer withdrawable after dispute refund");
  assertClose(afterResolve.buyerEscrow, input.beforeBuyerWallet.escrowLockedBalance, "buyer escrow after dispute refund");
  assertClose(afterResolve.sellerAvailable, input.beforeSellerWallet.availableBalance, "seller available after dispute refund");
  assertClose(afterResolve.sellerWithdrawable, input.beforeSellerWallet.withdrawableBalance, "seller withdrawable after dispute refund");
  assertClose(afterResolve.availableQuantity, input.beforeInventory.availableQuantity, "inventory available after dispute refund");
  assertClose(afterResolve.lockedQuantity, input.beforeInventory.lockedQuantity, "inventory locked after dispute refund");
  assertClose(afterResolve.soldQuantity, input.beforeInventory.soldQuantity, "inventory sold after dispute refund");

  await assertLedgerEntries(client, {
    orderId: input.orderId,
    type: "DISPUTE_REFUND",
    amount: PURCHASE_AMOUNT,
    expected: [
      ["DEBIT", "ESCROW_LOCKED"],
      ["CREDIT", "AVAILABLE"],
      ["CREDIT", "WITHDRAWABLE"],
    ],
  });
  await assertAuditLog(client, input.orderId, "DISPUTE_REFUNDED_TO_BUYER");
  await assertTerminalActionBlocked(client, {
    token: input.adminToken,
    orderId: input.orderId,
    action: "RELEASE_TO_SELLER",
    message: "refunded dispute unexpectedly released to seller",
  });
}

async function resolveReleaseCase(client, input) {
  logStep("admin releases to seller", { orderId: input.orderId });
  const result = await postJson("/api/admin/orders", input.adminToken, {
    orderId: input.orderId,
    action: "RELEASE_TO_SELLER",
    note: "Smoke test: seller release after dispute.",
  });
  assertEqual(result.json.status, "COMPLETED", "release response status");

  const afterResolve = await readOrderSnapshot(client, input.orderId);
  assertEqual(afterResolve.status, "COMPLETED", "release order status");
  if (!afterResolve.completedAt) {
    throw new Error("Seller-release dispute order does not have completedAt.");
  }
  assertClose(afterResolve.buyerAvailable, input.afterDispute.buyerAvailable, "buyer available after dispute release");
  assertClose(afterResolve.buyerWithdrawable, input.afterDispute.buyerWithdrawable, "buyer withdrawable after dispute release");
  assertClose(afterResolve.buyerEscrow, input.beforeBuyerWallet.escrowLockedBalance, "buyer escrow after dispute release");
  assertClose(
    afterResolve.sellerAvailable,
    decimal(input.beforeSellerWallet.availableBalance) + decimal(afterResolve.sellerReceivableAmount),
    "seller available after dispute release",
  );
  assertClose(
    afterResolve.sellerWithdrawable,
    decimal(input.beforeSellerWallet.withdrawableBalance) + decimal(afterResolve.sellerReceivableAmount),
    "seller withdrawable after dispute release",
  );
  assertClose(afterResolve.availableQuantity, input.afterDispute.availableQuantity, "inventory available after dispute release");
  assertClose(afterResolve.lockedQuantity, input.beforeInventory.lockedQuantity, "inventory locked after dispute release");
  assertClose(
    afterResolve.soldQuantity,
    decimal(input.beforeInventory.soldQuantity) + decimal(PURCHASE_QUANTITY),
    "inventory sold after dispute release",
  );

  await assertLedgerEntries(client, {
    orderId: input.orderId,
    type: "DISPUTE_RELEASE",
    expected: [
      ["DEBIT", "ESCROW_LOCKED", afterResolve.grossAmount],
      ["CREDIT", "AVAILABLE", afterResolve.sellerReceivableAmount],
      ["CREDIT", "WITHDRAWABLE", afterResolve.sellerReceivableAmount],
    ],
  });
  await assertLedgerEntries(client, {
    orderId: input.orderId,
    type: "PLATFORM_FEE_COLLECTED",
    expected: [
      ["CREDIT", "PLATFORM_REVENUE", afterResolve.platformFeeAmount],
    ],
  });
  await assertAuditLog(client, input.orderId, "DISPUTE_RELEASED_TO_SELLER");
  await assertTerminalActionBlocked(client, {
    token: input.adminToken,
    orderId: input.orderId,
    action: "REFUND_BUYER",
    message: "released dispute unexpectedly refunded buyer",
  });
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
    const amount = expectedAmount ?? input.amount;
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

async function assertAuditLog(client, orderId, action) {
  const result = await client.query(
    `select count(*)::int as count
       from "AdminAuditLog"
      where "targetType" = 'ORDER'
        and "targetId" = $1
        and action = $2`,
    [orderId, action],
  );
  if (result.rows[0].count < 1) {
    throw new Error(`Missing audit log ${action} for order ${orderId}`);
  }
}

async function assertTerminalActionBlocked(client, input) {
  const before = await readOrderSnapshot(client, input.orderId);
  const result = await postJson(
    "/api/admin/orders",
    input.token,
    {
      orderId: input.orderId,
      action: input.action,
    },
    { allowFailure: true },
  );
  if (result.response.ok) {
    throw new Error(input.message);
  }
  const after = await readOrderSnapshot(client, input.orderId);
  assertEqual(after.status, before.status, "terminal dispute status after invalid action");
  assertClose(after.buyerEscrow, before.buyerEscrow, "terminal dispute buyer escrow after invalid action");
  assertClose(after.sellerAvailable, before.sellerAvailable, "terminal dispute seller available after invalid action");
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
    title: `Lineage W 데포로쥬 분쟁 ${input.label} 테스트 ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`,
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
      `분쟁 ${input.label} 검증용 테스트 판매글입니다.`,
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
       o."canceledAt",
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
