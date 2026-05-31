/**
 * Task Cursor server worker — 로컬/운영에서 주기적으로 due job tick을 호출합니다.
 *
 * Usage:
 *   node scripts/run-task-cursor-worker.mjs
 *   node scripts/run-task-cursor-worker.mjs --once
 *
 * Env:
 *   INTERNAL_WORKER_TOKEN or TASK_CURSOR_WORKER_TOKEN
 *   TASK_CURSOR_WORKER_BASE_URL (default http://localhost:3000)
 */

const baseUrl = String(process.env.TASK_CURSOR_WORKER_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = String(process.env.INTERNAL_WORKER_TOKEN ?? process.env.TASK_CURSOR_WORKER_TOKEN ?? "").trim();
const workerId = String(process.env.TASK_CURSOR_WORKER_ID ?? `worker-${process.pid}`).trim();
const intervalMs = Number(process.env.TASK_CURSOR_WORKER_INTERVAL_MS ?? 10_000);
const once = process.argv.includes("--once");

async function tickOnce() {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "x-task-cursor-worker-token": token } : {}),
  };
  const res = await fetch(`${baseUrl}/api/prototype/task-cursor/jobs/tick`, {
    method: "POST",
    headers,
    body: JSON.stringify({ workerId, limit: 1 }),
  });
  const json = await res.json().catch(() => ({}));
  const stamp = new Date().toISOString();
  if (!res.ok) {
    console.error(`[${stamp}] tick failed`, res.status, json);
    return;
  }
  if (json.processed > 0) {
    console.log(`[${stamp}] tick processed=${json.processed}`, JSON.stringify(json.results ?? []));
  } else {
    console.log(`[${stamp}] tick idle`);
  }
}

async function main() {
  if (once) {
    await tickOnce();
    return;
  }
  console.log(`Task Cursor worker started · ${workerId} · ${baseUrl} · every ${intervalMs}ms`);
  for (;;) {
    await tickOnce();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
