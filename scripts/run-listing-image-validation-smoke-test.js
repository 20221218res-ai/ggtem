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

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  let listingId = null;

  try {
    const seller = await ensureUser(client, {
      email: SELLER_EMAIL,
      displayName: "seller-flow-test",
      role: "SELLER",
    });
    const game = await ensureGame(client);
    const server = await ensureServer(client, game.id);
    const sellerToken = await createSession(client, seller.id);

    listingId = await createListing(client, {
      sellerId: seller.id,
      gameId: game.id,
      serverId: server.id,
      title: `Image validation ${Date.now().toString(36)}`,
    });

    const spoofedPng = await postImage(sellerToken, {
      listingId,
      fileName: "not-real.png",
      contentType: "image/png",
      bytes: Buffer.from("not an actual png file"),
      expectedStatus: 400,
    });
    if (!String(spoofedPng.message).includes("이미지 파일 형식")) {
      throw new Error(`spoofed image was not rejected correctly: ${JSON.stringify(spoofedPng)}`);
    }

    const oversizedJpg = await postImage(sellerToken, {
      listingId,
      fileName: "oversized.jpg",
      contentType: "image/jpeg",
      bytes: Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.alloc(5 * 1024 * 1024 + 1),
      ]),
      expectedStatus: 400,
    });
    if (!String(oversizedJpg.message).includes("5MB")) {
      throw new Error(`oversized image was not rejected correctly: ${JSON.stringify(oversizedJpg)}`);
    }

    const validPng = await postImage(sellerToken, {
      listingId,
      fileName: "valid.png",
      contentType: "image/png",
      bytes: tinyPng(),
      expectedStatus: 200,
    });
    if (!validPng.imageUrl || !String(validPng.imageUrl).endsWith(".png")) {
      throw new Error(`valid image upload failed: ${JSON.stringify(validPng)}`);
    }

    const stored = await client.query(
      `select "imageUrl", "storagePath" from "ListingImage" where "listingId" = $1`,
      [listingId],
    );
    if (stored.rowCount !== 1 || stored.rows[0].imageUrl !== validPng.imageUrl) {
      throw new Error("uploaded image was not stored correctly");
    }
    if (!fs.existsSync(stored.rows[0].storagePath)) {
      throw new Error("uploaded image file was not written to disk");
    }

    const deleted = await deleteImage(sellerToken, listingId);
    if (deleted.imageUrl !== null) {
      throw new Error(`image delete failed: ${JSON.stringify(deleted)}`);
    }

    const afterDelete = await client.query(
      `select id from "ListingImage" where "listingId" = $1`,
      [listingId],
    );
    if (afterDelete.rowCount !== 0) {
      throw new Error("image row still exists after delete");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          listingId,
          checked: ["spoofed file rejected", "oversized rejected", "valid png uploaded", "delete"],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

async function postImage(token, input) {
  const formData = new FormData();
  formData.set("listingId", input.listingId);
  formData.set("altText", "validation image");
  formData.set(
    "image",
    new Blob([input.bytes], { type: input.contentType }),
    input.fileName,
  );

  const { response, json } = await fetchJsonWithRetry(`${BASE_URL}/api/market/listing-images`, {
    method: "POST",
    headers: {
      Cookie: `ggitem_session=${token}`,
    },
    body: formData,
  });
  if (response.status !== input.expectedStatus) {
    throw new Error(
      `image upload returned ${response.status}, expected ${input.expectedStatus}: ${JSON.stringify(json)}`,
    );
  }
  return json;
}

async function deleteImage(token, listingId) {
  const { response, json } = await fetchJsonWithRetry(
    `${BASE_URL}/api/market/listing-images?listingId=${encodeURIComponent(listingId)}`,
    {
      method: "DELETE",
      headers: {
        Cookie: `ggitem_session=${token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`image delete failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function fetchJsonWithRetry(url, init) {
  let lastResponse = null;
  let lastJson = {};
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, init);
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const json =
      text && contentType.includes("application/json")
        ? JSON.parse(text)
        : { message: text.slice(0, 500) };
    lastResponse = response;
    lastJson = json;
    if (response.status < 500 || attempt === 3) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  return { response: lastResponse, json: lastJson };
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwT8NwAAAABJRU5ErkJggg==",
    "base64",
  );
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
