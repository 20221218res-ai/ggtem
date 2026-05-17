const { chromium } = require("playwright");
const path = require("path");

const outDir = path.join(__dirname, "assets", "business-plan-ui");

async function unlockAdminGate(page) {
  const hiddenButton = page.locator('button[aria-label="hidden access control"]');
  if (await hiddenButton.count()) {
    for (let i = 0; i < 5; i += 1) {
      await hiddenButton.click({ position: { x: 10, y: 10 } });
    }
  }
}

async function signIn(page, email, password) {
  await page.goto("http://admin.localhost:3000/admin/sign-in", {
    waitUntil: "networkidle",
  });
  await unlockAdminGate(page);
  await page.locator("input").nth(0).fill(email);
  await page.locator("input").nth(1).fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
}

async function capture(page, route, fileName) {
  await page.goto(`http://admin.localhost:3000${route}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3500);
  const text = await page.locator("body").innerText().catch(() => "");
  console.log(`${route}: ${text.slice(0, 120).replace(/\s+/g, " ")}`);
  await page.screenshot({
    path: path.join(outDir, fileName),
    fullPage: false,
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  await signIn(page, "finance-demo@ggitem.local", "demo1234");

  await capture(page, "/admin", "admin.png");
  await capture(page, "/admin/deposits", "admin-deposits.png");
  await capture(page, "/admin/withdrawals", "admin-withdrawals.png");
  await capture(page, "/admin/finance", "admin-finance.png");
  await capture(page, "/admin/finance/ledger", "admin-ledger.png");
  await capture(page, "/admin/disputes", "admin-disputes.png");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
