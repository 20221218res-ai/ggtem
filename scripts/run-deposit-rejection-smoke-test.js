const fs = require("node:fs");
const { Client } = require("pg");
const { fetchJsonWithRetry } = require("./helpers/http-json");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const ADMIN_EMAIL = "finance-demo@ggitem.local";
const PASSWORD = "demo1234";
const DEPOSIT_AMOUNT = "0.02";
const DEPOSIT_MEMO = `Smoke test deposit rejection ${Date.now()}`;
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[deposit-reject-smoke] ${message}${suffix}`);
}

function readDatabaseUrl() {
  const envText = fs.readFileSync(".env.local", "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  return match[1];
}

function cookieHeaderFrom(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${url} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(path, body, cookie, options = {}) {
  return fetchJsonWithRetry({
    path,
    allowFailure: options.allowFailure,
    fetcher: () =>
      fetchWithTimeout(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
  });
}

async function getJson(path, cookie) {
  const { json } = await fetchJsonWithRetry({
    path,
    fetcher: () =>
      fetchWithTimeout(`${BASE_URL}${path}`, {
        headers: cookie ? { Cookie: cookie } : {},
      }),
  });

  return json;
}

async function signIn(email, surface) {
  const { response } = await postJson("/api/auth/sign-in", {
    email,
    password: PASSWORD,
    surface,
  });
  const cookie = cookieHeaderFrom(response);

  if (!cookie) {
    throw new Error(`No session cookie was returned for ${email}.`);
  }

  return cookie;
}

async function getSellerWallet(client) {
  const result = await client.query(
    `select u.id as "userId",
            u.email,
            u.role::text,
            w.id as "walletId",
            w."availableBalance"::text as "availableBalance",
            w."withdrawableBalance"::text as "withdrawableBalance",
            w."withdrawalLocked"::text as "withdrawalLocked"
       from "User" u
       join "Wallet" w on w."userId" = u.id
      where u.email = $1`,
    [SELLER_EMAIL],
  );

  if (!result.rows[0]) {
    throw new Error(`${SELLER_EMAIL} was not found.`);
  }

  return result.rows[0];
}

async function getDepositRequest(client, requestId) {
  const result = await client.query(
    `select id,
            "userId",
            "walletId",
            provider,
            amount::text,
            currency,
            status::text,
            memo,
            "confirmedAt"
       from "DepositRequest"
      where id = $1`,
    [requestId],
  );

  if (!result.rows[0]) {
    throw new Error(`Deposit request ${requestId} was not found.`);
  }

  return result.rows[0];
}

function decimal(value) {
  return Number(value);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, message) {
  if (Math.abs(decimal(actual) - decimal(expected)) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  let requestId = null;
  logStep("connect database");
  await client.connect();

  try {
    logStep("read seller wallet");
    const beforeWallet = await getSellerWallet(client);
    if (beforeWallet.role !== "SELLER") {
      throw new Error(`${SELLER_EMAIL} must be a SELLER account for this smoke test.`);
    }

    logStep("sign in seller", { email: SELLER_EMAIL });
    const sellerCookie = await signIn(SELLER_EMAIL, "market");
    logStep("create deposit request", { amount: DEPOSIT_AMOUNT });
    const createResult = await postJson(
      "/api/market/wallet",
      {
        kind: "DEPOSIT",
        amount: DEPOSIT_AMOUNT,
        provider: "MANUAL_CRYPTO",
        memo: DEPOSIT_MEMO,
      },
      sellerCookie,
    );

    requestId = createResult.json.requestId;
    logStep("created deposit request", { requestId });
    const createdRequest = await getDepositRequest(client, requestId);
    const afterCreateWallet = await getSellerWallet(client);

    assertEqual(createdRequest.status, "PENDING", "created deposit status");
    assertClose(afterCreateWallet.availableBalance, beforeWallet.availableBalance, "available balance after deposit request");
    assertClose(afterCreateWallet.withdrawableBalance, beforeWallet.withdrawableBalance, "withdrawable balance after deposit request");

    logStep("sign in finance admin", { email: ADMIN_EMAIL });
    const adminCookie = await signIn(ADMIN_EMAIL, "admin");
    logStep("verify admin finance queue", { requestId });
    const financeState = await getJson("/api/admin/finance", adminCookie);
    const listedInAdminQueue = financeState.pendingDeposits.some(
      (request) => request.requestId === requestId,
    );
    if (!listedInAdminQueue) {
      throw new Error("Created deposit request was not visible in admin finance queue.");
    }

    logStep("reject deposit request", { requestId });
    const rejectResult = await postJson(
      "/api/admin/finance",
      {
        kind: "DEPOSIT",
        requestId,
        action: "REJECT_DEPOSIT",
      },
      adminCookie,
    );
    assertEqual(rejectResult.json.status, "REJECTED", "rejected deposit status");

    logStep("verify rejected state", { requestId });
    const rejectedRequest = await getDepositRequest(client, requestId);
    const afterRejectWallet = await getSellerWallet(client);
    assertEqual(rejectedRequest.status, "REJECTED", "database deposit status after rejection");
    assertClose(afterRejectWallet.availableBalance, beforeWallet.availableBalance, "available balance after rejection");
    assertClose(afterRejectWallet.withdrawableBalance, beforeWallet.withdrawableBalance, "withdrawable balance after rejection");

    logStep("attempt duplicate confirmation", { requestId });
    const duplicateResult = await postJson(
      "/api/admin/finance",
      {
        kind: "DEPOSIT",
        requestId,
        action: "CONFIRM_DEPOSIT",
      },
      adminCookie,
      { allowFailure: true },
    );
    if (duplicateResult.response.ok) {
      throw new Error("Rejected deposit request was unexpectedly confirmed on duplicate attempt.");
    }

    const afterDuplicateWallet = await getSellerWallet(client);
    assertClose(afterDuplicateWallet.availableBalance, beforeWallet.availableBalance, "available balance after duplicate attempt");
    assertClose(afterDuplicateWallet.withdrawableBalance, beforeWallet.withdrawableBalance, "withdrawable balance after duplicate attempt");

    logStep("verify rejected request left pending queue", { requestId });
    const financeStateAfterRejection = await getJson("/api/admin/finance", adminCookie);
    const stillPending = financeStateAfterRejection.pendingDeposits.some(
      (request) => request.requestId === requestId,
    );
    if (stillPending) {
      throw new Error("Rejected deposit request is still visible in pending admin queue.");
    }

    logStep("verify seller wallet API", { requestId });
    const walletView = await getJson("/api/market/wallet", sellerCookie);
    const listedInWallet = walletView.depositRequests.some(
      (request) => request.requestId === requestId && request.status === "REJECTED",
    );
    if (!listedInWallet) {
      throw new Error("Rejected deposit request was not visible in seller wallet API.");
    }

    logStep("verify audit and no approval ledger", { requestId });
    const auditResult = await client.query(
      `select count(*)::int as count
         from "AdminAuditLog"
        where action = 'DEPOSIT_REJECTED'
          and "targetType" = 'DEPOSIT_REQUEST'
          and "targetId" = $1`,
      [requestId],
    );
    if (auditResult.rows[0].count < 1) {
      throw new Error("Deposit rejection audit log was not created.");
    }

    const ledgerResult = await client.query(
      `select count(*)::int as count
         from "WalletLedgerEntry"
        where type = 'ADMIN_DEPOSIT_APPROVED'
          and "referenceType" = 'DEPOSIT_REQUEST'
          and "referenceId" = $1`,
      [requestId],
    );
    if (ledgerResult.rows[0].count !== 0) {
      throw new Error("Rejected deposit request created approval ledger entries.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          requestId,
          beforeWallet,
          afterCreateWallet,
          afterRejectWallet,
          duplicateStatus: duplicateResult.response.status,
          adminQueueVerified: true,
          walletApiVerified: true,
          auditVerified: true,
          noApprovalLedgerVerified: true,
        },
        null,
        2,
      ),
    );
  } finally {
    if (requestId) {
      logStep("last request id", { requestId });
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
