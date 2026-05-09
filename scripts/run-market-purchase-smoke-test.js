const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

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

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  const buyer = await ensureUser(client, {
    email: "user-demo@ggitem.local",
    displayName: "user-demo",
    role: "CUSTOMER",
  });
  const seller = await ensureUser(client, {
    email: "seller-flow-test@ggitem.local",
    displayName: "seller-flow-test",
    role: "SELLER",
  });

  const buyerWallet = await ensureWallet(client, buyer.id);
  await client.query(
    `update "Wallet"
       set "availableBalance" = greatest("availableBalance", 100::numeric),
           "withdrawableBalance" = greatest("withdrawableBalance", 100::numeric),
           "updatedAt" = now()
     where id = $1`,
    [buyerWallet.id],
  );
  await ensureWallet(client, seller.id);

  const game = await ensureGame(client);
  const server = await ensureServer(client, game.id);
  const listing = await createSmokeListing(client, {
    sellerId: seller.id,
    gameId: game.id,
    serverId: server.id,
  });
  const sessionToken = await createBuyerSession(client, buyer.id);

  await client.end();

  const response = await fetch("http://localhost:3000/api/market/purchase", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${sessionToken}`,
    },
    body: JSON.stringify({
      listingId: listing.id,
      quantity: "1000",
      amount: "0.5",
    }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Purchase API failed: ${JSON.stringify(body)}`);
  }

  console.log(
    JSON.stringify(
      {
        buyer: buyer.email,
        seller: seller.email,
        listingId: listing.id,
        listingTitle: listing.title,
        orderId: body.orderId,
        orderNumber: body.orderNumber,
        status: body.status,
        amount: body.amount,
        quantity: body.quantity,
        buyerOrderUrl: `/my/orders/${body.orderId}`,
        buyerChatUrl: `/my/orders/${body.orderId}/chat`,
        sellerOrderUrl: `/my/listings/orders/${body.orderId}`,
        sellerChatUrl: `/my/listings/orders/${body.orderId}/chat`,
        buyerWallet: body.buyerWallet,
        inventory: body.inventory,
      },
      null,
      2,
    ),
  );
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
    title: `Lineage W 데포로쥬 게임머니 테스트 판매 ${new Date().toLocaleTimeString("ko-KR", { hour12: false })}`,
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
      "실제 주문 흐름 검증용 테스트 판매글입니다. 주문 생성, 에스크로 잠금, 구매자/판매자 화면 연결을 확인합니다.",
    ],
  );
  await client.query(
    `insert into "ListingInventory" (id, "listingId", "totalQuantity", "minimumQuantity", "availableQuantity", "lockedQuantity", "soldQuantity", version, "updatedAt")
     values ($1, $2, 100000, 1000, 100000, 0, 0, 0, now())`,
    [id("inventory"), listing.id],
  );

  return listing;
}

async function createBuyerSession(client, userId) {
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
