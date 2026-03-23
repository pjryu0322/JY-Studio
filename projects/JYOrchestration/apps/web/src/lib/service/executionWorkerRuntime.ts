import { startExecutionWorker } from "@/lib/service/executionWorker";

const globalRuntimeState = globalThis as typeof globalThis & {
  __jyExecutionWorkerRuntimeStarted?: boolean;
};

function parsePositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function ensureExecutionWorkerStarted(): void {
  if (typeof window !== "undefined") {
    return;
  }
  if (globalRuntimeState.__jyExecutionWorkerRuntimeStarted) {
    return;
  }
  globalRuntimeState.__jyExecutionWorkerRuntimeStarted = true;

  const pollIntervalMs = parsePositiveInt(process.env.EXECUTION_WORKER_POLL_MS, 2000);
  const maxConcurrency = parsePositiveInt(process.env.EXECUTION_WORKER_MAX_CONCURRENCY, 2);
  startExecutionWorker({ pollIntervalMs, maxConcurrency });
}

ensureExecutionWorkerStarted();
