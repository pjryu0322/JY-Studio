import {
  applyExecutionStateItemPatches,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { PrototypeRunStatus } from "@/lib/prototype/prototypeRunTypes";

export type ImplementationPrototypeRunSyncSnapshot = Readonly<{
  readonly hasRun: boolean;
  readonly runStatus?: string;
  readonly hasWorkUnits: boolean;
  readonly prOpened: boolean;
  readonly merged: boolean;
  readonly previewReady: boolean;
  readonly previewUrl?: string;
  readonly runId?: string;
  readonly summaryLines: readonly string[];
}>;

const RUN_STATUS_ORDER: readonly PrototypeRunStatus[] = [
  "DRAFT",
  "PROMPT_READY",
  "PLANNER_ANALYZING",
  "WORK_UNITS_READY",
  "CURSOR_REQUESTED",
  "CURSOR_RUNNING",
  "COMMIT_DETECTED",
  "PUSH_CONFIRMED",
  "AI_REVIEWING",
  "REWORK_REQUIRED",
  "PR_OPENED",
  "MERGED",
  "DEPLOY_CONFIGURING",
  "DEPLOYING",
  "PREVIEW_READY",
  "DEPLOY_FAILED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "FAILED",
  "BLOCKED",
];

const WORK_UNIT_PR_STATUSES = new Set(["PR_OPENED", "MERGED"]);
const WORK_UNIT_MERGED_STATUSES = new Set(["MERGED"]);

function runStatusIndex(status: string): number {
  const i = RUN_STATUS_ORDER.indexOf(status as PrototypeRunStatus);
  return i >= 0 ? i : -1;
}

function runStatusAtLeast(current: string, target: PrototypeRunStatus): boolean {
  if (current === "FAILED" || current === "BLOCKED") return false;
  if (current === "DEPLOY_FAILED") return runStatusIndex(target) <= runStatusIndex("MERGED");
  const cur = runStatusIndex(current);
  const tgt = runStatusIndex(target);
  if (cur < 0 || tgt < 0) return false;
  return cur >= tgt;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  const s = String(value ?? "").trim();
  return s || undefined;
}

function readWorkUnits(input: {
  readonly latestRun: Record<string, unknown> | null;
  readonly workUnits?: readonly unknown[] | null;
}): readonly unknown[] {
  if (input.workUnits?.length) return input.workUnits;
  const fromRun = input.latestRun?.workUnits;
  return Array.isArray(fromRun) ? fromRun : [];
}

function workUnitHasStatus(workUnits: readonly unknown[], statuses: ReadonlySet<string>): boolean {
  for (const row of workUnits) {
    const r = readRecord(row);
    const status = readString(r?.status);
    if (status && statuses.has(status)) return true;
  }
  return false;
}

function resolvePreviewUrl(run: Record<string, unknown> | null): string | undefined {
  return (
    readString(run?.previewUrl) ??
    readString(run?.publicUrl) ??
    readString(run?.resultUrl) ??
    readString(run?.suggestedPreviewUrl)
  );
}

export function deriveImplementationPrototypeRunSyncSnapshot(input: {
  readonly latestRun: unknown;
  readonly workUnits?: readonly unknown[] | null;
}): ImplementationPrototypeRunSyncSnapshot {
  const run = readRecord(input.latestRun);
  const runId = readString(run?.id);
  const runStatus = readString(run?.status);
  const workUnits = readWorkUnits({ latestRun: run, workUnits: input.workUnits });
  const hasRun = Boolean(runId);
  const hasWorkUnits = workUnits.length > 0;
  const previewUrl = resolvePreviewUrl(run);

  const prOpened =
    (runStatus != null && runStatusAtLeast(runStatus, "PR_OPENED")) ||
    Boolean(run?.prNumber) ||
    Boolean(readString(run?.prUrl)) ||
    workUnitHasStatus(workUnits, WORK_UNIT_PR_STATUSES);

  const merged =
    (runStatus != null && runStatusAtLeast(runStatus, "MERGED")) ||
    Boolean(readString(run?.mergeSha)) ||
    workUnitHasStatus(workUnits, WORK_UNIT_MERGED_STATUSES);

  const previewReady = Boolean(previewUrl) || runStatus === "PREVIEW_READY";

  const summaryLines: string[] = [];
  if (hasRun && runStatus) summaryLines.push(`Prototype Run: ${runStatus}`);
  if (prOpened) summaryLines.push("PR: opened");
  if (merged) summaryLines.push("PR: merged");
  if (previewReady) {
    summaryLines.push("Preview: ready");
    if (previewUrl) summaryLines.push(`Preview URL: ${previewUrl}`);
  }

  return {
    hasRun,
    ...(runStatus ? { runStatus } : {}),
    hasWorkUnits,
    prOpened,
    merged,
    previewReady,
    ...(previewUrl ? { previewUrl } : {}),
    ...(runId ? { runId } : {}),
    summaryLines,
  };
}

export function isImplementationTaskExecutionStateEqual(
  a: ImplementationTaskExecutionStateV1 | null | undefined,
  b: ImplementationTaskExecutionStateV1 | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.items.length !== b.items.length) return false;
  for (let i = 0; i < a.items.length; i += 1) {
    const left = a.items[i];
    const right = b.items[i];
    if (!left || !right) return false;
    if (
      left.taskId !== right.taskId ||
      left.ownerRole !== right.ownerRole ||
      left.status !== right.status ||
      left.resultSummary !== right.resultSummary ||
      left.errorMessage !== right.errorMessage ||
      left.prototypeRunId !== right.prototypeRunId
    ) {
      return false;
    }
  }
  return true;
}

export function syncImplementationTaskExecutionFromPrototypeRun(input: {
  readonly state: ImplementationTaskExecutionStateV1 | null | undefined;
  readonly snapshot: ImplementationPrototypeRunSyncSnapshot;
  readonly nowIso?: string;
}): ImplementationTaskExecutionStateV1 | null {
  if (!input.state) return null;
  if (!input.snapshot.hasRun) return input.state;

  const now = input.nowIso ?? new Date().toISOString();
  const runId = input.snapshot.runId;

  if (input.snapshot.previewReady) {
    return applyExecutionStateItemPatches(
      input.state,
      (item) => {
        if (item.status === "failed" || item.status === "skipped" || item.status === "done") {
          return null;
        }
        if (item.ownerRole === "scm") {
          return {
            status: "done",
            resultSummary: "프로토타입 preview ready — SCM 반영 완료",
            ...(runId ? { prototypeRunId: runId } : {}),
          };
        }
        if (
          (item.ownerRole === "reviewer" || item.ownerRole === "security") &&
          (item.status === "ready" || item.status === "queued")
        ) {
          return {
            status: "done",
            resultSummary: "프로토타입 preview ready 전 점검 통과로 간주",
            ...(runId ? { prototypeRunId: runId } : {}),
          };
        }
        return null;
      },
      now,
    );
  }

  if (input.snapshot.prOpened || input.snapshot.merged) {
    return applyExecutionStateItemPatches(
      input.state,
      (item) => {
        if (item.ownerRole !== "scm") return null;
        if (item.status !== "ready" && item.status !== "queued") return null;
        const summary = input.snapshot.merged
          ? "Prototype Run PR merge — SCM 반영 진행 중"
          : "Prototype Run PR opened — SCM 반영 진행 중";
        return {
          status: "in_progress",
          resultSummary: summary,
          ...(runId ? { prototypeRunId: runId } : {}),
        };
      },
      now,
    );
  }

  return input.state;
}

export function isImplementationPrototypeComplete(input: {
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly prototypeSnapshot?: ImplementationPrototypeRunSyncSnapshot | null;
}): boolean {
  const snapshot = input.prototypeSnapshot;
  if (!snapshot?.previewReady) return false;

  const state = input.executionState;
  if (!state?.items.length) return false;

  const developerFailed = state.items.some(
    (item) => item.ownerRole === "developer" && item.status === "failed",
  );
  if (developerFailed) return false;

  const scmTasks = state.items.filter((item) => item.ownerRole === "scm");
  if (scmTasks.length > 0 && !scmTasks.every((item) => item.status === "done")) {
    return false;
  }

  const reviewerFailed = state.items.some(
    (item) => item.ownerRole === "reviewer" && item.status === "failed",
  );
  const securityFailed = state.items.some(
    (item) => item.ownerRole === "security" && item.status === "failed",
  );
  if (reviewerFailed || securityFailed) return false;

  const reviewerTasks = state.items.filter((item) => item.ownerRole === "reviewer");
  const securityTasks = state.items.filter((item) => item.ownerRole === "security");
  if (
    reviewerTasks.length > 0 &&
    !reviewerTasks.every((item) => item.status === "done" || item.status === "skipped")
  ) {
    return false;
  }
  if (
    securityTasks.length > 0 &&
    !securityTasks.every((item) => item.status === "done" || item.status === "skipped")
  ) {
    return false;
  }

  return true;
}

export function buildPrototypeRunExecutionSyncPatch(input: {
  readonly currentState: ImplementationTaskExecutionStateV1 | null | undefined;
  readonly latestRun: unknown;
  readonly workUnits?: readonly unknown[] | null;
  readonly nowIso?: string;
}): Readonly<{
  readonly snapshot: ImplementationPrototypeRunSyncSnapshot;
  readonly nextState: ImplementationTaskExecutionStateV1 | null;
  readonly changed: boolean;
}> {
  const snapshot = deriveImplementationPrototypeRunSyncSnapshot({
    latestRun: input.latestRun,
    workUnits: input.workUnits,
  });
  const nextState = syncImplementationTaskExecutionFromPrototypeRun({
    state: input.currentState,
    snapshot,
    nowIso: input.nowIso,
  });
  const changed =
    nextState != null &&
    nextState !== input.currentState &&
    !isImplementationTaskExecutionStateEqual(input.currentState, nextState);
  return { snapshot, nextState, changed };
}
