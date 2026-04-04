/**
 * Stage 2 실행 세분화 모니터 — validationOutput.stage2RuntimeMonitor 에 저장.
 * 실행 로직은 변경하지 않고 관측·표시만 담당한다.
 */

import { prisma } from "@/lib/prisma";

export const ENV_TEST_STAGE2_RUNTIME_MONITOR_KEY = "stage2RuntimeMonitor" as const;

export type Stage2UiPhaseStatus = "PENDING" | "RUNNING" | "DONE";

export type Stage2CursorSignal = {
  agentLaunchedAtMs?: number;
  pushStartedAtMs?: number;
  pushCompletedHintAtMs?: number;
  branchNameHint?: string;
  headShaHint?: string;
  commitHashHint?: string;
  changedFilesCountHint?: number;
};

export type Stage2RuntimeMonitorV1 = {
  version: 1;
  updatedAtMs: number;
  /** 가장 구체적인 현재 단계 키 */
  currentPhase: string;
  phases: Record<
    string,
    { status: Stage2UiPhaseStatus; startedAtMs?: number; endedAtMs?: number }
  >;
  cursorStatus: {
    prepare: Stage2UiPhaseStatus;
    generate: Stage2UiPhaseStatus;
    commit: Stage2UiPhaseStatus;
    push: Stage2UiPhaseStatus;
  };
  gitStatus: {
    branchDetected: boolean;
    branchReflected: boolean;
  };
  platformStatus: {
    prCreated: boolean;
  };
  cursorSignal?: Stage2CursorSignal;
  /** RUNNING 중 가장 오래 걸린 단계 (병목 추정) */
  bottleneckPhase: string | null;
  bottleneckElapsedMs: number | null;
};

const PHASE_ORDER = [
  "executor",
  "cursor_prepare",
  "cursor_generate",
  "cursor_commit",
  "cursor_push",
  "git_branch_detect",
  "git_branch_reflected",
  "platform_pr_create",
  "review",
  "security",
  "scm",
] as const;

export function createInitialStage2RuntimeMonitor(nowMs: number = Date.now()): Stage2RuntimeMonitorV1 {
  const phases: Stage2RuntimeMonitorV1["phases"] = {};
  for (const p of PHASE_ORDER) {
    phases[p] = { status: "PENDING" };
  }
  return {
    version: 1,
    updatedAtMs: nowMs,
    currentPhase: "executor",
    phases,
    cursorStatus: {
      prepare: "PENDING",
      generate: "PENDING",
      commit: "PENDING",
      push: "PENDING",
    },
    gitStatus: { branchDetected: false, branchReflected: false },
    platformStatus: { prCreated: false },
    cursorSignal: {},
    bottleneckPhase: null,
    bottleneckElapsedMs: null,
  };
}

function startPhase(m: Stage2RuntimeMonitorV1, phase: string, nowMs: number): void {
  const cur = m.phases[phase] ?? { status: "PENDING" as const };
  if (cur.status === "DONE") return;
  m.phases[phase] = {
    status: "RUNNING",
    startedAtMs: cur.startedAtMs ?? nowMs,
    endedAtMs: undefined,
  };
}

function finishPhase(m: Stage2RuntimeMonitorV1, phase: string, nowMs: number): void {
  const cur = m.phases[phase] ?? { status: "PENDING" as const };
  const started = cur.startedAtMs ?? nowMs;
  m.phases[phase] = {
    status: "DONE",
    startedAtMs: started,
    endedAtMs: nowMs,
  };
}

/** Git 감지·반영이 진행 중이면 Cursor 측 단계는 병목 경쟁에서 제외(실제 대기는 Git 쪽). */
const CURSOR_WORK_PHASES = new Set(["cursor_prepare", "cursor_generate", "cursor_commit", "cursor_push"]);

function recomputeBottleneck(m: Stage2RuntimeMonitorV1, nowMs: number): void {
  const gitActive =
    m.phases.git_branch_detect?.status === "RUNNING" ||
    m.phases.git_branch_reflected?.status === "RUNNING";

  let maxMs = 0;
  let maxPhase: string | null = null;
  for (const [p, v] of Object.entries(m.phases)) {
    if (v.status !== "RUNNING" || v.startedAtMs == null) continue;
    if (gitActive && CURSOR_WORK_PHASES.has(p)) continue;
    const elapsed = nowMs - v.startedAtMs;
    if (elapsed > maxMs) {
      maxMs = elapsed;
      maxPhase = p;
    }
  }
  m.bottleneckPhase = maxPhase;
  m.bottleneckElapsedMs = maxPhase ? maxMs : null;
}

function deriveCurrentPhase(m: Stage2RuntimeMonitorV1): string {
  // 병목 phase가 아직 RUNNING이면 current = 병목(다중 RUNNING 시 Git vs Cursor 구분)
  if (m.bottleneckPhase && m.phases[m.bottleneckPhase]?.status === "RUNNING") {
    return m.bottleneckPhase;
  }
  for (const p of PHASE_ORDER) {
    const st = m.phases[p]?.status;
    if (st === "RUNNING") return p;
  }
  for (const p of PHASE_ORDER) {
    if (m.phases[p]?.status === "PENDING") return p;
  }
  return "scm";
}

function syncCursorAggregate(m: Stage2RuntimeMonitorV1): void {
  m.cursorStatus.prepare = phaseToCursorSlot(m, "cursor_prepare");
  m.cursorStatus.generate = phaseToCursorSlot(m, "cursor_generate");
  m.cursorStatus.commit = phaseToCursorSlot(m, "cursor_commit");
  m.cursorStatus.push = phaseToCursorSlot(m, "cursor_push");
}

function phaseToCursorSlot(m: Stage2RuntimeMonitorV1, key: string): Stage2UiPhaseStatus {
  const st = m.phases[key]?.status;
  if (st === "DONE") return "DONE";
  if (st === "RUNNING") return "RUNNING";
  return "PENDING";
}

export function finalizeStage2RuntimeMonitor(m: Stage2RuntimeMonitorV1, nowMs: number = Date.now()): Stage2RuntimeMonitorV1 {
  m.updatedAtMs = nowMs;
  syncCursorAggregate(m);
  recomputeBottleneck(m, nowMs);
  m.currentPhase = deriveCurrentPhase(m);
  return m;
}

/** API/UI용 phase 키 (사용자 명명: pr_create) */
export function stage2PhaseKeyForApi(phase: string | null | undefined): string {
  const p = String(phase ?? "").trim();
  if (p === "platform_pr_create") return "pr_create";
  return p;
}

export function parseStage2RuntimeMonitorFromValidationOutput(validationOutput: string | null | undefined): Stage2RuntimeMonitorV1 | null {
  try {
    const j = JSON.parse(String(validationOutput ?? "")) as Record<string, unknown>;
    const raw = j[ENV_TEST_STAGE2_RUNTIME_MONITOR_KEY] as Stage2RuntimeMonitorV1 | undefined;
    if (!raw || raw.version !== 1) return null;
    return finalizeStage2RuntimeMonitor({ ...raw }, Date.now());
  } catch {
    return null;
  }
}

export function mergeStage2RuntimeMonitorIntoValidationOutput(
  prev: string | null | undefined,
  monitor: Stage2RuntimeMonitorV1
): string {
  let base: Record<string, unknown> = {};
  try {
    if (prev?.trim()) base = JSON.parse(prev) as Record<string, unknown>;
  } catch {
    base = {};
  }
  base[ENV_TEST_STAGE2_RUNTIME_MONITOR_KEY] = monitor;
  return JSON.stringify(base).slice(0, 24_000);
}

export async function patchTaskExecutionRunStage2RuntimeMonitor(
  execRunId: string,
  updater: (prev: Stage2RuntimeMonitorV1) => Stage2RuntimeMonitorV1
): Promise<Stage2RuntimeMonitorV1> {
  const row = await prisma.taskExecutionRun.findUnique({
    where: { id: execRunId },
    select: { validationOutput: true },
  });
  const prev = row?.validationOutput ?? null;
  const prevMon = parseStage2RuntimeMonitorFromValidationOutput(prev);
  const baseMon = prevMon ?? createInitialStage2RuntimeMonitor();
  const next = finalizeStage2RuntimeMonitor(updater(baseMon), Date.now());
  const out = mergeStage2RuntimeMonitorIntoValidationOutput(prev, next);
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: { validationOutput: out },
  });
  return next;
}

/** executor 단계 */
export function monitorExecutorStart(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  startPhase(m, "executor", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorExecutorDone(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  finishPhase(m, "executor", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorCursorPrepareStart(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  startPhase(m, "cursor_prepare", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorCursorPrepareDone(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  finishPhase(m, "cursor_prepare", nowMs);
  startPhase(m, "cursor_generate", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

/** 에이전트 폴링: 생성/커밋 휴리스틱 (cursor_push 는 터미널 직후 별도 처리) */
export function monitorApplyCursorAgentHeuristics(
  m: Stage2RuntimeMonitorV1,
  input: {
    agentStatusUpper: string;
    hasCommitHash: boolean;
    hasChangedFiles: boolean;
    isTerminalSuccess: boolean;
  },
  nowMs: number
): Stage2RuntimeMonitorV1 {
  const st = input.agentStatusUpper;
  const runningLike =
    st === "RUNNING" || st === "CREATING" || st === "QUEUED" || st === "PENDING" || st === "THINKING" || st === "WORKING";

  if (m.phases.cursor_prepare.status === "DONE" && m.phases.cursor_generate.status === "PENDING" && runningLike) {
    startPhase(m, "cursor_generate", nowMs);
  }

  if (m.phases.cursor_generate.status === "RUNNING") {
    if (input.hasCommitHash || input.hasChangedFiles) {
      finishPhase(m, "cursor_generate", nowMs);
      if (m.phases.cursor_commit.status === "PENDING") startPhase(m, "cursor_commit", nowMs);
    }
  }

  if (m.phases.cursor_commit.status === "RUNNING" && input.hasCommitHash && !input.isTerminalSuccess) {
    /* 커밋 해시 유지 */
  }

  if (input.isTerminalSuccess) {
    if (m.phases.cursor_generate.status === "RUNNING") finishPhase(m, "cursor_generate", nowMs);
    if (m.phases.cursor_commit.status === "PENDING" && (input.hasCommitHash || input.hasChangedFiles)) {
      startPhase(m, "cursor_commit", nowMs);
    }
    if (m.phases.cursor_commit.status === "RUNNING") finishPhase(m, "cursor_commit", nowMs);
    if (m.phases.cursor_push.status === "PENDING") startPhase(m, "cursor_push", nowMs);
  }

  if (m.phases.cursor_push.status === "RUNNING" && !m.cursorSignal?.pushStartedAtMs) {
    m.cursorSignal = { ...(m.cursorSignal ?? {}), pushStartedAtMs: nowMs };
  }

  return finalizeStage2RuntimeMonitor(m, nowMs);
}

/** 첫 GitHub 브랜치 체크(게이트 통과) 직전: Cursor push 구간 종료 → Git 감지 구간 시작 */
export function monitorFirstGitBranchCheck(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  if (m.phases.cursor_push.status === "RUNNING") finishPhase(m, "cursor_push", nowMs);
  if (m.phases.git_branch_detect.status === "PENDING") startPhase(m, "git_branch_detect", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorGitBranchDetected(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  m.gitStatus.branchDetected = true;
  if (!m.cursorSignal?.pushCompletedHintAtMs) {
    m.cursorSignal = { ...(m.cursorSignal ?? {}), pushCompletedHintAtMs: nowMs };
  }
  if (m.phases.git_branch_detect.status === "RUNNING") finishPhase(m, "git_branch_detect", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorGitBranchReflected(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  m.gitStatus.branchReflected = true;
  if (m.phases.git_branch_reflected.status === "PENDING") startPhase(m, "git_branch_reflected", nowMs);
  finishPhase(m, "git_branch_reflected", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorPlatformPrStart(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  startPhase(m, "platform_pr_create", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorPlatformPrDone(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  m.platformStatus.prCreated = true;
  finishPhase(m, "platform_pr_create", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorReviewStart(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  startPhase(m, "review", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorReviewDone(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  finishPhase(m, "review", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorSecurityStart(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  startPhase(m, "security", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorSecurityDone(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  finishPhase(m, "security", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorScmStart(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  startPhase(m, "scm", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorScmDone(m: Stage2RuntimeMonitorV1, nowMs: number): Stage2RuntimeMonitorV1 {
  finishPhase(m, "scm", nowMs);
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function monitorCursorSignalPatch(
  m: Stage2RuntimeMonitorV1,
  patch: Partial<Stage2CursorSignal>,
  nowMs: number
): Stage2RuntimeMonitorV1 {
  const next = { ...(m.cursorSignal ?? {}) };
  if (typeof patch.agentLaunchedAtMs === "number") next.agentLaunchedAtMs = patch.agentLaunchedAtMs;
  if (typeof patch.pushStartedAtMs === "number") next.pushStartedAtMs = patch.pushStartedAtMs;
  if (typeof patch.pushCompletedHintAtMs === "number") next.pushCompletedHintAtMs = patch.pushCompletedHintAtMs;
  if (typeof patch.branchNameHint === "string" && patch.branchNameHint.trim()) {
    next.branchNameHint = patch.branchNameHint.trim();
  }
  if (typeof patch.headShaHint === "string" && patch.headShaHint.trim()) {
    next.headShaHint = patch.headShaHint.trim();
  }
  if (typeof patch.commitHashHint === "string" && patch.commitHashHint.trim()) {
    next.commitHashHint = patch.commitHashHint.trim();
  }
  if (typeof patch.changedFilesCountHint === "number" && Number.isFinite(patch.changedFilesCountHint)) {
    next.changedFilesCountHint = Math.max(0, Math.floor(patch.changedFilesCountHint));
  }
  m.cursorSignal = next;
  return finalizeStage2RuntimeMonitor(m, nowMs);
}

export function bottleneckLabelKo(phase: string | null | undefined): string | null {
  const p = String(phase ?? "").trim();
  if (!p) return null;
  const map: Record<string, string> = {
    executor: "Executor",
    cursor_prepare: "Cursor 준비",
    cursor_generate: "Cursor 코드 생성",
    cursor_commit: "Cursor 커밋",
    cursor_push: "Cursor push",
    git_branch_detect: "Git 브랜치 반영 대기",
    git_branch_reflected: "Git 반영(compare)",
    platform_pr_create: "플랫폼 PR 생성",
    pr_create: "플랫폼 PR 생성",
    review: "리뷰",
    security: "보안",
    scm: "SCM",
  };
  return map[p] ?? p;
}
