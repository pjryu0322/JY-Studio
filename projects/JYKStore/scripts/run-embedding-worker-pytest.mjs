import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "embedding-worker");
const py = process.platform === "win32" ? "python" : "python3";

const result = spawnSync(py, ["-m", "pytest", "-q"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, E5_WORKER_STUB: "true" },
});

process.exit(result.status ?? 1);
