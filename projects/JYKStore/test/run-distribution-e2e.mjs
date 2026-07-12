#!/usr/bin/env node
/**
 * Bring up dedicated Postgres+MinIO, migrate, run Distribution E2E, tear down.
 * Cross-platform (Windows/macOS/Linux) — no shell env syntax required.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(root, "test", "docker-compose.distribution-e2e.yml");

const e2eEnv = {
  ...process.env,
  JYKSTORE_RUN_DISTRIBUTION_E2E: "1",
  DATABASE_URL:
    process.env.DATABASE_URL?.trim() ||
    "postgresql://jykstore:jykstore@127.0.0.1:55432/jykstore_distribution_e2e?schema=public",
  JYKSTORE_PAYLOAD_STORAGE_DRIVER: "s3",
  JYKSTORE_PAYLOAD_S3_ENDPOINT:
    process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim() || "http://127.0.0.1:59000",
  JYKSTORE_PAYLOAD_S3_REGION: process.env.JYKSTORE_PAYLOAD_S3_REGION?.trim() || "ap-northeast-2",
  JYKSTORE_PAYLOAD_S3_BUCKET:
    process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim() || "jykstore-payloads-e2e",
  JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID:
    process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim() || "jykstoreminio",
  JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY:
    process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim() || "jykstoreminio123",
  JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE: "true",
  JYKSTORE_PAYLOAD_S3_SERVER_SIDE_ENCRYPTION: "",
  JYKSTORE_ANONYMOUS_ID_SECRET:
    process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim() || "e2e-only-secret",
  JYKSTORE_TRUST_PROXY: "true",
};

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
  let up = false;
  try {
    await run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
    up = true;
    await run("npx", ["prisma", "migrate", "deploy"], { env: e2eEnv });
    await run(
      "node",
      ["--import", "tsx", "--test", "src/__tests__/distribution-minio-e2e.test.ts"],
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
