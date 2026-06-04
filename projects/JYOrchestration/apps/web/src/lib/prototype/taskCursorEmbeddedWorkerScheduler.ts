import { runTaskCursorWorkerTick } from "@/lib/prototype/taskCursorWorkerService";
import { buildTaskCursorWorkerSchedulerTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";

const DEFAULT_INTERVAL_MS = 8_000;
const globalKey = "__jy_task_cursor_embedded_worker__";

type EmbeddedWorkerState = {
  interval: ReturnType<typeof setInterval> | null;
  started: boolean;
  workerId: string;
};

function readGlobalState(): EmbeddedWorkerState | undefined {
  return (globalThis as Record<string, unknown>)[globalKey] as EmbeddedWorkerState | undefined;
}

function writeGlobalState(state: EmbeddedWorkerState): void {
  (globalThis as Record<string, unknown>)[globalKey] = state;
}

export function resolveTaskCursorEmbeddedWorkerEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const raw = String(env.TASK_CURSOR_EMBEDDED_WORKER ?? env.NEXT_PUBLIC_TASK_CURSOR_EMBEDDED_WORKER ?? "")
    .trim()
    .toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return true;
}

export function resolveTaskCursorEmbeddedWorkerIntervalMs(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): number {
  const n = Number(env.TASK_CURSOR_EMBEDDED_WORKER_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  return Number.isFinite(n) && n >= 3_000 ? n : DEFAULT_INTERVAL_MS;
}

/** Next.js dev hot reload 중복 등록 방지 singleton scheduler */
export function ensureTaskCursorEmbeddedWorkerStarted(): void {
  if (typeof setInterval !== "function") return;
  if (!resolveTaskCursorEmbeddedWorkerEnabled()) return;

  const existing = readGlobalState();
  if (existing?.started) return;

  const workerId = `embedded-${process.pid}`;
  const state: EmbeddedWorkerState = { interval: null, started: true, workerId };
  writeGlobalState(state);

  const tick = () => {
    void runTaskCursorWorkerTick({ workerId, limit: 2 }).catch((error) => {
      console.warn(
        "[task-cursor-embedded-worker]",
        error instanceof Error ? error.message : String(error),
      );
    });
  };

  state.interval = setInterval(tick, resolveTaskCursorEmbeddedWorkerIntervalMs());
  if (typeof state.interval.unref === "function") {
    state.interval.unref();
  }

  console.log(
    `[task-cursor-embedded-worker] started · ${workerId} · every ${resolveTaskCursorEmbeddedWorkerIntervalMs()}ms`,
  );
  tick();
}

/** Cursor job 생성 직후 1회 tick (fire-and-forget) */
export function scheduleTaskCursorPollSoon(input?: {
  readonly projectId?: string | null;
  readonly delayMs?: number;
}): void {
  if (!resolveTaskCursorEmbeddedWorkerEnabled()) return;
  const workerId = readGlobalState()?.workerId ?? `embedded-${process.pid}`;
  const delayMs = Math.max(0, input?.delayMs ?? 500);
  const projectId = input?.projectId?.trim() || null;

  setTimeout(() => {
    void runTaskCursorWorkerTick({ workerId, limit: 1, projectId }).catch(() => {
      // embedded one-shot; periodic scheduler will retry
    });
  }, delayMs).unref?.();
}

export function buildTaskCursorWorkerTickScheduledTimeline(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly jobId?: string | null;
  readonly nowIso?: string;
}) {
  return buildTaskCursorWorkerSchedulerTimelineEntry({
    action: "task_cursor_worker_tick_scheduled",
    projectId: input.projectId,
    taskId: input.taskId,
    jobId: input.jobId ?? null,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
}
