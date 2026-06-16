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

const nextDev = spawnProc("next", "pnpm", ["run", "dev"], webDir);

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
    "[dev-with-worker] Task Cursor poll은 Next 서버 내장 scheduler(instrumentation)가 기본 처리합니다. 외부 worker는 pnpm dev:worker (선택).",
  );
}

process.on("SIGINT", () => {
  nextDev.kill("SIGINT");
  process.exit(0);
});
