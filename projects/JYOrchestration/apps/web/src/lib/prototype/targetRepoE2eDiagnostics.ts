import {
  isRealCursorSourceGenerationCompleted,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import { isCursorExecutionReady } from "@/lib/prototype/cursorExecutionAvailability";
import {
  type ExecutionSetupSourceGenerationContext,
  type ExecutionSetupSourceGenerationRow,
  evaluateExecutionSetupSourceGenerationReadiness,
  formatExecutionSetupSourceGenerationDiagnosticLines,
  formatExecutionSetupSourceGenerationDiagnosticLinesFromSetup,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { resolveBridgePushAndPrStatus } from "@/lib/prototype/bridgeCompletionPolicy";
import {
  buildImplementationTraceTimelineEntry,
  maskWorkspacePathForTimeline,
} from "@/lib/prototype/implementationTraceTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type CursorBridgeConnectionPhase =
  | "not_configured"
  | "configured"
  | "call_succeeded"
  | "source_generation_succeeded"
  | "failed";

export type WorkspaceOriginCheckStatus = "unchecked" | "matched" | "mismatched" | "not_applicable";

export type TargetRepoE2eTimelineAction =
  | "target_repo_e2e_readiness_checked"
  | "target_repo_workspace_origin_matched"
  | "target_repo_workspace_origin_mismatch"
  | "cursor_bridge_source_generation_completed"
  | "cursor_bridge_source_generation_rejected"
  | "review_security_diff_engine_pending";

export type PlatformScmTimelineAction =
  | "platform_scm_push_requested"
  | "platform_scm_push_started"
  | "platform_scm_push_completed"
  | "platform_scm_push_failed"
  | "platform_scm_pr_requested"
  | "platform_scm_pr_created"
  | "platform_scm_pr_failed"
  | "platform_scm_diff_gate_validated"
  | "platform_scm_diff_gate_failed"
  | "platform_scm_merge_requested"
  | "platform_scm_merge_completed"
  | "platform_scm_merge_failed";

export type CursorApiDirectTimelineAction =
  | "cursor_api_availability_checked"
  | "cursor_api_direct_execution_requested"
  | "cursor_api_direct_execution_started"
  | "cursor_api_direct_execution_completed"
  | "cursor_api_direct_execution_failed"
  | "cursor_api_direct_execution_unsupported"
  | "cursor_api_git_commit_created"
  | "cursor_api_git_push_completed"
  | "cursor_api_git_push_failed";

export const CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE =
  "Cursor API가 설정되지 않았습니다.\n\n현재는 WIP 초안까지만 생성되었습니다.\n실제 소스 생성을 진행하려면 환경설정에서 Cursor API URL과 키를 저장해 주세요." as const;

/** @deprecated Use CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE (same text) or CURSOR_API_NOT_CONFIGURED_MESSAGE */
export const CURSOR_API_NOT_CONFIGURED_E2E_MESSAGE = CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE;

export const BRIDGE_CALL_OK_SOURCE_REJECTED_HEADING =
  "Cursor API 호출은 성공했지만 실제 소스 생성으로 인정되지 않았습니다." as const;

export const BRIDGE_SOURCE_GENERATION_SUCCESS_HEADING =
  "Cursor API가 대상 프로젝트 저장소에 실제 소스를 생성했습니다." as const;

export const QUALITY_GATE_DIFF_ENGINE_PENDING_LINES = [
  "검수/보안 점검 기준은 준비되었습니다.",
  "단, 실제 diff 분석 엔진은 아직 연결되지 않았습니다.",
  "현재 점검은 상태/메타데이터 기준 준비 단계입니다.",
] as const;

export { maskWorkspacePathForTimeline } from "@/lib/prototype/implementationTraceTimeline";

export function resolveCursorBridgeConnectionPhase(input: {
  readonly wip?: CodeAgentWipExecutionV1 | null;
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): CursorBridgeConnectionPhase {
  const available = isCursorExecutionReady({ setup: input.setup });
  const wip = input.wip;
  if (!available) return "not_configured";
  if (wip?.bridgeExecutionStatus === "failed") return "failed";
  if (wip && isRealCursorSourceGenerationCompleted(wip)) {
    return "source_generation_succeeded";
  }
  if (wip?.bridgeExecutionStatus === "bridge_completed") {
    return "failed";
  }
  if (wip?.bridgeExecutionStatus === "bridge_running" || wip?.bridgeExecutionStatus === "bridge_requested") {
    return "call_succeeded";
  }
  return "configured";
}

export function formatCursorBridgeConnectionPhaseLine(phase: CursorBridgeConnectionPhase): string {
  switch (phase) {
    case "not_configured":
      return "Cursor API 연결 상태: 미설정";
    case "configured":
      return "Cursor API 연결 상태: 설정됨 (실행 전)";
    case "call_succeeded":
      return "Cursor API 연결 상태: 호출 진행 중";
    case "source_generation_succeeded":
      return "Cursor API 연결 상태: 실제 source generation 성공";
    case "failed":
      return "Cursor API 연결 상태: 실패";
    default:
      return "Cursor API 연결 상태: (알 수 없음)";
  }
}

export function formatWorkspaceOriginStatusLine(status: WorkspaceOriginCheckStatus): string {
  switch (status) {
    case "matched":
      return "workspace origin: 일치";
    case "mismatched":
      return "workspace origin: 불일치";
    case "not_applicable":
      return "workspace origin: 해당 없음";
    default:
      return "workspace origin: 확인 전";
  }
}

export function formatUnconnectedCapabilityLines(input?: {
  readonly autoPr?: boolean;
  readonly prNumber?: number;
  readonly bridgePhase?: CursorBridgeConnectionPhase;
}): readonly string[] {
  const lines: string[] = ["", "후속 연결 예정 (미완성 영역):"];
  if (input?.bridgePhase === "not_configured" || input?.bridgePhase === "configured") {
    lines.push("- Cursor API 품질: 미검증 (실제 소스 생성 품질 보장 없음)");
  } else if (input?.bridgePhase !== "source_generation_succeeded") {
    lines.push("- Cursor API 품질: 호출/생성 결과 미확정");
  }
  if (input?.autoPr && input.prNumber === undefined) {
    lines.push("- PR 자동 생성: 미연결 (commit 완료와 PR 생성은 별개)");
  }
  lines.push("- 검수/보안 diff 분석 엔진: 미연결 (commit metadata만 전달)");
  return lines;
}

export function formatTargetRepoE2eDiagnosticLines(input: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
  readonly context?: ExecutionSetupSourceGenerationContext | null;
  readonly workspaceOriginStatus?: WorkspaceOriginCheckStatus;
  readonly wip?: CodeAgentWipExecutionV1 | null;
  readonly env?: Record<string, string | undefined>;
}): readonly string[] {
  const base = input.context
    ? formatExecutionSetupSourceGenerationDiagnosticLines(input.context)
    : formatExecutionSetupSourceGenerationDiagnosticLinesFromSetup(input.setup, input.env);

  const phase = resolveCursorBridgeConnectionPhase({ wip: input.wip, setup: input.setup });
  const originStatus = input.workspaceOriginStatus ?? "unchecked";
  const pushPr =
    input.wip?.bridgeExecutionStatus === "bridge_completed"
      ? resolveBridgePushAndPrStatus({
          autoPush: input.wip.bridgeAutoPush === true,
          autoPr: input.wip.bridgeAutoPr === true,
          pushed: input.wip.pushed,
          pushErrorMessage: input.wip.pushErrorMessage,
          prNumber: input.wip.prNumber,
        })
      : null;

  return [
    ...base,
    `- ${formatWorkspaceOriginStatusLine(originStatus)}`,
    `- ${formatCursorBridgeConnectionPhaseLine(phase)}`,
    ...(pushPr ? [`- ${pushPr.pushStatusLine}`, `- ${pushPr.prStatusLine}`] : []),
    ...formatUnconnectedCapabilityLines({
      autoPr: input.wip?.bridgeAutoPr ?? input.context?.autoPr ?? input.setup?.autoPr === true,
      prNumber: input.wip?.prNumber,
      bridgePhase: phase,
    }),
  ];
}

export function buildTargetRepoE2eTimelineEntry(input: {
  readonly action: TargetRepoE2eTimelineAction;
  readonly projectId: string;
  readonly selectedTaskId?: string;
  readonly repoFullName?: string;
  readonly baseBranch?: string;
  readonly workspacePath?: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly changedFilesCount?: number;
  readonly pushStatus?: string;
  readonly prStatus?: string;
  readonly status?: string;
  readonly reason?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationTraceTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "target_repo_e2e",
    projectId: input.projectId,
    nowIso: input.nowIso,
    fields: {
      selectedTaskId: input.selectedTaskId,
      repoFullName: input.repoFullName,
      baseBranch: input.baseBranch,
      workspacePath: input.workspacePath,
      branchName: input.branchName,
      commitSha: input.commitSha,
      changedFilesCount: input.changedFilesCount,
      pushStatus: input.pushStatus,
      prStatus: input.prStatus,
      status: input.status,
      reason: input.reason,
    },
  });
}

export function evaluateTargetRepoE2eReadinessFromSetup(input: {
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
  readonly env?: Record<string, string | undefined>;
}) {
  return evaluateExecutionSetupSourceGenerationReadiness({ setup: input.setup, env: input.env });
}

export function isCursorBridgeConfiguredForSourceGeneration(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): boolean {
  return isCursorExecutionReady({ setup: input?.setup });
}

export function buildCursorApiDirectTimelineEntry(input: {
  readonly action: CursorApiDirectTimelineAction;
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly repoFullName?: string;
  readonly workspacePath?: string;
  readonly branchName?: string;
  readonly status: string;
  readonly runId?: string;
  readonly commitSha?: string;
  readonly changedFilesCount?: number;
  readonly hasCommitSha?: boolean;
  readonly pushStatus?: string;
  readonly prNumber?: number;
  readonly reason?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationTraceTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "target_repo_e2e",
    mode: "cursor_api",
    projectId: input.projectId,
    nowIso: input.nowIso,
    fields: {
      selectedTaskId: input.selectedTaskId,
      runId: input.runId,
      repoFullName: input.repoFullName ?? "none",
      workspacePath: input.workspacePath,
      branchName: input.branchName ?? "none",
      status: input.status,
      commitSha: input.commitSha,
      changedFilesCount: input.changedFilesCount,
      hasCommitSha: input.hasCommitSha,
      pushStatus: input.pushStatus,
      prNumber: input.prNumber,
      reason: input.reason,
    },
  });
}

export function buildPlatformScmTimelineEntry(input: {
  readonly action: PlatformScmTimelineAction;
  readonly projectId: string;
  readonly selectedTaskId: string;
  readonly repoFullName?: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly status: string;
  readonly prNumber?: number;
  readonly reason?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationTraceTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "platform_scm",
    mode: "platform_scm",
    projectId: input.projectId,
    nowIso: input.nowIso,
    fields: {
      selectedTaskId: input.selectedTaskId,
      repoFullName: input.repoFullName,
      branchName: input.branchName,
      commitSha: input.commitSha,
      prNumber: input.prNumber,
      status: input.status,
      reason: input.reason,
    },
  });
}
