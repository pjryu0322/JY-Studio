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

export function maskWorkspacePathForTimeline(workspacePath: string | undefined): string {
  const raw = String(workspacePath ?? "").trim();
  if (!raw) return "(없음)";
  if (raw.length <= 8) return raw;
  return `${raw.slice(0, 4)}…${raw.slice(-3)}`;
}

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
  const parts = [
    `type=${input.action}`,
    `projectId=${input.projectId}`,
    ...(input.selectedTaskId ? [`selectedTaskId=${input.selectedTaskId}`] : []),
    ...(input.repoFullName ? [`repoFullName=${input.repoFullName}`] : []),
    ...(input.baseBranch ? [`baseBranch=${input.baseBranch}`] : []),
    ...(input.workspacePath ? [`workspacePath=${maskWorkspacePathForTimeline(input.workspacePath)}`] : []),
    ...(input.branchName ? [`branchName=${input.branchName}`] : []),
    ...(input.commitSha ? [`commitSha=${input.commitSha.slice(0, 12)}`] : []),
    ...(input.changedFilesCount !== undefined ? [`changedFilesCount=${input.changedFilesCount}`] : []),
    ...(input.pushStatus ? [`pushStatus=${input.pushStatus}`] : []),
    ...(input.prStatus ? [`prStatus=${input.prStatus}`] : []),
    ...(input.status ? [`status=${input.status}`] : []),
    ...(input.reason ? [`reason=${input.reason.replace(/\s+/g, "_").slice(0, 120)}`] : []),
  ];
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: parts.join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "target_repo_e2e",
  };
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
  const parts = [
    `type=${input.action}`,
    "mode=cursor_api",
    `projectId=${input.projectId}`,
    `selectedTaskId=${input.selectedTaskId}`,
    ...(input.runId ? [`runId=${input.runId}`] : []),
    `repoFullName=${input.repoFullName ?? "none"}`,
    `workspacePath=${maskWorkspacePathForTimeline(input.workspacePath)}`,
    `branchName=${input.branchName ?? "none"}`,
    `status=${input.status}`,
    ...(input.commitSha ? [`commitSha=${input.commitSha}`] : []),
    ...(input.changedFilesCount !== undefined
      ? [`changedFilesCount=${input.changedFilesCount}`]
      : []),
    ...(input.hasCommitSha !== undefined ? [`hasCommitSha=${input.hasCommitSha ? "yes" : "no"}`] : []),
    ...(input.pushStatus ? [`pushStatus=${input.pushStatus}`] : []),
    ...(input.prNumber !== undefined ? [`prNumber=${input.prNumber}`] : []),
    ...(input.reason ? [`reason=${input.reason.slice(0, 120)}`] : []),
  ];
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: parts.join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "target_repo_e2e",
  };
}
