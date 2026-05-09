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

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-flow-test",
      role: "SELLER",
    });
    await ensureGameAndServer(client);
    const sellerToken = await createSession(client, seller.id);
    const response = await fetch(`${BASE_URL}/my/listings/new`, {
      headers: {
        Cookie: `ggitem_session=${sellerToken}`,
      },
    });
    const html = await response.text();

    if (!response.ok) {
      throw new Error(`/my/listings/new failed (${response.status}): ${html.slice(0, 300)}`);
    }

    assertIncludes(html, "판매 등록", "page title");
    assertIncludes(html, "품목", "category panel label");
    assertIncludes(html, "게임 / 서버", "game server panel label");
    assertIncludes(html, "판매 총액", "preview total label");
    assertIncludes(html, "판매 등록하기", "submit button label");
    assertIncludes(html, "대표 이미지", "representative image label");
    assertIncludes(html, "이미지 설명", "image alt label");

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: ["/my/listings/new copy", "/my/listings/new image help"],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
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

  const server = await client.query(
    `select id from "GameServer" where "gameId" = $1 and "isActive" = true limit 1`,
    [gameId],
  );
  if (!server.rows[0]) {
    await client.query(
      `insert into "GameServer" (id, "gameId", name, code, "isActive")
       values ($1, $2, '데포로쥬', $3, true)`,
      [id("server"), gameId, `DEPOROJU_${Date.now()}`],
    );
  }
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
