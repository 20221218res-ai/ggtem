const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { Client } = require("pg");

const ROOT_DIR = path.resolve(__dirname, "..");
const BUYER_EMAIL = "user-demo@ggitem.local";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";

const TESTS = [
  {
    name: "deposit notifications",
    script: "run-deposit-lifecycle-smoke-test.js",
  },
  {
    name: "withdrawal notifications",
    script: "run-withdrawal-lifecycle-smoke-test.js",
  },
  {
    name: "escrow and dispute notifications",
    script: "run-escrow-lifecycle-smoke-test.js",
  },
  {
    name: "chat notifications",
    script: "run-buy-request-chat-notification-smoke-test.js",
  },
];

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[notification-lifecycle] ${message}${suffix}`);
}

function readDatabaseUrl() {
  const envText = fs.readFileSync(path.join(ROOT_DIR, ".env.local"), "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  return match[1];
}

async function main() {
  const before = await readNotificationBaseline();

  logStep("running prerequisite lifecycle tests");
  for (const test of TESTS) {
    runScript(test);
  }

  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const buyer = await readUser(client, BUYER_EMAIL);
    const seller = await readUser(client, SELLER_EMAIL);

    const after = await readNotificationSummary(client, {
      buyerId: buyer.id,
      sellerId: seller.id,
    });
    const summary = subtractNotificationSummary(after, before.summary);
    const createdCount = countNotifications(summary);

    assertAtLeast(summary.seller.WALLET_UPDATE, 8, "wallet notifications");
    assertAtLeast(summary.buyer.ORDER_STATUS, 2, "buyer order status notifications");
    assertAtLeast(summary.seller.ORDER_STATUS, 4, "seller order status notifications");
    assertAtLeast(summary.buyer.DISPUTE_UPDATE, 2, "buyer dispute notifications");
    assertAtLeast(summary.seller.DISPUTE_UPDATE, 3, "seller dispute notifications");
    assertAtLeast(summary.buyer.CHAT_MESSAGE, 1, "buyer chat notifications");
    assertAtLeast(summary.seller.CHAT_MESSAGE, 1, "seller chat notifications");

    await assertNotificationIntegrity(client, {
      userIds: [buyer.id, seller.id],
      limit: createdCount,
    });

    const buyerToken = await createSession(client, buyer.id);
    const apiView = await readNotificationsApi(buyerToken);
    assertAtLeast(apiView.summary.totalCount, 1, "notifications API total count");

    console.log(
      JSON.stringify(
        {
          ok: true,
          checked: TESTS.map((test) => test.name),
          summary,
          totalCreatedNotifications: createdCount,
          api: {
            buyerUnreadCount: apiView.summary.unreadCount,
            buyerTotalCount: apiView.summary.totalCount,
          },
          coverage: [
            "deposit request, approval, and rejection notifications",
            "withdrawal request, rejection, and completion notifications",
            "escrow purchase, seller settlement, cancel, and dispute notifications",
            "buyer and seller chat message notifications",
            "notification href and metadata integrity",
            "my notifications API visibility",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

async function readNotificationBaseline() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  try {
    const buyer = await readOptionalUser(client, BUYER_EMAIL);
    const seller = await readOptionalUser(client, SELLER_EMAIL);
    if (!buyer || !seller) {
      return {
        buyer,
        seller,
        summary: createEmptySummary(),
      };
    }

    return {
      buyer,
      seller,
      summary: await readNotificationSummary(client, {
        buyerId: buyer.id,
        sellerId: seller.id,
      }),
    };
  } finally {
    await client.end();
  }
}

function runScript(test) {
  logStep(`start ${test.name}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, test.script)], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${test.name} failed with exit code ${result.status}`);
  }

  logStep(`passed ${test.name}`);
}

async function readUser(client, email) {
  const result = await client.query(
    `select id, email, "displayName" from "User" where email = $1`,
    [email],
  );
  if (!result.rows[0]) {
    throw new Error(`Missing smoke user ${email}`);
  }

  return result.rows[0];
}

async function readOptionalUser(client, email) {
  const result = await client.query(
    `select id, email, "displayName" from "User" where email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function readNotificationSummary(client, input) {
  const result = await client.query(
    `select "userId", type::text, count(*)::int as count
       from "Notification"
      where "userId" = any($1::text[])
      group by "userId", type`,
    [[input.buyerId, input.sellerId]],
  );

  const summary = createEmptySummary();

  for (const row of result.rows) {
    const owner = row.userId === input.buyerId ? "buyer" : "seller";
    summary[owner][row.type] = row.count;
  }

  return summary;
}

function createEmptySummary() {
  const empty = {
    CHAT_MESSAGE: 0,
    ORDER_STATUS: 0,
    DISPUTE_UPDATE: 0,
    WALLET_UPDATE: 0,
    SYSTEM: 0,
  };
  return {
    buyer: { ...empty },
    seller: { ...empty },
  };
}

function subtractNotificationSummary(after, before) {
  const delta = createEmptySummary();
  for (const owner of ["buyer", "seller"]) {
    for (const type of Object.keys(delta[owner])) {
      delta[owner][type] = Math.max(0, Number(after[owner][type] ?? 0) - Number(before[owner][type] ?? 0));
    }
  }

  return delta;
}

function countNotifications(summary) {
  return Object.values(summary.buyer).reduce((total, count) => total + count, 0) +
    Object.values(summary.seller).reduce((total, count) => total + count, 0);
}

async function assertNotificationIntegrity(client, input) {
  const result = await client.query(
    `select id, "userId", type::text, title, body, href, metadata
       from "Notification"
      where "userId" = any($1::text[])
      order by "createdAt" desc
      limit $2`,
    [input.userIds, Math.max(1, input.limit)],
  );

  if (result.rows.length === 0) {
    throw new Error("No notifications were created during lifecycle tests.");
  }

  for (const notification of result.rows) {
    if (!notification.title?.trim()) {
      throw new Error(`Notification ${notification.id} has empty title.`);
    }
    if (!notification.body?.trim()) {
      throw new Error(`Notification ${notification.id} has empty body.`);
    }
    if (!notification.href?.startsWith("/")) {
      throw new Error(`Notification ${notification.id} has invalid href: ${notification.href}`);
    }

    const metadata = notification.metadata ?? {};
    if (
      notification.type === "WALLET_UPDATE" &&
      (!metadata.requestId || !metadata.kind)
    ) {
      throw new Error(`Wallet notification metadata is incomplete: ${JSON.stringify(notification)}`);
    }
    if (
      (notification.type === "ORDER_STATUS" || notification.type === "DISPUTE_UPDATE") &&
      !metadata.orderId
    ) {
      throw new Error(`Order notification metadata is incomplete: ${JSON.stringify(notification)}`);
    }
    if (
      notification.type === "CHAT_MESSAGE" &&
      (!metadata.orderId || !metadata.roomId)
    ) {
      throw new Error(`Chat notification metadata is incomplete: ${JSON.stringify(notification)}`);
    }
  }
}

async function createSession(client, userId) {
  const token = randomUUID();
  await client.query(
    `insert into "Session" (id, "userId", token, "createdAt", "expiresAt")
     values ($1, $2, $3, now(), now() + interval '1 day')`,
    [`session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, userId, token],
  );
  return token;
}

async function readNotificationsApi(token) {
  const response = await fetch("http://localhost:3000/api/notifications", {
    headers: {
      Cookie: `ggitem_session=${token}`,
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`/api/notifications failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

function assertAtLeast(actual, expected, message) {
  if (Number(actual) < expected) {
    throw new Error(`${message}: expected at least ${expected}, got ${actual}`);
  }
}

main().catch((error) => {
  console.error("[notification-lifecycle] failed");
  console.error(error);
  process.exit(1);
});
