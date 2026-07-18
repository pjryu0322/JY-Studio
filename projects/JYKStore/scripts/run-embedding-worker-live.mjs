import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "embedding-worker");
const preferred =
  process.env.E5_PYTHON?.trim() ||
  (process.platform === "win32"
    ? path.join(root, ".venv", "Scripts", "python.exe")
    : path.join(root, ".venv", "bin", "python"));
const fallback = process.platform === "win32" ? "python" : "python3";
const python =
  spawnSync(preferred, ["--version"], { encoding: "utf8" }).status === 0 ? preferred : fallback;

const host = process.env.E5_WORKER_HOST || "127.0.0.1";
const port = process.env.E5_WORKER_PORT || "8000";

const env = {
  ...process.env,
  E5_WORKER_STUB: "false",
  E5_MODEL_OFFLINE: process.env.E5_MODEL_OFFLINE || "true",
  HF_HUB_OFFLINE: "1",
  TRANSFORMERS_OFFLINE: "1",
  HF_DATASETS_OFFLINE: "1",
};

const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", host, "--port", String(port)],
  { cwd: root, stdio: "inherit", env },
);

child.on("exit", (code) => process.exit(code ?? 0));
