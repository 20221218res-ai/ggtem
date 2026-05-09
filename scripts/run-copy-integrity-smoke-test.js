const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const checkedFiles = [
  "src/app/page.tsx",
  "src/app/my/wallet/page.tsx",
  "src/app/my/wallet/wallet-actions.tsx",
  "src/app/listings/page.tsx",
  "src/app/listings/[listingId]/page.tsx",
  "src/app/my/chat/page.tsx",
];

const brokenSignals = [
  "\uFFFD",
  "?쒖",
  "異",
  "愿",
  "諛",
  "痍",
  "理",
  "듬땲",
  "덈떎",
  "쒖텧",
  "쟾",
];

const failures = [];

for (const relativeFile of checkedFiles) {
  const filePath = path.join(rootDir, relativeFile);
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativeFile}: file is missing`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const signal of brokenSignals) {
      if (line.includes(signal)) {
        failures.push(`${relativeFile}:${index + 1}: suspicious copy marker "${signal}"`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error("Copy integrity smoke test failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Copy integrity smoke test passed. Checked ${checkedFiles.length} user-facing files.`);
