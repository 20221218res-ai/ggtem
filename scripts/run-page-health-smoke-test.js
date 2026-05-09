const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = process.env.GGITEM_BASE_URL || "http://localhost:3000";
const PASSWORD = "demo1234";
const REQUEST_TIMEOUT_MS = 15000;

const pages = [
  {
    label: "home",
    path: "/",
    auth: null,
    requiredAny: ["GGtem", "GGitem", "판매 등록", "Đăng bán", "Sell"],
  },
  {
    label: "sell listings",
    path: "/listings?mode=sell&category=GAME_MONEY&game=Lineage%20W",
    auth: null,
    requiredAny: ["Lineage W", "GAME_MONEY", "게임머니", "Tiền game"],
  },
  {
    label: "buy account listings",
    path: "/listings?mode=buy&category=GAME_ACCOUNT&game=Lineage%20W",
    auth: null,
    requiredAny: ["Lineage W", "GAME_ACCOUNT", "계정", "Tài khoản"],
  },
  {
    label: "market sign in",
    path: "/sign-in",
    auth: null,
    requiredAny: ["로그인", "Sign in", "이메일"],
  },
  {
    label: "market wallet",
    path: "/my/wallet",
    auth: "market",
    requiredAny: ["USDT", "충전", "출금", "Deposit", "Withdraw"],
  },
  {
    label: "market my page",
    path: "/my",
    auth: "market",
    requiredAny: ["MY", "지갑", "거래", "Wallet"],
  },
  {
    label: "create sell listing",
    path: "/my/listings/new",
    auth: "market",
    requiredAny: ["판매", "등록", "게임머니", "아이템", "계정"],
  },
  {
    label: "create buy request",
    path: "/my/buy-requests/new",
    auth: "market",
    requiredAny: ["구매", "등록", "게임머니", "아이템", "계정"],
  },
  {
    label: "admin sign in",
    path: "/admin/sign-in",
    auth: null,
    requiredAny: ["관리자", "운영자", "Admin"],
  },
  {
    label: "admin dashboard",
    path: "/admin",
    auth: "admin",
    requiredAny: ["대시보드", "주문", "입금", "출금", "Dashboard"],
  },
  {
    label: "admin deposits",
    path: "/admin/deposits",
    auth: "admin",
    requiredAny: ["입금", "충전", "Deposit"],
  },
  {
    label: "admin withdrawals",
    path: "/admin/withdrawals",
    auth: "admin",
    requiredAny: ["출금", "Withdraw"],
  },
];

const badSignals = [
  "This page couldn't load",
  "This page couldn’t load",
  "Unhandled Runtime Error",
  "Failed to fetch",
  "ERR_CONNECTION",
  "NEXT_NOT_FOUND",
  "Application error",
];

function log(message, data) {
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[page-health] ${message}${suffix}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchWithTimeout(url, options = {}) {
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

function cookieHeaderFrom(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function signIn(email, surface) {
  const response = await fetchWithTimeout(`${BASE_URL}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      surface,
    }),
  });

  const body = await response.text();
  assert(response.ok, `${email} sign-in failed (${response.status}): ${body.slice(0, 300)}`);

  const cookie = cookieHeaderFrom(response);
  assert(cookie, `${email} sign-in did not return a session cookie.`);
  return cookie;
}

function extractStylesheetHrefs(html) {
  return Array.from(html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)).map(
    (match) => match[1],
  );
}

async function verifyStylesheets(html) {
  const hrefs = extractStylesheetHrefs(html);
  assert(hrefs.length > 0, "No stylesheet link was found in rendered HTML.");

  const failures = [];
  for (const href of hrefs) {
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const response = await fetchWithTimeout(url);
    const text = await response.text();

    if (!response.ok || text.length < 100) {
      failures.push({ href, status: response.status, bytes: text.length });
    }
  }

  assert(failures.length === 0, `Stylesheet load failed: ${JSON.stringify(failures)}`);
}

async function fetchPage(page, cookie) {
  const response = await fetchWithTimeout(`${BASE_URL}${page.path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  const html = await response.text();
  return { response, html };
}

async function main() {
  log("sign in demo sessions");
  const marketCookie = await signIn("user-demo@ggitem.local", "market");
  const adminCookie = await signIn("finance-demo@ggitem.local", "admin");
  const results = [];

  for (const page of pages) {
    const cookie = page.auth === "market" ? marketCookie : page.auth === "admin" ? adminCookie : "";
    log("check page", { label: page.label, path: page.path });

    const { response, html } = await fetchPage(page, cookie);
    const signal = badSignals.find((item) => html.includes(item));
    const containsRequired = page.requiredAny.some((item) => html.includes(item));
    const location = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status < 400;

    assert(!isRedirect, `${page.label} unexpectedly redirected to ${location ?? "(missing location)"}`);
    assert(response.ok, `${page.label} failed with HTTP ${response.status}`);
    assert(!signal, `${page.label} contains bad signal: ${signal}`);
    assert(containsRequired, `${page.label} did not contain any expected marker.`);
    await verifyStylesheets(html);

    results.push({
      label: page.label,
      path: page.path,
      status: response.status,
      stylesheetCount: extractStylesheetHrefs(html).length,
      htmlBytes: html.length,
    });
  }

  const outDir = path.join("test-results", `page-health-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));

  log("all page health checks passed", { count: results.length, outDir });
}

main().catch((error) => {
  console.error(`[page-health] failed: ${error.message}`);
  process.exitCode = 1;
});
