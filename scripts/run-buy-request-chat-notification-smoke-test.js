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
  console.log(`[buy-request-chat-smoke] ${message}${suffix}`);
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertAtLeast(actual, expected, message) {
  if (Number(actual) < expected) {
    throw new Error(`${message}: expected at least ${expected}, got ${actual}`);
  }
}

async function postJson(path, token, body, options = {}) {
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
  if (!response.ok && !options.allowFailure) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return { response, json };
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  let buyRequestId = null;
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
    await topUpWalletIfNeeded(client, buyer.id, 100);

    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const buyerToken = await createSession(client, buyer.id);
    const sellerToken = await createSession(client, seller.id);

    logStep("create buy request and instant-sale order");
    const createResult = await postJson("/api/market/buy-requests", buyerToken, {
      mode: "CREATE",
      gameId: game.id,
      serverId: server.id,
      category: "GAME_MONEY",
      title: `Smoke chat buy request ${Date.now()}`,
      description: "구매요청 기반 채팅/알림 검증용 요청입니다.",
      quantity: REQUEST_QUANTITY,
      unitPrice: REQUEST_UNIT_PRICE,
      expiresInDays: 3,
    });
    buyRequestId = createResult.json.buyRequestId;

    const instantSale = await postJson("/api/market/buy-request-instant-sale", sellerToken, {
      buyRequestId,
    });
    orderId = instantSale.json.orderId;
    assertEqual(instantSale.json.status, "ESCROW_LOCKED", "instant sale order status");

    const initialRoom = await readChatRoomSnapshot(client, orderId);
    assertEqual(initialRoom.buyerId, buyer.id, "chat room buyer");
    assertEqual(initialRoom.sellerId, seller.id, "chat room seller");
    assertEqual(initialRoom.messageCount, "0", "initial message count");

    logStep("verify instant-sale notifications", { orderId, buyRequestId });
    await assertNotification(client, {
      userId: buyer.id,
      type: "ORDER_STATUS",
      href: `/my/orders/${orderId}`,
      orderId,
      buyRequestId,
      titleIncludes: "구매요청",
    });
    await assertNotification(client, {
      userId: seller.id,
      type: "ORDER_STATUS",
      href: `/my/listings/orders/${orderId}`,
      orderId,
      buyRequestId,
      titleIncludes: "즉시판매",
    });

    logStep("exchange chat messages");
    const sellerMessageBody = `전달 가능 시간 확인드립니다 ${Date.now()}`;
    const sellerMessage = await postJson("/api/market/order-chat", sellerToken, {
      orderId,
      body: sellerMessageBody,
    });
    const roomAfterSellerMessage = await readChatRoomSnapshot(client, orderId);
    assertEqual(roomAfterSellerMessage.messageCount, "1", "message count after seller chat");
    assertEqual(roomAfterSellerMessage.latestBody, sellerMessageBody, "latest seller message body");
    await assertNotification(client, {
      userId: buyer.id,
      type: "CHAT_MESSAGE",
      href: `/my/orders/${orderId}/chat`,
      orderId,
      roomId: sellerMessage.json.roomId,
      titleIncludes: "채팅",
    });

    const sellerUnreadAfterOwnMessage = await readUnreadCount(client, orderId, seller.id);
    const buyerUnreadBeforeRead = await readUnreadCount(client, orderId, buyer.id);
    assertEqual(sellerUnreadAfterOwnMessage, "0", "seller unread count after own message");
    assertEqual(buyerUnreadBeforeRead, "1", "buyer unread count before opening chat");

    const buyerMessageBody = `확인했습니다 ${Date.now()}`;
    const buyerMessage = await postJson("/api/market/order-chat", buyerToken, {
      orderId,
      body: buyerMessageBody,
    });
    const roomAfterBuyerMessage = await readChatRoomSnapshot(client, orderId);
    assertEqual(roomAfterBuyerMessage.messageCount, "2", "message count after buyer chat");
    assertEqual(roomAfterBuyerMessage.latestBody, buyerMessageBody, "latest buyer message body");
    await assertNotification(client, {
      userId: seller.id,
      type: "CHAT_MESSAGE",
      href: `/my/listings/orders/${orderId}/chat`,
      orderId,
      roomId: buyerMessage.json.roomId,
      titleIncludes: "채팅",
    });

    const buyerUnreadAfterOwnMessage = await readUnreadCount(client, orderId, buyer.id);
    const sellerUnreadBeforeRead = await readUnreadCount(client, orderId, seller.id);
    assertEqual(buyerUnreadAfterOwnMessage, "1", "buyer still has unread seller message before opening chat");
    assertEqual(sellerUnreadBeforeRead, "1", "seller unread count before opening chat");

    logStep("mark messages as read by opening chat views");
    await markMessagesRead(client, orderId, buyer.id);
    await markMessagesRead(client, orderId, seller.id);
    const finalBuyerUnread = await readUnreadCount(client, orderId, buyer.id);
    const finalSellerUnread = await readUnreadCount(client, orderId, seller.id);
    assertEqual(finalBuyerUnread, "0", "buyer unread count after read");
    assertEqual(finalSellerUnread, "0", "seller unread count after read");

    const finalRoom = await readChatRoomSnapshot(client, orderId);
    assertAtLeast(finalRoom.notificationCount, 4, "order notification count");

    console.log(
      JSON.stringify(
        {
          ok: true,
          buyRequestId,
          orderId,
          roomId: finalRoom.roomId,
          messageCount: finalRoom.messageCount,
          notificationCount: finalRoom.notificationCount,
          urls: {
            buyerChat: `/my/orders/${orderId}/chat`,
            sellerChat: `/my/listings/orders/${orderId}/chat`,
            buyerOrder: `/my/orders/${orderId}`,
            sellerOrder: `/my/listings/orders/${orderId}`,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
    if (buyRequestId || orderId) {
      logStep("last ids", { buyRequestId, orderId });
    }
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

async function readChatRoomSnapshot(client, orderId) {
  const result = await client.query(
    `select
       room.id as "roomId",
       room."buyerId",
       room."sellerId",
       count(message.id)::text as "messageCount",
       max(message."createdAt") as "latestMessageAt",
       (
         select body
           from "ChatMessage"
          where "roomId" = room.id
          order by "createdAt" desc
          limit 1
       ) as "latestBody",
       (
         select count(*)::text
           from "Notification"
          where ("metadata"->>'orderId') = $1
       ) as "notificationCount"
     from "ChatRoom" room
     left join "ChatMessage" message on message."roomId" = room.id
     where room."orderId" = $1
     group by room.id`,
    [orderId],
  );
  if (!result.rows[0]) throw new Error(`Chat room not found for order ${orderId}`);
  return result.rows[0];
}

async function assertNotification(client, input) {
  const result = await client.query(
    `select id, title, body, href, metadata
       from "Notification"
      where "userId" = $1
        and type = $2::"NotificationType"
        and href = $3
        and ("metadata"->>'orderId') = $4
      order by "createdAt" desc
      limit 1`,
    [input.userId, input.type, input.href, input.orderId],
  );
  const notification = result.rows[0];
  if (!notification) {
    throw new Error(`Missing ${input.type} notification for ${input.userId} ${input.href}`);
  }
  if (input.buyRequestId && notification.metadata?.buyRequestId !== input.buyRequestId) {
    throw new Error(`Notification buyRequestId mismatch: ${JSON.stringify(notification)}`);
  }
  if (input.roomId && notification.metadata?.roomId !== input.roomId) {
    throw new Error(`Notification roomId mismatch: ${JSON.stringify(notification)}`);
  }
  if (input.titleIncludes && !notification.title.includes(input.titleIncludes)) {
    throw new Error(`Notification title mismatch: ${JSON.stringify(notification)}`);
  }
}

async function markMessagesRead(client, orderId, readerId) {
  await client.query(
    `update "ChatMessage"
        set "readAt" = now()
      where "roomId" = (select id from "ChatRoom" where "orderId" = $1)
        and "senderId" <> $2
        and "readAt" is null`,
    [orderId, readerId],
  );
}

async function readUnreadCount(client, orderId, readerId) {
  const result = await client.query(
    `select count(*)::text as count
       from "ChatMessage"
      where "roomId" = (select id from "ChatRoom" where "orderId" = $1)
        and "senderId" <> $2
        and "readAt" is null`,
    [orderId, readerId],
  );
  return result.rows[0].count;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
