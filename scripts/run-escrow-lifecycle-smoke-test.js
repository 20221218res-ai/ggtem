const { spawn } = require("node:child_process");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

const TESTS = [
  {
    name: "escrow completion",
    script: "run-escrow-order-completion-smoke-test.js",
  },
  {
    name: "escrow cancel refund",
    script: "run-escrow-order-cancel-refund-smoke-test.js",
  },
  {
    name: "admin dispute resolution",
    script: "run-dispute-resolution-smoke-test.js",
  },
];

async function main() {
  console.log("[escrow-lifecycle] starting escrow lifecycle smoke tests");

  for (const test of TESTS) {
    await runNodeScript(test);
  }

  console.log("[escrow-lifecycle] all escrow lifecycle smoke tests passed");
}

function runNodeScript(test) {
  return new Promise((resolve, reject) => {
    console.log(`[escrow-lifecycle] running ${test.name}`);

    const child = spawn(process.execPath, [path.join(ROOT_DIR, "scripts", test.script)], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`[escrow-lifecycle] passed ${test.name}`);
        resolve();
        return;
      }

      reject(new Error(`${test.name} failed with exit code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error("[escrow-lifecycle] failed");
  console.error(error);
  process.exit(1);
});
