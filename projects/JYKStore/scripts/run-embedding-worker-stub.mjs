import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "embedding-worker");
const py = process.platform === "win32" ? "python" : "python3";

const child = spawn(
  py,
  ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8010"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, E5_WORKER_STUB: "true" },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
