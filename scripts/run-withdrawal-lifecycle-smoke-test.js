const { spawnSync } = require("node:child_process");
const path = require("node:path");

const tests = [
  {
    name: "withdrawal policy and rejection",
    script: "run-withdrawal-flow-smoke-test.js",
  },
  {
    name: "withdrawal completion",
    script: "run-withdrawal-completion-smoke-test.js",
  },
];

const results = [];

for (const test of tests) {
  const scriptPath = path.join(__dirname, test.script);
  console.log(`[withdrawal-lifecycle] start ${test.name}`);

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
    console.error(`[withdrawal-lifecycle] failed ${test.name}`);
    break;
  }

  console.log(`[withdrawal-lifecycle] passed ${test.name}`);
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
        "minimum withdrawal amount is blocked",
        "ERC20 withdrawals are blocked",
        "withdrawal request debits available and withdrawable balances",
        "withdrawal request moves amount plus fee into withdrawalLocked",
        "cooldown blocks repeated withdrawals without balance mutation",
        "admin rejection restores balances and clears withdrawalLocked",
        "admin completion clears withdrawalLocked without refunding",
        "completed withdrawal cannot be completed again",
        "admin queue, user wallet API, audit logs, and ledger entries are validated",
      ],
    },
    null,
    2,
  ),
);
