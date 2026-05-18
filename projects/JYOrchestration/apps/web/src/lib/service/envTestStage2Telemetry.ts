import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { prisma } from "@/lib/prisma";

/** TaskExecutionRun.validationOutput JSON 최상위 키 (meta 와 분리) */
export const ENV_TEST_STAGE2_TIMING_KEY = "envTestStage2Timing" as const;

export type Stage2TelemetryStage = "EXECUTOR" | "CURSOR" | "BRANCH" | "PR" | "REVIEWER" | "SECURITY" | "SCM" | "MERGE" | "MERGE_VERIFY";

export type EnvTestStage2TimingRecord = {
  executionId: string;
  pipelineStartedAtMs?: number;
  pipelineFinishedAtMs?: number;
  executorTimeMs?: number;
  cursorTimeMs?: number;
  cursorPrepareTimeMs?: number;
  cursorGenerateTimeMs?: number;
  cursorCommitTimeMs?: number;
  cursorPushTimeMs?: number;
  branchDetectTimeMs?: number;
  prCreationTimeMs?: number;
  reviewTimeMs?: number;
  securityTimeMs?: number;
  scmTimeMs?: number;
  /** merge API + verify 전체(내부 분리 없이 한 번에 측정) */
  mergeTimeMs?: number;
  mergeVerifyTimeMs?: number;
  totalTimeMs?: number;
  events?: Array<{
    event: string;
    stage: Stage2TelemetryStage | string;
    executionId: string;
    startTime: string;
    endTime: string;
    elapsedMs: number;
    result?: string;
  }>;
  breakdown?: Record<string, number>;
  topBottleneck?: { stage: string; ms: number } | null;
};

/** validationOutput JSON에서 타이밍 레코드만 읽기(파이프라인 시작 ms 등) */
export function readEnvTestStage2TimingRecord(
  validationOutput: string | null | undefined
): EnvTestStage2TimingRecord | null {
  try {
    const j = JSON.parse(String(validationOutput ?? "")) as Record<string, unknown>;
    const t = j[ENV_TEST_STAGE2_TIMING_KEY] as EnvTestStage2TimingRecord | undefined;
    if (!t || typeof t !== "object") return null;
    return t;
  } catch {
    return null;
  }
}

export function parseEnvTestStage2TimingFromValidationOutput(validationOutput: string | null | undefined): {
  totalTimeMs: number | null;
  topBottleneck: { stage: string; ms: number } | null;
  breakdown: Record<string, number> | null;
} {
  const empty: {
    totalTimeMs: number | null;
    topBottleneck: { stage: string; ms: number } | null;
    breakdown: Record<string, number> | null;
  } = { totalTimeMs: null, topBottleneck: null, breakdown: null };
  try {
    const j = JSON.parse(String(validationOutput ?? "")) as Record<string, unknown>;
    const t = j[ENV_TEST_STAGE2_TIMING_KEY] as EnvTestStage2TimingRecord | undefined;
    if (!t) return empty;
    const fin = recomputeStage2TimingBreakdown(t);
    return {
      totalTimeMs: typeof fin.totalTimeMs === "number" ? fin.totalTimeMs : null,
      topBottleneck: fin.topBottleneck ?? null,
      breakdown: fin.breakdown ?? null,
    };
  } catch {
    return empty;
  }
}

const BD_KEYS = [
  "executor",
  "cursor",
  "cursorPrepare",
  "cursorGenerate",
  "cursorCommit",
  "cursorPush",
  "branchDetect",
  "prCreation",
  "review",
  "security",
  "scm",
  "merge",
  "mergeVerify",
] as const;

export function mergeEnvTestStage2TimingOutput(
  prev: string | null | undefined,
  patch: Partial<EnvTestStage2TimingRecord>
): string {
  let base: Record<string, unknown> = {};
  try {
    if (prev?.trim()) base = JSON.parse(prev) as Record<string, unknown>;
  } catch {
    base = {};
  }
  const cur = (base[ENV_TEST_STAGE2_TIMING_KEY] as Record<string, unknown> | undefined) ?? {};
  const next = { ...cur, ...patch } as Record<string, unknown>;
  base[ENV_TEST_STAGE2_TIMING_KEY] = next;
  return JSON.stringify(base).slice(0, 24_000);
}

export function recomputeStage2TimingBreakdown(t: EnvTestStage2TimingRecord): EnvTestStage2TimingRecord {
  const cursorPrepare = t.cursorPrepareTimeMs ?? 0;
  const cursorGenerate = t.cursorGenerateTimeMs ?? 0;
  const cursorCommit = t.cursorCommitTimeMs ?? 0;
  const cursorPush = t.cursorPushTimeMs ?? 0;
  const cursorTotal = t.cursorTimeMs ?? cursorPrepare + cursorGenerate + cursorCommit + cursorPush;
  const breakdown: Record<string, number> = {
    executor: t.executorTimeMs ?? 0,
    cursor: cursorTotal,
    cursorPrepare,
    cursorGenerate,
    cursorCommit,
    cursorPush,
    branchDetect: t.branchDetectTimeMs ?? 0,
    prCreation: t.prCreationTimeMs ?? 0,
    review: t.reviewTimeMs ?? 0,
    security: t.securityTimeMs ?? 0,
    scm: t.scmTimeMs ?? 0,
    merge: t.mergeTimeMs ?? 0,
    mergeVerify: t.mergeVerifyTimeMs ?? 0,
  };
  let top: { stage: string; ms: number } | null = null;
  for (const k of BD_KEYS) {
    const ms = breakdown[k] ?? 0;
    if (!top || ms > top.ms) top = { stage: k, ms };
  }
  const sum = BD_KEYS.reduce((acc, k) => acc + (breakdown[k] ?? 0), 0);
  return {
    ...t,
    breakdown,
    topBottleneck: top && top.ms > 0 ? top : null,
    totalTimeMs: sum > 0 ? sum : t.totalTimeMs,
  };
}

export function logStage2TelemetryEvent(input: {
  executionId: string;
  stage: Stage2TelemetryStage | string;
  event: string;
  startTime: string;
  endTime: string;
  elapsedMs: number;
  result?: string;
  projectId: string;
  taskId: string;
  userId?: string | null;
}): void {
  appendTaskProgressLog({
    kind: "execution",
    phase: `env_test_stage2_${input.event.toLowerCase()}`,
    projectId: input.projectId,
    taskId: input.taskId,
    userId: input.userId ?? undefined,
    detail: {
      executionId: input.executionId,
      stage: input.stage,
      event: input.event,
      startTime: input.startTime,
      endTime: input.endTime,
      elapsedMs: input.elapsedMs,
      result: input.result,
    },
  });
}

export function appendStage2EventToTiming(
  timing: EnvTestStage2TimingRecord,
  ev: NonNullable<EnvTestStage2TimingRecord["events"]>[number]
): EnvTestStage2TimingRecord {
  const events = [...(timing.events ?? []), ev].slice(-80);
  return { ...timing, events };
}

/** DB의 validationOutput JSON에 timing patch 병합 후 저장 */
export async function patchTaskExecutionRunStage2Timing(execRunId: string, patch: Partial<EnvTestStage2TimingRecord>): Promise<void> {
  const row = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { validationOutput: true },
  });
  const merged = mergeEnvTestStage2TimingOutput(row?.validationOutput ?? null, patch);
  const parsed = JSON.parse(merged) as Record<string, unknown>;
  const rawT = parsed[ENV_TEST_STAGE2_TIMING_KEY] as EnvTestStage2TimingRecord | undefined;
  const finalized = rawT ? recomputeStage2TimingBreakdown(rawT) : undefined;
  if (finalized) parsed[ENV_TEST_STAGE2_TIMING_KEY] = finalized;
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: { validationOutput: JSON.stringify(parsed).slice(0, 24_000) },
  });
}
