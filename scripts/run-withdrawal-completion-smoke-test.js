const fs = require("node:fs");
const { Client } = require("pg");
const { fetchJsonWithRetry } = require("./helpers/http-json");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const SELLER_EMAIL = "seller-flow-test@ggitem.local";
const ADMIN_EMAIL = "finance-demo@ggitem.local";
const PASSWORD = "demo1234";
const WITHDRAWAL_AMOUNT = "20";
const EXPECTED_WITHDRAWAL_FEE = "1";
const WITHDRAWAL_CHAIN = "TRC20";
const WITHDRAWAL_DESTINATION = "TTestWithdrawalCompleteAddress1234567890";
const COMPLETION_TX_ID = `smoke-withdrawal-${Date.now()}`;
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[withdrawal-complete-smoke] ${message}${suffix}`);
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

async function postJson(path, body, cookie) {
  return fetchJsonWithRetry({
    path,
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

async function postJsonAllowFailure(path, body, cookie) {
  return fetchJsonWithRetry({
    path,
    allowFailure: true,
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

async function ageRecentSmokeWithdrawals(client, userId) {
  await client.query(
    `update "WithdrawalRequest"
        set "requestedAt" = now() - interval '2 days'
      where "userId" = $1
        and memo like 'Smoke test withdrawal%'`,
    [userId],
  );
}

async function ensureWithdrawableBalance(client, userId, minimumAmount) {
  await client.query(
    `update "Wallet"
        set "availableBalance" = greatest("availableBalance", $2::numeric),
            "withdrawableBalance" = greatest("withdrawableBalance", $2::numeric),
            "updatedAt" = now()
      where "userId" = $1`,
    [userId, minimumAmount],
  );
}

async function getWithdrawalRequest(client, requestId) {
  const result = await client.query(
    `select id,
            "userId",
            "walletId",
            provider,
            amount::text,
            fee::text,
            "netAmount"::text as "netAmount",
            currency,
            status::text,
            destination,
            memo,
            "completedAt"
       from "WithdrawalRequest"
      where id = $1`,
    [requestId],
  );

  if (!result.rows[0]) {
    throw new Error(`Withdrawal request ${requestId} was not found.`);
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
    let beforeWallet = await getSellerWallet(client);
    if (beforeWallet.role !== "SELLER") {
      throw new Error(`${SELLER_EMAIL} must be a SELLER account for this smoke test.`);
    }

    const expectedTotalDebit = decimal(WITHDRAWAL_AMOUNT) + decimal(EXPECTED_WITHDRAWAL_FEE);

    if (decimal(beforeWallet.withdrawableBalance) < expectedTotalDebit) {
      logStep("top up smoke-test wallet", {
        email: SELLER_EMAIL,
        current: beforeWallet.withdrawableBalance,
        required: expectedTotalDebit,
      });
      await ensureWithdrawableBalance(client, beforeWallet.userId, expectedTotalDebit);
      beforeWallet = await getSellerWallet(client);
    }

    await ageRecentSmokeWithdrawals(client, beforeWallet.userId);

    logStep("sign in seller", { email: SELLER_EMAIL });
    const sellerCookie = await signIn(SELLER_EMAIL, "market");
    logStep("create withdrawal request", {
      amount: WITHDRAWAL_AMOUNT,
      destination: WITHDRAWAL_DESTINATION,
    });
    const createResult = await postJson(
      "/api/market/wallet",
      {
        kind: "WITHDRAWAL",
        amount: WITHDRAWAL_AMOUNT,
        chain: WITHDRAWAL_CHAIN,
        destination: WITHDRAWAL_DESTINATION,
        memo: "Smoke test withdrawal completion request",
      },
      sellerCookie,
    );

    requestId = createResult.json.requestId;
    logStep("created withdrawal request", { requestId });
    const createdRequest = await getWithdrawalRequest(client, requestId);
    const afterCreateWallet = await getSellerWallet(client);

    assertEqual(createdRequest.status, "REQUESTED", "created withdrawal status");
    assertEqual(createdRequest.provider, "MANUAL_CRYPTO", "withdrawal provider");
    assertClose(createdRequest.fee, EXPECTED_WITHDRAWAL_FEE, "withdrawal fee");
    assertClose(createdRequest.netAmount, WITHDRAWAL_AMOUNT, "withdrawal net amount");
    assertClose(
      afterCreateWallet.availableBalance,
      decimal(beforeWallet.availableBalance) - expectedTotalDebit,
      "available balance after withdrawal request",
    );
    assertClose(
      afterCreateWallet.withdrawableBalance,
      decimal(beforeWallet.withdrawableBalance) - expectedTotalDebit,
      "withdrawable balance after withdrawal request",
    );
    assertClose(
      afterCreateWallet.withdrawalLocked,
      decimal(beforeWallet.withdrawalLocked) + expectedTotalDebit,
      "withdrawal locked balance after withdrawal request",
    );

    logStep("sign in finance admin", { email: ADMIN_EMAIL });
    const adminCookie = await signIn(ADMIN_EMAIL, "admin");
    logStep("verify admin finance queue", { requestId });
    const financeState = await getJson("/api/admin/finance", adminCookie);
    const listedInAdminQueue = financeState.pendingWithdrawals.some(
      (request) => request.requestId === requestId,
    );
    if (!listedInAdminQueue) {
      throw new Error("Created withdrawal request was not visible in admin finance queue.");
    }

    logStep("complete withdrawal request", { requestId, txId: COMPLETION_TX_ID });
    const completeResult = await postJson(
      "/api/admin/finance",
      {
        kind: "WITHDRAWAL",
        requestId,
        action: "COMPLETE_WITHDRAWAL",
        adminEvidence: {
          txId: COMPLETION_TX_ID,
          memo: "Smoke test blockchain transfer evidence",
        },
      },
      adminCookie,
    );
    assertEqual(completeResult.json.status, "COMPLETED", "completed withdrawal status");

    logStep("verify completed state", { requestId });
    const completedRequest = await getWithdrawalRequest(client, requestId);
    const afterCompleteWallet = await getSellerWallet(client);
    assertEqual(completedRequest.status, "COMPLETED", "database withdrawal status after completion");
    if (!completedRequest.completedAt) {
      throw new Error("Completed withdrawal request does not have completedAt.");
    }
    if (!String(completedRequest.memo ?? "").includes(COMPLETION_TX_ID)) {
      throw new Error("Completed withdrawal memo does not include TX evidence.");
    }
    assertClose(afterCompleteWallet.availableBalance, afterCreateWallet.availableBalance, "available balance after completion");
    assertClose(afterCompleteWallet.withdrawableBalance, afterCreateWallet.withdrawableBalance, "withdrawable balance after completion");
    assertClose(afterCompleteWallet.withdrawalLocked, beforeWallet.withdrawalLocked, "withdrawal locked balance after completion");

    logStep("verify completed request left pending queue", { requestId });
    const financeStateAfterCompletion = await getJson("/api/admin/finance", adminCookie);
    const stillPending = financeStateAfterCompletion.pendingWithdrawals.some(
      (request) => request.requestId === requestId,
    );
    if (stillPending) {
      throw new Error("Completed withdrawal request is still visible in pending admin queue.");
    }

    logStep("verify seller wallet API", { requestId });
    const walletView = await getJson("/api/market/wallet", sellerCookie);
    const listedInWallet = walletView.withdrawalRequests.some(
      (request) => request.requestId === requestId && request.status === "COMPLETED",
    );
    if (!listedInWallet) {
      throw new Error("Completed withdrawal request was not visible in seller wallet API.");
    }

    logStep("verify audit and ledger", { requestId });
    const auditResult = await client.query(
      `select count(*)::int as count
         from "AdminAuditLog"
        where action = 'WITHDRAWAL_COMPLETED'
          and "targetType" = 'WITHDRAWAL_REQUEST'
          and "targetId" = $1`,
      [requestId],
    );
    if (auditResult.rows[0].count < 1) {
      throw new Error("Withdrawal completion audit log was not created.");
    }

    const ledgerResult = await client.query(
      `select count(*)::int as count
         from "WalletLedgerEntry"
        where type = 'WITHDRAWAL_COMPLETED'
          and "referenceType" = 'WITHDRAWAL_REQUEST'
          and "referenceId" = $1`,
      [requestId],
    );
    if (ledgerResult.rows[0].count < 1) {
      throw new Error("Withdrawal completion ledger entry was not created.");
    }

    logStep("attempt duplicate completion", { requestId });
    const duplicateResult = await postJsonAllowFailure(
      "/api/admin/finance",
      {
        kind: "WITHDRAWAL",
        requestId,
        action: "COMPLETE_WITHDRAWAL",
        adminEvidence: {
          txId: `${COMPLETION_TX_ID}-duplicate`,
          memo: "Smoke test duplicate blockchain transfer evidence",
        },
      },
      adminCookie,
    );
    if (duplicateResult.response.ok) {
      throw new Error("Completed withdrawal request was unexpectedly completed again.");
    }

    const afterDuplicateWallet = await getSellerWallet(client);
    assertClose(afterDuplicateWallet.availableBalance, afterCompleteWallet.availableBalance, "available balance after duplicate completion");
    assertClose(afterDuplicateWallet.withdrawableBalance, afterCompleteWallet.withdrawableBalance, "withdrawable balance after duplicate completion");
    assertClose(afterDuplicateWallet.withdrawalLocked, afterCompleteWallet.withdrawalLocked, "withdrawal locked after duplicate completion");

    console.log(
      JSON.stringify(
        {
          ok: true,
          requestId,
          txId: COMPLETION_TX_ID,
          beforeWallet,
          afterCreateWallet,
          afterCompleteWallet,
          adminQueueVerified: true,
          walletApiVerified: true,
          auditVerified: true,
          ledgerVerified: true,
          duplicateCompletionBlocked: true,
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
