import { startAiActionWorker } from "@/lib/service/aiActionWorker";

const globalRuntimeState = globalThis as typeof globalThis & {
  __jyAiActionWorkerRuntimeStarted?: boolean;
};

function parsePositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function isAiActionWorkerEnabled(): boolean {
  const v = process.env.AI_ACTION_WORKER_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function ensureAiActionWorkerStarted(): void {
  if (typeof window !== "undefined") {
    return;
  }
  if (globalRuntimeState.__jyAiActionWorkerRuntimeStarted) {
    return;
  }
  globalRuntimeState.__jyAiActionWorkerRuntimeStarted = true;

  if (!isAiActionWorkerEnabled()) {
    console.info(
      "[jy-orchestration] AI action worker not started (set AI_ACTION_WORKER_ENABLED=true to enable)."
    );
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.info("[jy-orchestration] AI action worker skipped (no DATABASE_URL).");
    return;
  }

  const pollIntervalMs = parsePositiveInt(process.env.AI_ACTION_WORKER_POLL_MS, 3500);
  const pollIdleMs = parsePositiveInt(process.env.AI_ACTION_WORKER_POLL_IDLE_MS, 6000);
  startAiActionWorker({ pollIntervalMs, pollIdleMs });
}

ensureAiActionWorkerStarted();
