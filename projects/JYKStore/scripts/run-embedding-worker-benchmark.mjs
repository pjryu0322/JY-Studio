import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Live CPU benchmark: loads the real model (requires E5_WORKER_STUB=false + revision).
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "embedding-worker");
const py = process.platform === "win32" ? "python" : "python3";

const env = {
  ...process.env,
  E5_WORKER_ENV: process.env.E5_WORKER_ENV ?? "development",
  E5_WORKER_STUB: process.env.E5_WORKER_STUB ?? "false",
};

const child = spawn(py, ["benchmark/run_benchmark.py"], { cwd: root, stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
