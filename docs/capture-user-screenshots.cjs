const { chromium } = require("playwright");
const path = require("path");

const outDir = path.join(__dirname, "assets", "business-plan-ui");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.route("**/api/user/priority-notification**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notification: null }),
    }),
  );

  await page.goto("http://localhost:3000/sign-in", { waitUntil: "networkidle" });
  await page.locator("input").nth(0).fill("user-demo@ggitem.local");
  await page.locator("input").nth(1).fill("demo1234");
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);

  const routes = [
    ["/my/wallet", "wallet.png"],
    ["/my/wallet/ledger", "wallet-ledger.png"],
    ["/my/orders", "my-orders.png"],
  ];

  for (const [route, fileName] of routes) {
    await page.goto(`http://localhost:3000${route}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    const modalCloseButton = page.locator(".fixed.inset-0 button").first();
    if (await modalCloseButton.count()) {
      await page.mouse.click(900, 365).catch(() => {});
      await page.waitForTimeout(600);
    }
    const text = await page.locator("body").innerText().catch(() => "");
    console.log(`${route}: ${text.slice(0, 120).replace(/\s+/g, " ")}`);
    await page.screenshot({
      path: path.join(outDir, fileName),
      fullPage: false,
    });
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
