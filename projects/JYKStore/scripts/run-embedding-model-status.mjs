import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "embedding-worker");
const py =
  process.env.E5_PYTHON?.trim() ||
  (process.platform === "win32"
    ? path.join(root, ".venv", "Scripts", "python.exe")
    : path.join(root, ".venv", "bin", "python"));
const fallback = process.platform === "win32" ? "python" : "python3";
const python = spawnSync(py, ["--version"], { encoding: "utf8" }).status === 0 ? py : fallback;

const result = spawnSync(python, ["scripts/status_model.py"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1" },
});
process.exit(result.status ?? 1);
