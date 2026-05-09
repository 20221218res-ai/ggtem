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
const WITHDRAWAL_DESTINATION = "TTestWithdrawalAddress1234567890";
const REQUEST_TIMEOUT_MS = 15000;

function logStep(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[withdrawal-smoke] ${message}${suffix}`);
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

async function signIn(email, surface) {
  const { response, json } = await postJson("/api/auth/sign-in", {
    email,
    password: PASSWORD,
    surface,
  });
  const cookie = cookieHeaderFrom(response);

  if (!cookie) {
    throw new Error(`No session cookie was returned for ${email}.`);
  }

  return { cookie, json };
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
            memo
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

    const requiredForPolicyGuards = expectedTotalDebit * 2;

    if (decimal(beforeWallet.withdrawableBalance) < requiredForPolicyGuards) {
      logStep("top up smoke-test wallet", {
        email: SELLER_EMAIL,
        current: beforeWallet.withdrawableBalance,
        required: requiredForPolicyGuards,
      });
      await ensureWithdrawableBalance(client, beforeWallet.userId, requiredForPolicyGuards);
      beforeWallet = await getSellerWallet(client);
    }

    await ageRecentSmokeWithdrawals(client, beforeWallet.userId);

    logStep("sign in seller", { email: SELLER_EMAIL });
    const { cookie: sellerCookie } = await signIn(SELLER_EMAIL, "market");

    logStep("verify withdrawal minimum amount guard");
    const belowMinimumResult = await postJsonAllowFailure(
      "/api/market/wallet",
      {
        kind: "WITHDRAWAL",
        amount: "19.999999",
        chain: WITHDRAWAL_CHAIN,
        destination: WITHDRAWAL_DESTINATION,
        memo: "Smoke test below minimum withdrawal request",
      },
      sellerCookie,
    );
    if (belowMinimumResult.response.status !== 400) {
      throw new Error(`Below-minimum withdrawal was not blocked: ${belowMinimumResult.response.status}`);
    }
    if (!String(belowMinimumResult.json.message).includes("20 USDT")) {
      throw new Error(`Unexpected below-minimum withdrawal message: ${JSON.stringify(belowMinimumResult.json)}`);
    }
    const afterBelowMinimumWallet = await getSellerWallet(client);
    assertClose(afterBelowMinimumWallet.availableBalance, beforeWallet.availableBalance, "available balance after below-minimum guard");
    assertClose(afterBelowMinimumWallet.withdrawableBalance, beforeWallet.withdrawableBalance, "withdrawable balance after below-minimum guard");
    assertClose(afterBelowMinimumWallet.withdrawalLocked, beforeWallet.withdrawalLocked, "withdrawal locked after below-minimum guard");

    logStep("verify ERC20 withdrawal guard");
    const erc20Result = await postJsonAllowFailure(
      "/api/market/wallet",
      {
        kind: "WITHDRAWAL",
        amount: WITHDRAWAL_AMOUNT,
        chain: "ERC20",
        destination: WITHDRAWAL_DESTINATION,
        memo: "Smoke test ERC20 withdrawal request",
      },
      sellerCookie,
    );
    if (erc20Result.response.status !== 400) {
      throw new Error(`ERC20 withdrawal was not blocked: ${erc20Result.response.status}`);
    }
    if (!String(erc20Result.json.message).includes("ERC20")) {
      throw new Error(`Unexpected ERC20 withdrawal message: ${JSON.stringify(erc20Result.json)}`);
    }
    const afterErc20Wallet = await getSellerWallet(client);
    assertClose(afterErc20Wallet.availableBalance, beforeWallet.availableBalance, "available balance after ERC20 guard");
    assertClose(afterErc20Wallet.withdrawableBalance, beforeWallet.withdrawableBalance, "withdrawable balance after ERC20 guard");
    assertClose(afterErc20Wallet.withdrawalLocked, beforeWallet.withdrawalLocked, "withdrawal locked after ERC20 guard");

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
        memo: "Smoke test withdrawal request",
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
    assertEqual(createdRequest.destination, WITHDRAWAL_DESTINATION, "withdrawal destination");
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

    logStep("verify withdrawal cooldown guard", { requestId });
    const cooldownResult = await postJsonAllowFailure(
      "/api/market/wallet",
      {
        kind: "WITHDRAWAL",
        amount: WITHDRAWAL_AMOUNT,
        chain: WITHDRAWAL_CHAIN,
        destination: `${WITHDRAWAL_DESTINATION}Cooldown`,
        memo: "Smoke test cooldown withdrawal request",
      },
      sellerCookie,
    );
    if (cooldownResult.response.status !== 400) {
      throw new Error(`Cooldown withdrawal was not blocked: ${cooldownResult.response.status}`);
    }
    if (!String(cooldownResult.json.message).includes("4")) {
      throw new Error(`Unexpected cooldown withdrawal message: ${JSON.stringify(cooldownResult.json)}`);
    }
    const afterCooldownWallet = await getSellerWallet(client);
    assertClose(afterCooldownWallet.availableBalance, afterCreateWallet.availableBalance, "available balance after cooldown guard");
    assertClose(afterCooldownWallet.withdrawableBalance, afterCreateWallet.withdrawableBalance, "withdrawable balance after cooldown guard");
    assertClose(afterCooldownWallet.withdrawalLocked, afterCreateWallet.withdrawalLocked, "withdrawal locked after cooldown guard");

    logStep("verify seller wallet API", { requestId });
    const walletView = await getJson("/api/market/wallet", sellerCookie);
    const listedInWallet = walletView.withdrawalRequests.some(
      (request) => request.requestId === requestId && request.status === "REQUESTED",
    );
    if (!listedInWallet) {
      throw new Error("Created withdrawal request was not visible in seller wallet API.");
    }

    logStep("sign in finance admin", { email: ADMIN_EMAIL });
    const { cookie: adminCookie } = await signIn(ADMIN_EMAIL, "admin");
    logStep("verify admin finance queue", { requestId });
    const financeState = await getJson("/api/admin/finance", adminCookie);
    const listedInAdminQueue = financeState.pendingWithdrawals.some(
      (request) => request.requestId === requestId,
    );
    if (!listedInAdminQueue) {
      throw new Error("Created withdrawal request was not visible in admin finance queue.");
    }

    logStep("reject withdrawal request", { requestId });
    const rejectResult = await postJson(
      "/api/admin/finance",
      {
        kind: "WITHDRAWAL",
        requestId,
        action: "REJECT_WITHDRAWAL",
      },
      adminCookie,
    );
    assertEqual(rejectResult.json.status, "REJECTED", "rejected withdrawal status");

    logStep("verify rejection restored balances", { requestId });
    const rejectedRequest = await getWithdrawalRequest(client, requestId);
    const afterRejectWallet = await getSellerWallet(client);
    assertEqual(rejectedRequest.status, "REJECTED", "database withdrawal status after rejection");
    assertClose(afterRejectWallet.availableBalance, beforeWallet.availableBalance, "available balance after rejection");
    assertClose(afterRejectWallet.withdrawableBalance, beforeWallet.withdrawableBalance, "withdrawable balance after rejection");
    assertClose(afterRejectWallet.withdrawalLocked, beforeWallet.withdrawalLocked, "withdrawal locked balance after rejection");

    logStep("verify audit log", { requestId });
    const auditResult = await client.query(
      `select count(*)::int as count
         from "AdminAuditLog"
        where action = 'WITHDRAWAL_REJECTED'
          and "targetType" = 'WITHDRAWAL_REQUEST'
          and "targetId" = $1`,
      [requestId],
    );
    if (auditResult.rows[0].count < 1) {
      throw new Error("Withdrawal rejection audit log was not created.");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          requestId,
          beforeWallet,
          afterCreateWallet,
          afterRejectWallet,
          adminQueueVerified: true,
          auditVerified: true,
          policyGuardsVerified: [
            "minimum withdrawal amount",
            "ERC20 chain blocked",
            "cooldown blocked without balance mutation",
          ],
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
