const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const ADMIN_EMAIL = "super-demo@ggitem.local";
const REQUEST_QUANTITY = "1000";
const REQUEST_UNIT_PRICE = "0.0005";
const REQUEST_TOTAL = "0.5";
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[buy-request-dispute-smoke] ${message}${suffix}`);
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
  if (Math.abs(decimal(actual) - decimal(expected)) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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
  await client.connect();

  const created = [];
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

    await ensureWallet(client, buyer.id);
    await ensureWallet(client, seller.id);
    await topUpWalletIfNeeded(client, buyer.id, 100);

    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);
    const adminToken = await createSession(client, admin.id);

    const refundCase = await createDisputedBuyRequestOrder(client, {
      buyer,
      seller,
      gameId: game.id,
      serverId: server.id,
      buyerToken,
      sellerToken,
      label: "refund",
    });
    created.push(refundCase.orderId);
    await resolveRefundCase(client, { ...refundCase, adminToken });

    const releaseCase = await createDisputedBuyRequestOrder(client, {
      buyer,
      seller,
      gameId: game.id,
      serverId: server.id,
      buyerToken,
      sellerToken,
      label: "release",
    });
    created.push(releaseCase.orderId);
    await resolveReleaseCase(client, { ...releaseCase, adminToken });

    console.log(
      JSON.stringify(
        {
          ok: true,
          refund: {
            buyRequestId: refundCase.buyRequestId,
            orderId: refundCase.orderId,
          },
          release: {
            buyRequestId: releaseCase.buyRequestId,
            orderId: releaseCase.orderId,
          },
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
    if (created.length > 0) logStep("created order ids", { orderIds: created });
    await client.end();
  }
}

async function createDisputedBuyRequestOrder(client, input) {
  const beforeBuyerWallet = await readWallet(client, input.buyer.id);
  const beforeSellerWallet = await readWallet(client, input.seller.id);

  logStep("buyer creates buy request", { label: input.label });
  const createResult = await postJson("/api/market/buy-requests", input.buyerToken, {
    mode: "CREATE",
    gameId: input.gameId,
    serverId: input.serverId,
    category: "GAME_MONEY",
    title: `Smoke dispute buy request ${input.label} ${Date.now()}`,
    description: "구매요청 기반 분쟁 처리 검증용 요청입니다.",
    quantity: REQUEST_QUANTITY,
    unitPrice: REQUEST_UNIT_PRICE,
    expiresInDays: 3,
  });
  const buyRequestId = createResult.json.buyRequestId;
  const afterCreate = await readBuyRequestSnapshot(client, buyRequestId);
  assertEqual(afterCreate.buyRequestStatus, "ACTIVE", `${input.label} buy request after create`);
  assertClose(afterCreate.buyRequestLockAmount, REQUEST_TOTAL, `${input.label} lock amount after create`);

  logStep("seller instantly sells to buy request", { label: input.label, buyRequestId });
  const instantSale = await postJson("/api/market/buy-request-instant-sale", input.sellerToken, {
    buyRequestId,
  });
  const orderId = instantSale.json.orderId;
  const afterInstantSale = await readBuyRequestOrderSnapshot(client, { buyRequestId, orderId });
  assertEqual(afterInstantSale.buyRequestStatus, "ACCEPTED", `${input.label} buy request after instant sale`);
  assertEqual(afterInstantSale.orderStatus, "ESCROW_LOCKED", `${input.label} order after instant sale`);
  assertClose(afterInstantSale.buyerEscrow, decimal(beforeBuyerWallet.escrowLockedBalance) + decimal(REQUEST_TOTAL), `${input.label} buyer escrow after instant sale`);
  assertClose(afterInstantSale.buyerBuyRequestLocked, beforeBuyerWallet.buyRequestLocked, `${input.label} buy request lock moved to escrow`);

  logStep("buyer reports problem", { label: input.label, orderId });
  const dispute = await postJson("/api/market/buyer-orders", input.buyerToken, {
    orderId,
    action: "REPORT_PROBLEM",
    reason: `${input.label} buy-request dispute smoke evidence.`,
  });
  assertEqual(dispute.json.status, "DISPUTED", `${input.label} dispute response`);

  const afterDispute = await readBuyRequestOrderSnapshot(client, { buyRequestId, orderId });
  assertEqual(afterDispute.buyRequestStatus, "ACCEPTED", `${input.label} buy request while disputed`);
  assertEqual(afterDispute.orderStatus, "DISPUTED", `${input.label} order after dispute`);
  assertClose(afterDispute.buyerEscrow, afterInstantSale.buyerEscrow, `${input.label} buyer escrow while disputed`);

  return {
    buyRequestId,
    orderId,
    beforeBuyerWallet,
    beforeSellerWallet,
    afterInstantSale,
    afterDispute,
  };
}

async function resolveRefundCase(client, input) {
  logStep("admin refunds buyer", { orderId: input.orderId });
  const result = await postJson("/api/admin/orders", input.adminToken, {
    orderId: input.orderId,
    action: "REFUND_BUYER",
    note: "Smoke test: refund buy-request dispute to buyer.",
  });
  assertEqual(result.json.status, "REFUNDED", "refund response status");

  const afterResolve = await readBuyRequestOrderSnapshot(client, input);
  assertEqual(afterResolve.buyRequestStatus, "CANCELED", "buy request after dispute refund");
  assertEqual(afterResolve.orderStatus, "REFUNDED", "order after dispute refund");
  assertClose(afterResolve.buyerAvailable, input.beforeBuyerWallet.availableBalance, "buyer available after dispute refund");
  assertClose(afterResolve.buyerWithdrawable, input.beforeBuyerWallet.withdrawableBalance, "buyer withdrawable after dispute refund");
  assertClose(afterResolve.buyerEscrow, input.beforeBuyerWallet.escrowLockedBalance, "buyer escrow after dispute refund");
  assertClose(afterResolve.sellerAvailable, input.beforeSellerWallet.availableBalance, "seller available after dispute refund");
  assertClose(afterResolve.inventoryLocked, "0", "inventory locked after dispute refund");
  await assertLedgerEntries(client, {
    orderId: input.orderId,
    type: "DISPUTE_REFUND",
    amount: REQUEST_TOTAL,
    expected: [
      ["DEBIT", "ESCROW_LOCKED"],
      ["CREDIT", "AVAILABLE"],
      ["CREDIT", "WITHDRAWABLE"],
    ],
  });
  await assertAuditLog(client, input.orderId, "DISPUTE_REFUNDED_TO_BUYER");
}

async function resolveReleaseCase(client, input) {
  logStep("admin releases to seller", { orderId: input.orderId });
  const result = await postJson("/api/admin/orders", input.adminToken, {
    orderId: input.orderId,
    action: "RELEASE_TO_SELLER",
    note: "Smoke test: release buy-request dispute to seller.",
  });
  assertEqual(result.json.status, "COMPLETED", "release response status");

  const afterResolve = await readBuyRequestOrderSnapshot(client, input);
  assertEqual(afterResolve.buyRequestStatus, "COMPLETED", "buy request after dispute release");
  assertEqual(afterResolve.orderStatus, "COMPLETED", "order after dispute release");
  assertClose(afterResolve.buyerAvailable, input.afterDispute.buyerAvailable, "buyer available after dispute release");
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
  assertClose(afterResolve.inventoryLocked, "0", "inventory locked after dispute release");
  assertClose(afterResolve.inventorySold, REQUEST_QUANTITY, "inventory sold after dispute release");
  await assertLedgerEntries(client, {
    orderId: input.orderId,
    type: "DISPUTE_RELEASE",
    expected: [
      ["DEBIT", "ESCROW_LOCKED", REQUEST_TOTAL],
      ["CREDIT", "AVAILABLE", afterResolve.sellerReceivableAmount],
      ["CREDIT", "WITHDRAWABLE", afterResolve.sellerReceivableAmount],
    ],
  });
  await assertAuditLog(client, input.orderId, "DISPUTE_RELEASED_TO_SELLER");
}

async function assertLedgerEntries(client, input) {
  const result = await client.query(
    `select direction::text, bucket::text, amount::text
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
      throw new Error(`Missing ${input.type} ${direction}/${bucket}: ${JSON.stringify(result.rows)}`);
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
    throw new Error(`Missing admin audit log ${action} for order ${orderId}`);
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
  if (decimal(wallet.availableBalance) >= minimumAmount && decimal(wallet.withdrawableBalance) >= minimumAmount) return;
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
       br.id as "buyRequestId",
       br.status::text as "buyRequestStatus",
       br."lockAmount"::text as "buyRequestLockAmount",
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

async function readBuyRequestOrderSnapshot(client, input) {
  const result = await client.query(
    `select
       br.id as "buyRequestId",
       br.status::text as "buyRequestStatus",
       br."lockAmount"::text as "buyRequestLockAmount",
       o.id as "orderId",
       o."orderNumber",
       o.status::text as "orderStatus",
       o."completedAt",
       o."canceledAt",
       o."sellerReceivableAmount"::text as "sellerReceivableAmount",
       o."platformFeeAmount"::text as "platformFeeAmount",
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
