import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { CursorBridgeExecuteResult } from "@/lib/prototype/cursorBridgeExecution";
import type { CursorApiDirectExecuteResult } from "@/lib/prototype/cursorApiDirectClient";

export const PLATFORM_SCM_EXECUTION_VERSION = "platform_scm_execution_v1" as const;

export type PlatformScmExecutionStatus =
  | "pending"
  | "push_requested"
  | "push_running"
  | "push_completed"
  | "push_failed"
  | "pr_requested"
  | "pr_completed"
  | "pr_failed"
  | "merge_pending"
  | "merge_completed"
  | "merge_failed";

export type PlatformScmExecutionV1 = Readonly<{
  readonly version: typeof PLATFORM_SCM_EXECUTION_VERSION;
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly sourceCommitSha: string;
  readonly sourceBranchName: string;
  readonly targetRepository: string;
  readonly pushStatus: PlatformScmExecutionStatus;
  readonly prNumber?: number;
  readonly prUrl?: string;
  readonly mergeStatus?: PlatformScmExecutionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}>;

export type CursorExternalScmReference = Readonly<{
  readonly cursorExternalPushStatus?: string;
  readonly cursorExternalPrNumber?: number;
  readonly cursorExternalPrStatus?: string;
}>;

export function extractCursorExternalScmReference(input: {
  readonly pushed?: boolean;
  readonly pushStatus?: string;
  readonly pushErrorMessage?: string;
  readonly prNumber?: number;
  readonly prStatus?: string;
}): CursorExternalScmReference {
  const ref: {
    cursorExternalPushStatus?: string;
    cursorExternalPrNumber?: number;
    cursorExternalPrStatus?: string;
  } = {};
  if (input.pushStatus) {
    ref.cursorExternalPushStatus = input.pushStatus;
  } else if (input.pushed === true) {
    ref.cursorExternalPushStatus = "success";
  } else if (input.pushed === false && input.pushErrorMessage) {
    ref.cursorExternalPushStatus = "failed";
  }
  if (input.prNumber !== undefined && Number.isFinite(input.prNumber)) {
    ref.cursorExternalPrNumber = input.prNumber;
  }
  if (input.prStatus?.trim()) {
    ref.cursorExternalPrStatus = input.prStatus.trim();
  }
  return ref;
}

export function extractCursorExternalScmFromDirectResult(
  result: CursorApiDirectExecuteResult,
): CursorExternalScmReference {
  return extractCursorExternalScmReference(result);
}

export function extractCursorExternalScmFromBridgeResult(
  result: CursorBridgeExecuteResult,
): CursorExternalScmReference {
  const fromResponse = extractCursorExternalScmReference(result);
  return {
    ...fromResponse,
    ...(result.cursorExternalPushStatus ? { cursorExternalPushStatus: result.cursorExternalPushStatus } : {}),
    ...(result.cursorExternalPrNumber !== undefined
      ? { cursorExternalPrNumber: result.cursorExternalPrNumber }
      : {}),
    ...(result.cursorExternalPrStatus ? { cursorExternalPrStatus: result.cursorExternalPrStatus } : {}),
  };
}

export function buildInitialPlatformScmExecutionFromWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly commitSha: string;
  readonly branchName: string;
  readonly nowIso?: string;
}): PlatformScmExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const targetRepository =
    input.wip.targetRepositorySnapshot?.repoFullName ??
    input.wip.targetRepoFullName ??
    input.wip.targetRepository ??
    "";
  return {
    version: PLATFORM_SCM_EXECUTION_VERSION,
    projectId: input.wip.projectId,
    selectedTaskId: input.wip.selectedTaskId ?? input.wip.workItems[0] ?? "unknown",
    sourceCommitSha: input.commitSha,
    sourceBranchName: input.branchName,
    targetRepository,
    pushStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export function platformScmStatusLabel(
  scm: PlatformScmExecutionV1 | null | undefined,
): string {
  if (!scm) return "Push/PR 대기";
  if (scm.mergeStatus === "merge_completed") return "Merge 완료";
  if (scm.mergeStatus === "merge_failed") return "Merge 실패";
  if (scm.mergeStatus === "merge_pending" && scm.pushStatus === "pr_completed") {
    return scm.prNumber ? `PR #${scm.prNumber} — Merge 대기` : "Merge 대기";
  }
  switch (scm.pushStatus) {
    case "pending":
      return "Push/PR 대기";
    case "push_requested":
    case "push_running":
      return "Push 진행 중";
    case "push_completed":
      return scm.prNumber ? `PR #${scm.prNumber}` : "Push 완료";
    case "push_failed":
      return "Push 실패";
    case "pr_requested":
      return "PR 생성 중";
    case "pr_completed":
      return scm.prNumber ? `PR #${scm.prNumber}` : "PR 생성됨";
    case "pr_failed":
      return "PR 실패";
    case "merge_pending":
      return "Merge 대기";
    case "merge_completed":
      return "Merge 완료";
    case "merge_failed":
      return "Merge 실패";
    default:
      return "Push/PR 대기";
  }
}

export function normalizeCursorBridgeResultForPlatform(
  result: CursorBridgeExecuteResult,
): CursorBridgeExecuteResult {
  if (!result.ok || result.status !== "completed") return result;
  const {
    pushed: _pushed,
    pushStatus: _pushStatus,
    pushErrorMessage: _pushError,
    prNumber: _pr,
    prStatus: _prStatus,
    ...rest
  } = result;
  return {
    ...rest,
    pushed: false,
  };
}

const PLATFORM_SCM_STATUSES = new Set<PlatformScmExecutionStatus>([
  "pending",
  "push_requested",
  "push_running",
  "push_completed",
  "push_failed",
  "pr_requested",
  "pr_completed",
  "pr_failed",
  "merge_pending",
  "merge_completed",
  "merge_failed",
]);

export function parsePlatformScmExecutionV1(raw: unknown): PlatformScmExecutionV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "").trim() !== PLATFORM_SCM_EXECUTION_VERSION) return undefined;
  const projectId = String(o.projectId ?? "").trim();
  const selectedTaskId = String(o.selectedTaskId ?? "").trim();
  const sourceCommitSha = String(o.sourceCommitSha ?? "").trim();
  const sourceBranchName = String(o.sourceBranchName ?? "").trim();
  const targetRepository = String(o.targetRepository ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  const pushStatusRaw = String(o.pushStatus ?? "pending").trim() as PlatformScmExecutionStatus;
  if (!projectId || !selectedTaskId || !sourceCommitSha || !sourceBranchName || !createdAt || !updatedAt) {
    return undefined;
  }
  const mergeStatusRaw = String(o.mergeStatus ?? "").trim() as PlatformScmExecutionStatus;
  return {
    version: PLATFORM_SCM_EXECUTION_VERSION,
    projectId,
    selectedTaskId,
    sourceCommitSha,
    sourceBranchName,
    targetRepository,
    pushStatus: PLATFORM_SCM_STATUSES.has(pushStatusRaw) ? pushStatusRaw : "pending",
    ...(typeof o.prNumber === "number" && Number.isFinite(o.prNumber) ? { prNumber: o.prNumber } : {}),
    ...(typeof o.prUrl === "string" && o.prUrl.trim() ? { prUrl: o.prUrl.trim() } : {}),
    ...(mergeStatusRaw && PLATFORM_SCM_STATUSES.has(mergeStatusRaw) ? { mergeStatus: mergeStatusRaw } : {}),
    createdAt,
    updatedAt,
  };
}

export function patchPlatformScmExecutionStatus(
  scm: PlatformScmExecutionV1,
  pushStatus: PlatformScmExecutionStatus,
  input?: Readonly<{
    readonly prNumber?: number;
    readonly prUrl?: string;
    readonly mergeStatus?: PlatformScmExecutionStatus;
    readonly nowIso?: string;
  }>,
): PlatformScmExecutionV1 {
  const now = input?.nowIso ?? new Date().toISOString();
  return {
    ...scm,
    pushStatus,
    ...(input?.prNumber !== undefined ? { prNumber: input.prNumber } : {}),
    ...(input?.prUrl ? { prUrl: input.prUrl } : {}),
    ...(input?.mergeStatus ? { mergeStatus: input.mergeStatus } : {}),
    updatedAt: now,
  };
}

export function ensurePlatformScmExecutionFromWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly nowIso?: string;
}): PlatformScmExecutionV1 {
  if (input.wip.platformScmExecutionV1) return input.wip.platformScmExecutionV1;
  const last = input.wip.commits[input.wip.commits.length - 1];
  const commitSha = String(last?.sha ?? input.wip.commitSha ?? "").trim();
  const branchName = String(last?.branchName ?? input.wip.branchName ?? "").trim();
  return buildInitialPlatformScmExecutionFromWip({
    wip: input.wip,
    commitSha: commitSha || "unknown",
    branchName: branchName || input.wip.branchName,
    nowIso: input.nowIso,
  });
}

export function buildWipPlatformScmPushRequestPatch(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const scm = patchPlatformScmExecutionStatus(ensurePlatformScmExecutionFromWip({ wip: input.wip, nowIso: now }), "push_requested", {
    nowIso: now,
  });
  return {
    ...input.wip,
    platformScmExecutionV1: scm,
  };
}

export function applyPlatformScmPushSuccessToWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly prNumber?: number;
  readonly prUrl?: string;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const pushStatus: PlatformScmExecutionStatus =
    input.prNumber !== undefined ? "pr_completed" : "push_completed";
  const scm = patchPlatformScmExecutionStatus(input.scm, pushStatus, {
    prNumber: input.prNumber,
    prUrl: input.prUrl,
    ...(input.prNumber !== undefined ? { mergeStatus: "merge_pending" as const } : {}),
    nowIso: now,
  });
  return {
    ...input.wip,
    pushed: true,
    pushStatus: "success",
    ...(input.prNumber !== undefined ? { prNumber: input.prNumber } : {}),
    ...(input.prUrl ? { prStatus: `PR: #${input.prNumber ?? ""} opened` } : {}),
    platformScmExecutionV1: scm,
  };
}

export function applyPlatformScmMergePendingToWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const scm = patchPlatformScmExecutionStatus(input.scm, input.scm.pushStatus, {
    mergeStatus: "merge_pending",
    nowIso: now,
  });
  return {
    ...input.wip,
    platformScmExecutionV1: scm,
  };
}

export function applyPlatformScmMergeSuccessToWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const scm = patchPlatformScmExecutionStatus(input.scm, input.scm.pushStatus, {
    mergeStatus: "merge_completed",
    nowIso: now,
  });
  return {
    ...input.wip,
    prStatus: scm.prNumber !== undefined ? `PR: #${scm.prNumber} merged` : "merged",
    platformScmExecutionV1: scm,
  };
}

export function applyPlatformScmMergeFailureToWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly errorMessage: string;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const scm = patchPlatformScmExecutionStatus(input.scm, input.scm.pushStatus, {
    mergeStatus: "merge_failed",
    nowIso: now,
  });
  return {
    ...input.wip,
    platformScmExecutionV1: scm,
  };
}

export function applyPlatformScmPushFailureToWip(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly errorMessage: string;
  readonly nowIso?: string;
}): CodeAgentWipExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const scm = patchPlatformScmExecutionStatus(input.scm, "push_failed", { nowIso: now });
  return {
    ...input.wip,
    pushed: false,
    pushStatus: "failed",
    pushErrorMessage: input.errorMessage,
    platformScmExecutionV1: scm,
  };
}
