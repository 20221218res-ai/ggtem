const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "buyer-order-route-test@ggitem.local";
const SELLER_EMAIL = "seller-order-route-test@ggitem.local";

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
    throw new Error(`${message}: expected page to include ${needle}`);
  }
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const buyer = await ensureUser(client, {
      email: BUYER_EMAIL,
      displayName: "buyer-order-route",
      role: "CUSTOMER",
    });
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-order-route",
      role: "SELLER",
    });
    await ensureWallet(client, buyer.id, "100");
    await ensureWallet(client, seller.id, "0");

    const catalog = await ensureGameAndServer(client);
    const listing = await createListing(client, {
      sellerId: seller.id,
      gameId: catalog.gameId,
      serverId: catalog.serverId,
      title: `주문 이동 검증 판매글 ${Date.now().toString(36)}`,
      quantity: "10000",
      minimumQuantity: "1000",
      unitPrice: "0.0005",
    });

    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);

    const purchase = await postPurchase(buyerToken, {
      listingId: listing.id,
      quantity: "1000",
      amount: "0.5",
    });
    assertEqual(purchase.status, 200, "purchase status");
    assertEqual(purchase.json.status, "ESCROW_LOCKED", "purchase order status");

    const checks = [
      {
        label: "buyer order detail",
        path: `/my/orders/${purchase.json.orderId}`,
        token: buyerToken,
        expected: [
          purchase.json.orderNumber,
          listing.title,
          seller.displayName,
          "\uAD6C\uB9E4 \uC8FC\uBB38",
          "\uCC44\uD305\uD558\uAE30",
          "\uD604\uC7AC \uC0C1\uD0DC",
          "\uC0C1\uC138 \uAE30\uB85D",
          "\uBE60\uB978 \uC774\uB3D9",
        ],
      },
      {
        label: "buyer order chat",
        path: `/my/orders/${purchase.json.orderId}/chat`,
        token: buyerToken,
        expected: [
          purchase.json.orderNumber,
          listing.title,
          seller.displayName,
          "\uAD6C\uB9E4 \uCC44\uD305",
          "\uC8FC\uBB38 \uBCF4\uAE30",
          "\uB9E4\uBB3C \uBCF4\uAE30",
          "\uBA54\uC2DC\uC9C0 \uC785\uB825",
          "\uBCF4\uB0B4\uAE30",
        ],
      },
      {
        label: "seller order detail",
        path: `/my/listings/orders/${purchase.json.orderId}`,
        token: sellerToken,
        expected: [
          purchase.json.orderNumber,
          listing.title,
          buyer.displayName,
          "\uD310\uB9E4 \uC8FC\uBB38",
          "\uCC44\uD305\uD558\uAE30",
          "\uD604\uC7AC \uC0C1\uD0DC",
          "\uC0C1\uC138 \uAE30\uB85D",
          "\uBE60\uB978 \uC774\uB3D9",
        ],
      },
      {
        label: "seller order chat",
        path: `/my/listings/orders/${purchase.json.orderId}/chat`,
        token: sellerToken,
        expected: [
          purchase.json.orderNumber,
          listing.title,
          buyer.displayName,
          "\uD310\uB9E4 \uCC44\uD305",
          "\uC8FC\uBB38 \uBCF4\uAE30",
          "\uB9E4\uBB3C \uBCF4\uAE30",
          "\uBA54\uC2DC\uC9C0 \uC785\uB825",
          "\uBCF4\uB0B4\uAE30",
        ],
      },
    ];

    const checked = [];
    for (const check of checks) {
      const page = await fetchPage(check.path, check.token);
      assertEqual(page.status, 200, `${check.label} status`);
      for (const needle of check.expected) {
        assertIncludes(page.text, needle, `${check.label} content`);
      }
      checked.push(check.label);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          orderId: purchase.json.orderId,
          orderNumber: purchase.json.orderNumber,
          listingId: listing.id,
          checked,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

async function postPurchase(token, body) {
  const response = await fetch(`${BASE_URL}/api/market/purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : {},
  };
}

async function fetchPage(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Cookie: `ggitem_session=${token}`,
    },
    redirect: "manual",
  });
  return {
    status: response.status,
    text: await response.text(),
  };
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
      `${input.title} 상세 설명입니다. 구매 성공 후 주문 상세와 채팅 화면 연결을 검증합니다.`,
      input.unitPrice,
    ],
  );
  await client.query(
    `insert into "ListingInventory" (id, "listingId", "totalQuantity", "minimumQuantity", "availableQuantity", "lockedQuantity", "soldQuantity", version, "updatedAt")
     values ($1, $2, $3, $4, $3, 0, 0, 0, now())`,
    [id("inventory"), listingId, input.quantity, input.minimumQuantity],
  );
  return { id: listingId, title: input.title };
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
