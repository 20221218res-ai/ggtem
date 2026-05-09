const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[visibility-policy-smoke] ${message}${suffix}`);
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

  const unique = Date.now().toString(36);
  const listingTitle = `Visibility active listing ${unique}`;
  const buyRequestTitle = `Visibility active buy request ${unique}`;
  let listingId = null;
  let buyRequestId = null;
  let orderId = null;

  try {
    logStep("prepare actors, game, and server");
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
    await topUpWalletIfNeeded(client, buyer.id, 100);
    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const buyerToken = await createSession(client, buyer.id);

    logStep("create active public listing");
    listingId = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: listingTitle,
    });

    let publicSellPage = await fetchText(`/listings?mode=sell&query=${encodeURIComponent(listingTitle)}`);
    assertIncludes(publicSellPage, listingId, "active listing public visibility");
    let publicListingDetail = await fetchText(`/listings/${listingId}`);
    assertIncludes(publicListingDetail, listingTitle, "active listing detail visibility");

    logStep("make listing sold out and verify public disappearance", { listingId });
    await client.query(
      `update "ListingInventory"
          set "availableQuantity" = 0,
              "lockedQuantity" = 0,
              "soldQuantity" = "totalQuantity",
              "updatedAt" = now()
        where "listingId" = $1`,
      [listingId],
    );
    publicSellPage = await fetchText(`/listings?mode=sell&query=${encodeURIComponent(listingTitle)}`);
    assertNotIncludes(publicSellPage, listingId, "sold-out listing public visibility");
    const soldOutDetail = await fetchText(`/listings/${listingId}`, undefined, {
      allowedStatuses: [404],
    });
    if (soldOutDetail.status !== 404) {
      assertNotIncludes(soldOutDetail.text, listingTitle, "sold-out listing detail visibility");
    }

    logStep("create active buy request");
    const createBuyRequest = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CREATE",
      gameId: game.id,
      serverId: server.id,
      category: "GAME_MONEY",
      title: buyRequestTitle,
      description: "공개 구매요청 노출 정책 검증용 요청입니다.",
      quantity: "1000",
      unitPrice: "0.0005",
      expiresInDays: 3,
    });
    buyRequestId = createBuyRequest.json.buyRequestId;

    let publicBuyPage = await fetchText(`/listings?mode=buy&query=${encodeURIComponent(buyRequestTitle)}`);
    assertIncludes(publicBuyPage, buyRequestId, "active buy request public visibility");

    logStep("cancel buy request and verify public disappearance plus owner history", { buyRequestId });
    const cancelBuyRequest = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CANCEL",
      buyRequestId,
    });
    if (cancelBuyRequest.json.status !== "CANCELED") {
      throw new Error(`Buy request cancel failed: ${JSON.stringify(cancelBuyRequest.json)}`);
    }

    publicBuyPage = await fetchText(`/listings?mode=buy&query=${encodeURIComponent(buyRequestTitle)}`);
    assertNotIncludes(publicBuyPage, buyRequestId, "canceled buy request public visibility");

    const myBuyRequestsPage = await fetchText("/my/buy-requests", buyerToken);
    assertIncludes(myBuyRequestsPage, buyRequestTitle, "canceled buy request owner history");
    assertIncludes(myBuyRequestsPage, "취소", "canceled buy request owner status");

    logStep("create completed order and verify it remains in seller order history");
    const orderListingId = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: `Visibility completed order listing ${unique}`,
    });
    const purchase = await postJson("/api/market/purchase", buyerToken, {
      listingId: orderListingId,
      quantity: "1000",
      amount: "0.5",
    });
    orderId = purchase.json.orderId;
    await client.query(
      `update "Order"
          set status = 'COMPLETED'::"OrderStatus",
              "completedAt" = now(),
              "updatedAt" = now()
        where id = $1`,
      [orderId],
    );
    const sellerToken = await createSession(client, seller.id);
    const myListingsPage = await fetchText("/my/listings", sellerToken);
    assertIncludes(myListingsPage, purchase.json.orderNumber, "completed order seller history");

    console.log(
      JSON.stringify(
        {
          ok: true,
          listingId,
          buyRequestId,
          orderId,
          titles: {
            listingTitle,
            buyRequestTitle,
          },
          urls: {
            publicListings: `/listings?mode=sell&query=${encodeURIComponent(listingTitle)}`,
            publicBuyRequests: `/listings?mode=buy&query=${encodeURIComponent(buyRequestTitle)}`,
            myBuyRequests: "/my/buy-requests",
            myListings: "/my/listings",
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
    if (listingId || buyRequestId || orderId) {
      logStep("last ids", { listingId, buyRequestId, orderId });
    }
  }
}

async function fetchText(path, token, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Cookie: `ggitem_session=${token}` } : {},
  });
  const text = await response.text();
  const allowedStatuses = options.allowedStatuses ?? [];
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    throw new Error(`${path} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  if (allowedStatuses.length > 0) {
    return { status: response.status, text };
  }
  return text;
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
  return { response, json };
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
  const wallet = await client.query(
    `select "availableBalance"::text as "availableBalance", "withdrawableBalance"::text as "withdrawableBalance"
       from "Wallet"
      where "userId" = $1`,
    [userId],
  );
  if (
    Number(wallet.rows[0].availableBalance) >= minimumAmount &&
    Number(wallet.rows[0].withdrawableBalance) >= minimumAmount
  ) {
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

async function createListing(client, input) {
  const listingId = id("listing");
  await client.query(
    `insert into "Listing" (id, "sellerId", "gameId", "serverId", category, title, description, "unitPrice", currency, status, "createdAt", "updatedAt")
     values ($1, $2, $3, $4, 'GAME_MONEY'::"ListingCategory", $5, $6, 0.0005, 'USDT', 'ACTIVE'::"ListingStatus", now(), now())`,
    [
      listingId,
      input.sellerId,
      input.gameId,
      input.serverId,
      input.title,
      `${input.title} description`,
    ],
  );
  await client.query(
    `insert into "ListingInventory" (id, "listingId", "totalQuantity", "minimumQuantity", "availableQuantity", "lockedQuantity", "soldQuantity", version, "updatedAt")
     values ($1, $2, 1000, 100, 1000, 0, 0, 0, now())`,
    [id("inventory"), listingId],
  );
  return listingId;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
