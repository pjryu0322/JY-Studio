#!/usr/bin/env node
/**
 * Bring up dedicated Postgres+MinIO, migrate, run Public Download E2E, tear down.
 * Reuses distribution-e2e docker-compose and assertSafeE2ETargets.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDistributionE2EEnv } from "./distribution-e2e-safety.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "test", "docker-compose.distribution-e2e.yml");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: options.env || process.env,
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function main() {
  const allowExternal = process.env.JYKSTORE_ALLOW_EXTERNAL_DISTRIBUTION_E2E === "1";
  const e2eEnv = {
    ...buildDistributionE2EEnv(process.env),
    JYKSTORE_RUN_PUBLIC_DOWNLOAD_E2E: "1",
  };
  let up = false;

  try {
    if (!allowExternal) {
      await run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
      up = true;
    }
    await run("npx", ["prisma", "migrate", "deploy"], { env: e2eEnv });
    await run(
      "node",
      ["--import", "tsx", "--test", "src/__tests__/public-download-minio-e2e.test.ts"],
      { env: e2eEnv },
    );
  } finally {
    if (up) {
      await run("docker", ["compose", "-f", composeFile, "down", "-v"]).catch((error) => {
        console.error("teardown failed:", error);
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
