#!/usr/bin/env node
/**
 * Local MinIO sidecar for `npm run dev`.
 * - Starts .local/minio.exe (or falls back paths) with .env credentials
 * - Ensures the jykstore bucket exists
 * - Stays in foreground so concurrently -k tears it down with web/worker
 */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".local", "minio-data");
const endpoint = "http://127.0.0.1:9000";
const apiPort = 9000;
const consolePort = 9001;

function loadDotEnvDefaults() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const fileEnv = loadDotEnvDefaults();
const accessKeyId =
  process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim() ||
  fileEnv.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID ||
  "jykstorelocal";
const secretAccessKey =
  process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim() ||
  fileEnv.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY ||
  "jykstorelocal";
const bucket =
  process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim() ||
  fileEnv.JYKSTORE_PAYLOAD_S3_BUCKET ||
  "jykstore";

function resolveMinioBinary() {
  const candidates = [
    process.env.JYKSTORE_MINIO_BIN?.trim(),
    join(root, ".local", "minio.exe"),
    join(root, ".local", "minio"),
    "C:\\Tools\\minio\\minio.exe",
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "MinIO binary not found. Place minio.exe at .local/minio.exe (or set JYKSTORE_MINIO_BIN).",
  );
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await portOpen(port)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for MinIO on port ${port}`);
}

async function ensureBucket() {
  const client = new S3Client({
    endpoint,
    region:
      process.env.JYKSTORE_PAYLOAD_S3_REGION?.trim() ||
      fileEnv.JYKSTORE_PAYLOAD_S3_REGION ||
      "ap-northeast-2",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`[minio] bucket ready: ${bucket}`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[minio] bucket created: ${bucket}`);
  }
}

function killExistingMinioOnWindows() {
  if (process.platform !== "win32") return;
  try {
    // Best-effort: free :9000 for this project's MinIO sidecar.
    spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        [
          `$conns = Get-NetTCPConnection -LocalPort ${apiPort} -State Listen -ErrorAction SilentlyContinue;`,
          `foreach ($c in $conns) {`,
          `  $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue;`,
          `  if ($p -and $p.ProcessName -match 'minio') { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }`,
          `}`,
        ].join(" "),
      ],
      { stdio: "ignore", windowsHide: true },
    );
  } catch {
    // ignore
  }
}

async function waitForPortClosed(port, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await portOpen(port))) return;
    await delay(200);
  }
}

let child = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (child && !child.killed) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // ignore
    }
  }
  // Give the child a moment, then exit.
  setTimeout(() => process.exit(code), 300).unref?.();
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => shutdown(0));
}
process.on("exit", () => {
  if (child && !child.killed && process.platform !== "win32") {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
});

async function main() {
  const bin = resolveMinioBinary();
  mkdirSync(dataDir, { recursive: true });

  if (await portOpen(apiPort)) {
    console.log(`[minio] port ${apiPort} busy — stopping existing minio listener if present`);
    killExistingMinioOnWindows();
    await waitForPortClosed(apiPort);
    if (await portOpen(apiPort)) {
      throw new Error(
        `Port ${apiPort} is still in use. Free it, then re-run npm run dev.`,
      );
    }
  }

  console.log(`[minio] starting ${bin}`);
  console.log(`[minio] data=${dataDir} api=:${apiPort} console=:${consolePort}`);

  child = spawn(
    bin,
    ["server", dataDir, "--address", `:${apiPort}`, "--console-address", `:${consolePort}`],
    {
      cwd: root,
      env: {
        ...process.env,
        MINIO_ROOT_USER: accessKeyId,
        MINIO_ROOT_PASSWORD: secretAccessKey,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  child.stdout?.on("data", (buf) => process.stdout.write(`[minio] ${buf}`));
  child.stderr?.on("data", (buf) => process.stderr.write(`[minio] ${buf}`));
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[minio] exited code=${code} signal=${signal ?? ""}`);
    process.exit(code ?? 1);
  });

  await waitForPort(apiPort);
  await ensureBucket();
  console.log(`[minio] ready at ${endpoint} (console http://127.0.0.1:${consolePort})`);

  // Stay alive while MinIO child runs.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("[minio]", error instanceof Error ? error.message : error);
  shutdown(1);
});
