const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";

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
  const ids = {};

  try {
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-flow-test",
      role: "SELLER",
    });
    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const sellerToken = await createSession(client, seller.id);

    ids.active = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: `Edit status active ${unique}`,
      status: "ACTIVE",
      availableQuantity: 1000,
    });
    ids.hidden = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: `Edit status hidden ${unique}`,
      status: "HIDDEN",
      availableQuantity: 1000,
    });
    ids.paused = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: `Edit status paused ${unique}`,
      status: "PAUSED",
      availableQuantity: 1000,
    });
    ids.soldOut = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: `Edit status soldout ${unique}`,
      status: "SOLD_OUT",
      availableQuantity: 0,
    });

    const activePage = await fetchText(`/my/listings/${ids.active}/edit`, sellerToken);
    assertIncludes(activePage, "공개 목록에 노출 중입니다.", "active guide");
    assertIncludes(activePage, `/listings/${ids.active}`, "active public link");
    assertIncludes(activePage, "판매글 수정", "edit form heading");
    assertIncludes(activePage, "변경사항 저장", "save button label");
    assertIncludes(activePage, "대표 이미지", "image form heading");
    assertIncludes(activePage, "이미지 저장", "image save button label");

    const hiddenPage = await fetchText(`/my/listings/${ids.hidden}/edit`, sellerToken);
    assertIncludes(hiddenPage, "공개 목록에서 숨겨진 판매글입니다.", "hidden guide");
    assertNotIncludes(hiddenPage, "공개 매물 보기", "hidden public link hidden");
    assertIncludes(hiddenPage, "재개", "hidden resume action");

    const pausedPage = await fetchText(`/my/listings/${ids.paused}/edit`, sellerToken);
    assertIncludes(pausedPage, "판매자가 판매를 멈춘 상태입니다.", "paused guide");
    assertIncludes(pausedPage, "재개", "paused resume action");

    const soldOutPage = await fetchText(`/my/listings/${ids.soldOut}/edit`, sellerToken);
    assertIncludes(soldOutPage, "더 이상 공개 판매하지 않는 글입니다.", "sold-out guide");
    assertNotIncludes(soldOutPage, "공개 매물 보기", "sold-out public link hidden");

    console.log(
      JSON.stringify(
        {
          ok: true,
          ids,
          checked: ["ACTIVE", "HIDDEN", "PAUSED", "SOLD_OUT"],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

async function fetchText(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Cookie: `ggitem_session=${token}` } : {},
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return text;
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
     values ($1, $2, $3, $4, 'GAME_MONEY'::"ListingCategory", $5, $6, 0.0005, 'USDT', $7::"ListingStatus", now(), now())`,
    [
      listingId,
      input.sellerId,
      input.gameId,
      input.serverId,
      input.title,
      `${input.title} description`,
      input.status,
    ],
  );
  await client.query(
    `insert into "ListingInventory" (id, "listingId", "totalQuantity", "minimumQuantity", "availableQuantity", "lockedQuantity", "soldQuantity", version, "updatedAt")
     values ($1, $2, 1000, 100, $3, 0, $4, 0, now())`,
    [
      id("inventory"),
      listingId,
      input.availableQuantity,
      input.availableQuantity > 0 ? 0 : 1000,
    ],
  );
  return listingId;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
