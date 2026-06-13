import {
  CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
  CODE_TASK_GITHUB_POLL_INTERVAL_MS,
  buildImplementationExecutionUnitGithubPollTimelineEntry,
} from "@/lib/prototype/implementationGithubPollingScheduler";
import { TASK_CURSOR_GITHUB_VERIFY_HARD_TIMEOUT_MS } from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";
import {
  mergeRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const IMPLEMENTATION_CODE_TASK_GITHUB_POLLING_VERSION =
  "implementation_code_task_github_polling_v1" as const;

export type CodeTaskGithubPollingStatusV1 =
  | "scheduled"
  | "waiting"
  | "polling"
  | "branch_missing_retrying"
  | "passed"
  | "failed"
  | "timeout";

export type CodeTaskGithubPollingEntryV1 = Readonly<{
  readonly projectId: string;
  readonly unitId: string;
  readonly codeTaskId: string;
  readonly processTaskId?: string | null;
  readonly targetRepository: string;
  readonly baseBranch?: string | null;
  readonly workBranch: string;
  readonly dispatchedAt: string;
  readonly firstPollAt: string;
  readonly pollIntervalMs: number;
  readonly timeoutAt: string;
  readonly nextPollAt: string;
  readonly lastPolledAt?: string | null;
  readonly attemptCount: number;
  readonly status: CodeTaskGithubPollingStatusV1;
  readonly branchHeadCommit?: string | null;
  readonly githubVerifyStatus?: "passed" | "failed" | null;
  readonly lastErrorCode?: string | null;
  readonly lastErrorMessage?: string | null;
}>;

export type ImplementationCodeTaskGithubPollingStateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_CODE_TASK_GITHUB_POLLING_VERSION;
  readonly projectId: string;
  readonly updatedAt: string;
  readonly byCodeTaskId: Readonly<Record<string, CodeTaskGithubPollingEntryV1>>;
}>;

const TERMINAL_POLLING_STATUSES = new Set<CodeTaskGithubPollingStatusV1>([
  "passed",
  "failed",
  "timeout",
]);

const ACTIVE_POLLING_STATUSES = new Set<CodeTaskGithubPollingStatusV1>([
  "scheduled",
  "waiting",
  "polling",
  "branch_missing_retrying",
]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function parsePollingStatus(raw: unknown): CodeTaskGithubPollingStatusV1 | null {
  const s = readString(raw) as CodeTaskGithubPollingStatusV1;
  const allowed: CodeTaskGithubPollingStatusV1[] = [
    "scheduled",
    "waiting",
    "polling",
    "branch_missing_retrying",
    "passed",
    "failed",
    "timeout",
  ];
  return allowed.includes(s) ? s : null;
}

function parseEntry(raw: unknown): CodeTaskGithubPollingEntryV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const codeTaskId = readString(o.codeTaskId);
  const projectId = readString(o.projectId);
  const unitId = readString(o.unitId);
  const workBranch = readString(o.workBranch);
  const targetRepository = readString(o.targetRepository);
  const dispatchedAt = readString(o.dispatchedAt);
  const firstPollAt = readString(o.firstPollAt);
  const timeoutAt = readString(o.timeoutAt);
  const nextPollAt = readString(o.nextPollAt) || firstPollAt;
  const status = parsePollingStatus(o.status);
  if (!codeTaskId || !projectId || !unitId || !workBranch || !targetRepository || !status) {
    return null;
  }
  if (!dispatchedAt || !firstPollAt || !timeoutAt) return null;
  const pollIntervalMs = Number(o.pollIntervalMs);
  return {
    projectId,
    unitId,
    codeTaskId,
    processTaskId: readString(o.processTaskId) || null,
    targetRepository,
    baseBranch: readString(o.baseBranch) || null,
    workBranch,
    dispatchedAt,
    firstPollAt,
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : CODE_TASK_GITHUB_POLL_INTERVAL_MS,
    timeoutAt,
    nextPollAt,
    lastPolledAt: readString(o.lastPolledAt) || null,
    attemptCount: Math.max(0, Number(o.attemptCount) || 0),
    status,
    branchHeadCommit: readString(o.branchHeadCommit) || null,
    githubVerifyStatus:
      o.githubVerifyStatus === "passed" || o.githubVerifyStatus === "failed"
        ? o.githubVerifyStatus
        : null,
    lastErrorCode: readString(o.lastErrorCode) || null,
    lastErrorMessage: readString(o.lastErrorMessage) || null,
  };
}

export function parseImplementationCodeTaskGithubPollingStateV1(
  raw: unknown,
): ImplementationCodeTaskGithubPollingStateV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_CODE_TASK_GITHUB_POLLING_VERSION) return null;
  const projectId = readString(o.projectId);
  const updatedAt = readString(o.updatedAt);
  if (!projectId || !updatedAt) return null;
  const byCodeTaskId: Record<string, CodeTaskGithubPollingEntryV1> = {};
  const mapRaw = o.byCodeTaskId;
  if (mapRaw && typeof mapRaw === "object") {
    for (const [key, value] of Object.entries(mapRaw as Record<string, unknown>)) {
      const entry = parseEntry(value);
      if (entry) byCodeTaskId[key.trim() || entry.codeTaskId] = entry;
    }
  }
  return { version: IMPLEMENTATION_CODE_TASK_GITHUB_POLLING_VERSION, projectId, updatedAt, byCodeTaskId };
}

export function resolveGithubPollingTimeoutAt(dispatchedAtIso: string): string {
  const t = Date.parse(dispatchedAtIso);
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + TASK_CURSOR_GITHUB_VERIFY_HARD_TIMEOUT_MS).toISOString();
}

export function buildScheduledCodeTaskGithubPollingEntry(input: {
  readonly projectId: string;
  readonly unitId: string;
  readonly codeTaskId: string;
  readonly processTaskId?: string | null;
  readonly targetRepository: string;
  readonly baseBranch?: string | null;
  readonly workBranch: string;
  readonly nowIso?: string;
}): CodeTaskGithubPollingEntryV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const dispatchedMs = Date.parse(nowIso);
  const firstPollAt = new Date(
    (Number.isFinite(dispatchedMs) ? dispatchedMs : Date.now()) + CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
  ).toISOString();
  return {
    projectId: input.projectId.trim(),
    unitId: input.unitId.trim(),
    codeTaskId: input.codeTaskId.trim(),
    processTaskId: input.processTaskId?.trim() || null,
    targetRepository: input.targetRepository.trim(),
    baseBranch: input.baseBranch?.trim() || null,
    workBranch: input.workBranch.trim(),
    dispatchedAt: nowIso,
    firstPollAt,
    pollIntervalMs: CODE_TASK_GITHUB_POLL_INTERVAL_MS,
    timeoutAt: resolveGithubPollingTimeoutAt(nowIso),
    nextPollAt: firstPollAt,
    attemptCount: 0,
    status: "scheduled",
  };
}

export function upsertCodeTaskGithubPollingEntryInState(input: {
  readonly state: RequirementsStateJson;
  readonly entry: CodeTaskGithubPollingEntryV1;
  readonly nowIso?: string;
}): Partial<RequirementsStateJson> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const existing =
    parseImplementationCodeTaskGithubPollingStateV1(input.state.implementationCodeTaskGithubPollingV1) ??
    ({
      version: IMPLEMENTATION_CODE_TASK_GITHUB_POLLING_VERSION,
      projectId: input.entry.projectId,
      updatedAt: nowIso,
      byCodeTaskId: {},
    } satisfies ImplementationCodeTaskGithubPollingStateV1);

  return {
    implementationCodeTaskGithubPollingV1: {
      ...existing,
      projectId: input.entry.projectId,
      updatedAt: nowIso,
      byCodeTaskId: {
        ...existing.byCodeTaskId,
        [input.entry.codeTaskId]: input.entry,
      },
    },
  };
}

export function listActiveCodeTaskGithubPollingEntries(
  state: RequirementsStateJson | null | undefined,
): readonly CodeTaskGithubPollingEntryV1[] {
  const parsed = parseImplementationCodeTaskGithubPollingStateV1(state?.implementationCodeTaskGithubPollingV1);
  if (!parsed) return [];
  return Object.values(parsed.byCodeTaskId).filter((e) => ACTIVE_POLLING_STATUSES.has(e.status));
}

export function hasActiveCodeTaskGithubPollingState(state: RequirementsStateJson | null | undefined): boolean {
  return listActiveCodeTaskGithubPollingEntries(state).length > 0;
}

export function findCodeTaskGithubPollingEntry(
  state: RequirementsStateJson | null | undefined,
  codeTaskId: string,
): CodeTaskGithubPollingEntryV1 | null {
  const parsed = parseImplementationCodeTaskGithubPollingStateV1(state?.implementationCodeTaskGithubPollingV1);
  if (!parsed) return null;
  return parsed.byCodeTaskId[codeTaskId.trim()] ?? null;
}

export function isTerminalCodeTaskGithubPollingStatus(status: CodeTaskGithubPollingStatusV1): boolean {
  return TERMINAL_POLLING_STATUSES.has(status);
}

export function formatCodeTaskGithubPollingBoardLabels(
  entry: CodeTaskGithubPollingEntryV1 | null | undefined,
): Readonly<{ readonly statusLabel: string; readonly progressLabel: string }> | null {
  if (!entry || isTerminalCodeTaskGithubPollingStatus(entry.status)) {
    if (entry?.status === "passed" && entry.githubVerifyStatus === "passed") {
      return { statusLabel: "완료", progressLabel: "GitHub branch head commit 확인됨" };
    }
    if (entry?.status === "timeout") {
      return {
        statusLabel: "검증 실패",
        progressLabel: "GitHub work branch 확인 시간 초과",
      };
    }
    if (entry?.status === "failed") {
      return { statusLabel: "검증 실패", progressLabel: "GitHub 확인 실패" };
    }
    return null;
  }
  switch (entry.status) {
    case "scheduled":
      return { statusLabel: "검증 대기", progressLabel: "GitHub 확인 예약됨" };
    case "waiting":
      return { statusLabel: "검증 대기", progressLabel: "Cursor 작업 반영 대기 중" };
    case "polling":
      return { statusLabel: "검증 중", progressLabel: "GitHub branch/head commit 확인 중" };
    case "branch_missing_retrying":
      return { statusLabel: "검증 중", progressLabel: "GitHub work branch 확인 재시도 중" };
    default:
      return { statusLabel: "검증 중", progressLabel: "GitHub 확인 중" };
  }
}

export function buildGithubPollScheduledTimelineForEntry(
  entry: CodeTaskGithubPollingEntryV1,
  nowIso?: string,
): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionUnitGithubPollTimelineEntry({
    action: "implementation_execution_unit_github_poll_scheduled",
    projectId: entry.projectId,
    unitId: entry.unitId,
    codeTaskId: entry.codeTaskId,
    processTaskId: entry.processTaskId,
    targetRepository: entry.targetRepository,
    baseBranch: entry.baseBranch,
    workBranch: entry.workBranch,
    firstPollDelayMs: CODE_TASK_GITHUB_FIRST_POLL_DELAY_MS,
    pollIntervalMs: entry.pollIntervalMs,
    timeoutAt: entry.timeoutAt,
    nextPollAt: entry.nextPollAt,
    nowIso,
  });
}

export function mergeCodeTaskGithubPollingStatePatch(
  base: RequirementsStateJson,
  patch: Partial<RequirementsStateJson>,
): RequirementsStateJson {
  return mergeRequirementsStateJson(base, patch);
}

export function isCodeTaskGithubPollingBlockingIntegration(
  entry: CodeTaskGithubPollingEntryV1 | null | undefined,
): boolean {
  if (!entry) return false;
  if (entry.status === "passed" && entry.githubVerifyStatus === "passed" && entry.branchHeadCommit) {
    return false;
  }
  if (isTerminalCodeTaskGithubPollingStatus(entry.status)) {
    return entry.githubVerifyStatus !== "passed";
  }
  return true;
}
