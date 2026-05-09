const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const BUYER_EMAIL = "buyer-public-buy-request-exposure@ggitem.local";

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
    const buyer = await ensureUser(client, {
      email: BUYER_EMAIL,
      displayName: "buyer-public-exposure",
      role: "CUSTOMER",
    });
    await ensureWallet(client, buyer.id);
    const catalog = await ensureGameAndServer(client);
    const buyerToken = await createSession(client, buyer.id);
    const unique = Date.now().toString(36);
    const requestInput = {
      gameId: catalog.gameId,
      serverId: catalog.serverId,
      category: "GAME_MONEY",
      title: `Public Exposure 게임머니 구매 ${unique}`,
      description: `Public Exposure 구매 설명 ${unique}`,
      quantity: "5000",
      unitPrice: "0.0005",
      totalAmount: "2.5",
      expiresInDays: 3,
    };
    const createResult = await createBuyRequestViaApi(buyerToken, requestInput);

    const listPagePath = `/listings?mode=buy&category=GAME_MONEY&game=${encodeURIComponent(
      catalog.gameName,
    )}&query=${encodeURIComponent(requestInput.title)}`;
    const listHtml = await fetchText(listPagePath);
    assertIncludes(listHtml, createResult.buyRequestId, "public buy request id visibility");
    assertIncludes(listHtml, requestInput.title, "public buy request title visibility");
    assertIncludes(listHtml, catalog.gameName, "public buy request game visibility");
    assertIncludes(listHtml, catalog.serverName, "public buy request server visibility");
    assertIncludes(listHtml, buyer.displayName, "public buy request buyer visibility");
    assertIncludes(listHtml, requestInput.quantity, "public buy request quantity visibility");
    assertIncludes(listHtml, requestInput.unitPrice, "public buy request unit price visibility");
    assertIncludes(listHtml, requestInput.totalAmount, "public buy request reserve amount visibility");
    assertIncludes(listHtml, "즉시 판매", "public buy request instant-sale action visibility");

    const missingServer = await createBuyRequestViaApi(
      buyerToken,
      {
        ...requestInput,
        title: `Missing Server 구매 ${unique}`,
        serverId: "",
      },
      { expectStatus: 400 },
    );
    assertIncludes(
      missingServer.message ?? "",
      "서버",
      "buy request API requires one server per request",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          buyRequestId: createResult.buyRequestId,
          checked: [
            "created buy request visible in /listings?mode=buy",
            "admin game/server data exposed to public buy requests",
            "server/quantity/unit price/reserve amount exposed",
            "single server required by buy request API",
          ],
          urls: {
            listPagePath,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

async function createBuyRequestViaApi(token, body, options = {}) {
  const response = await fetch(`${BASE_URL}/api/market/buy-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `ggitem_session=${token}`,
    },
    body: JSON.stringify({ mode: "CREATE", ...body }),
  });
  const result = await response.json();
  const expectStatus = options.expectStatus ?? 200;

  if (response.status !== expectStatus) {
    throw new Error(
      `create buy request expected ${expectStatus} but got ${response.status}: ${JSON.stringify(
        result,
      )}`,
    );
  }

  if (expectStatus === 200 && !result.buyRequestId) {
    throw new Error(`create buy request response missing buyRequestId: ${JSON.stringify(result)}`);
  }

  return result;
}

async function fetchText(path) {
  const response = await fetch(`${BASE_URL}${path}`);
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

async function ensureWallet(client, userId) {
  await client.query(
    `insert into "Wallet" (id, "userId", currency, "availableBalance", "escrowLockedBalance", "buyRequestLocked", "pendingSettlement", "withdrawableBalance", "withdrawalLocked", "createdAt", "updatedAt")
     values ($1, $2, 'USDT', 1000, 0, 0, 0, 1000, 0, now(), now())
     on conflict ("userId") do update
       set currency = 'USDT',
           "availableBalance" = greatest("Wallet"."availableBalance", 1000),
           "withdrawableBalance" = greatest("Wallet"."withdrawableBalance", 1000),
           "updatedAt" = now()`,
    [id("wallet"), userId],
  );
}

async function ensureGameAndServer(client) {
  let game = await client.query(`select id, name from "Game" where name = 'Lineage W' limit 1`);
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
    `select id, name from "GameServer" where "gameId" = $1 and name = '데포로쥬' limit 1`,
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

  return { gameId, gameName: "Lineage W", serverId, serverName: "데포로쥬" };
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
