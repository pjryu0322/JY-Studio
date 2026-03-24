import { startExecutionWorker } from "@/lib/service/executionWorker";

const globalRuntimeState = globalThis as typeof globalThis & {
  __jyExecutionWorkerRuntimeStarted?: boolean;
};

function parsePositiveInt(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function isExecutionWorkerEnabled(): boolean {
  const v = process.env.EXECUTION_WORKER_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return true;
}

export function ensureExecutionWorkerStarted(): void {
  if (typeof window !== "undefined") {
    return;
  }
  if (globalRuntimeState.__jyExecutionWorkerRuntimeStarted) {
    return;
  }
  globalRuntimeState.__jyExecutionWorkerRuntimeStarted = true;

  if (!isExecutionWorkerEnabled()) {
    console.info(
      "[jy-orchestration] Execution worker auto-start disabled (EXECUTION_WORKER_ENABLED=false). UI/API는 동작합니다."
    );
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "\n[jy-orchestration] DATABASE_URL이 설정되지 않아 실행 워커를 시작하지 않습니다.\n" +
        "  → apps/web/.env.example 을 참고해 apps/web/.env.local 에 DATABASE_URL 을 넣으세요.\n" +
        "  → DB 준비 후: cd apps/web && npx prisma migrate deploy (또는 개발용 db push)\n"
    );
    return;
  }

  const pollIntervalMs = parsePositiveInt(process.env.EXECUTION_WORKER_POLL_MS, 2000);
  const pollIdleMs = parsePositiveInt(process.env.EXECUTION_WORKER_POLL_IDLE_MS, 4500);
  const maxConcurrency = parsePositiveInt(process.env.EXECUTION_WORKER_MAX_CONCURRENCY, 2);
  startExecutionWorker({ pollIntervalMs, pollIdleMs, maxConcurrency });
}

ensureExecutionWorkerStarted();
