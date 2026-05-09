const { spawnSync } = require("node:child_process");
const path = require("node:path");

const tests = [
  {
    name: "deposit confirmation",
    script: "run-deposit-confirmation-smoke-test.js",
  },
  {
    name: "deposit rejection",
    script: "run-deposit-rejection-smoke-test.js",
  },
];

const results = [];

for (const test of tests) {
  const scriptPath = path.join(__dirname, test.script);
  console.log(`[deposit-lifecycle] start ${test.name}`);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  });

  results.push({
    name: test.name,
    status: result.status,
    signal: result.signal,
  });

  if (result.status !== 0) {
    console.error(`[deposit-lifecycle] failed ${test.name}`);
    break;
  }

  console.log(`[deposit-lifecycle] passed ${test.name}`);
}

const failed = results.find((result) => result.status !== 0);
if (failed) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failed,
        results,
      },
      null,
      2,
    ),
  );
  process.exit(failed.status || 1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: results.map((result) => result.name),
      coverage: [
        "deposit request keeps wallet balance unchanged",
        "pending deposit appears in admin queue",
        "admin confirmation credits available and withdrawable balances",
        "admin rejection does not credit balances",
        "rejected deposit cannot be confirmed later",
        "audit logs and ledger entries are validated",
        "user wallet API exposes final deposit status",
      ],
    },
    null,
    2,
  ),
);
