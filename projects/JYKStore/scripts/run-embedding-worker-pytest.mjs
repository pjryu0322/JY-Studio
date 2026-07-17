import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Usage: node scripts/run-embedding-worker-pytest.mjs [stub|live]
const mode = (process.argv[2] ?? "stub").toLowerCase();
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "embedding-worker");
const py = process.platform === "win32" ? "python" : "python3";

const env = { ...process.env, E5_WORKER_ENV: process.env.E5_WORKER_ENV ?? (mode === "live" ? "development" : "test") };
if (mode === "live") {
  env.E5_WORKER_STUB = "false";
} else {
  env.E5_WORKER_STUB = "true";
}

const args = mode === "live" ? ["-m", "pytest", "-q", "tests/test_live_smoke.py"] : ["-m", "pytest", "-q"];
const result = spawnSync(py, args, { cwd: root, stdio: "inherit", env });
process.exit(result.status ?? 1);
