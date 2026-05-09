const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const ORDER_ID = process.argv[2];

if (!ORDER_ID) {
  console.error("Usage: node scripts/run-order-completion-smoke-test.js <orderId>");
  process.exit(1);
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

async function createSession(client, email) {
  const userResult = await client.query(
    `select id, email from "User" where email = $1`,
    [email],
  );
  const user = userResult.rows[0];

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const token = randomUUID();
  await client.query(
    `insert into "Session" (id, "userId", token, "expiresAt", "createdAt", "lastSeenAt")
     values ($1, $2, $3, now() + interval '1 day', now(), now())`,
    [id("session"), user.id, token],
  );

  return { user, token };
}

async function postAction(path, token, body) {
  const response = await fetch(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${token}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(result)}`);
  }

  return result;
}

async function readSnapshot(client, orderId) {
  const result = await client.query(
    `select
       o.id,
       o."orderNumber",
       o.status::text,
       o.quantity::text,
       o."grossAmount"::text,
       buyer.email as "buyerEmail",
       seller.email as "sellerEmail",
       buyer_wallet."availableBalance"::text as "buyerAvailable",
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

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  const before = await readSnapshot(client, ORDER_ID);
  const sellerSession = await createSession(client, before.sellerEmail);
  const buyerSession = await createSession(client, before.buyerEmail);

  const startDelivery = await postAction(
    "/api/market/seller-orders",
    sellerSession.token,
    {
      orderId: ORDER_ID,
      action: "START_DELIVERY",
    },
  );
  const afterStart = await readSnapshot(client, ORDER_ID);

  const markDelivered = await postAction(
    "/api/market/seller-orders",
    sellerSession.token,
    {
      orderId: ORDER_ID,
      action: "MARK_DELIVERED",
    },
  );
  const afterDelivered = await readSnapshot(client, ORDER_ID);

  const confirmDelivery = await postAction(
    "/api/market/buyer-orders",
    buyerSession.token,
    {
      orderId: ORDER_ID,
      action: "CONFIRM_DELIVERY",
    },
  );
  const afterConfirm = await readSnapshot(client, ORDER_ID);

  await client.end();

  console.log(
    JSON.stringify(
      {
        orderId: ORDER_ID,
        before,
        sellerActions: {
          startDelivery,
          afterStart,
          markDelivered,
          afterDelivered,
        },
        buyerAction: {
          confirmDelivery,
          afterConfirm,
        },
        urls: {
          buyerOrder: `/my/orders/${ORDER_ID}`,
          buyerChat: `/my/orders/${ORDER_ID}/chat`,
          sellerOrder: `/my/listings/orders/${ORDER_ID}`,
          sellerChat: `/my/listings/orders/${ORDER_ID}/chat`,
          wallet: "/my/wallet",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
