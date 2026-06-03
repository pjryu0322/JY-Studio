/**
 * Next.js dev server + Task Cursor worker (DB poll tick).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "../apps/web");

function spawnProc(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev-with-worker] ${label} stopped (${signal})`);
    } else if (code && code !== 0) {
      console.log(`[dev-with-worker] ${label} exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });
  return child;
}

const nextDev = spawnProc("next", "pnpm", ["exec", "next", "dev"], webDir);

const taskCursorDevWorker = String(process.env.TASK_CURSOR_DEV_WORKER ?? "")
  .trim()
  .toLowerCase();
const startTaskCursorWorker =
  taskCursorDevWorker === "1" ||
  taskCursorDevWorker === "true" ||
  taskCursorDevWorker === "yes";

if (startTaskCursorWorker) {
  setTimeout(() => {
    spawnProc("worker", "node", ["scripts/run-task-cursor-worker.mjs"], webDir);
  }, 3000);
} else {
  console.log(
    "[dev-with-worker] Task Cursor tick worker는 기본 비활성입니다. 필요 시 TASK_CURSOR_DEV_WORKER=1 pnpm dev 또는 pnpm dev:worker",
  );
}

process.on("SIGINT", () => {
  nextDev.kill("SIGINT");
  process.exit(0);
});
