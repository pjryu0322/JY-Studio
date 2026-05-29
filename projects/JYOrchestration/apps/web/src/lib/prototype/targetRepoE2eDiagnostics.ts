import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { getCursorBridgeAvailability, isCursorBridgeExecutionAvailable } from "@/lib/prototype/cursorBridgeRuntime";
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

export const CURSOR_BRIDGE_NOT_CONFIGURED_MESSAGE =
  "Cursor Bridge/API가 설정되지 않았습니다.\n\n현재는 WIP 초안까지만 생성되었습니다.\n실제 소스 생성을 진행하려면 환경설정에서 Cursor Bridge/API를 활성화해 주세요." as const;

export const BRIDGE_CALL_OK_SOURCE_REJECTED_HEADING =
  "Cursor Bridge 호출은 성공했지만 실제 소스 생성으로 인정되지 않았습니다." as const;

export const BRIDGE_SOURCE_GENERATION_SUCCESS_HEADING =
  "Cursor Bridge가 대상 프로젝트 저장소에 실제 소스를 생성했습니다." as const;

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
  readonly env?: Record<string, string | undefined>;
}): CursorBridgeConnectionPhase {
  const available = isCursorBridgeExecutionAvailable({ env: input.env });
  const wip = input.wip;
  if (!available) return "not_configured";
  if (wip?.bridgeExecutionStatus === "failed") return "failed";
  if (wip?.bridgeExecutionStatus === "bridge_completed" && wip.executionMode === "cursor_bridge") {
    const last = wip.commits[wip.commits.length - 1];
    if (last?.sha && !last.sha.startsWith("wip-stub") && last.changedFiles.length > 0) {
      return "source_generation_succeeded";
    }
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
      return "Bridge 연결 상태: 미설정";
    case "configured":
      return "Bridge 연결 상태: 설정됨 (실행 전)";
    case "call_succeeded":
      return "Bridge 연결 상태: 호출 진행 중";
    case "source_generation_succeeded":
      return "Bridge 연결 상태: 실제 source generation 성공";
    case "failed":
      return "Bridge 연결 상태: 실패";
    default:
      return "Bridge 연결 상태: (알 수 없음)";
  }
}

export function formatWorkspaceOriginStatusLine(status: WorkspaceOriginCheckStatus): string {
  switch (status) {
    case "matched":
      return "workspace origin: 일치";
    case "mismatched":
      return "workspace origin: 불일치";
    case "not_applicable":
      return "workspace origin: 해당 없음 (env fallback)";
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
    lines.push("- Cursor API/Bridge 품질: 미검증 (실제 소스 생성 품질 보장 없음)");
  } else if (input?.bridgePhase !== "source_generation_succeeded") {
    lines.push("- Cursor API/Bridge 품질: 호출/생성 결과 미확정");
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

  const phase = resolveCursorBridgeConnectionPhase({ wip: input.wip, env: input.env });
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
  readonly env?: Record<string, string | undefined>;
}): boolean {
  const readiness = evaluateExecutionSetupSourceGenerationReadiness({
    setup: input?.setup,
    env: input?.env,
  });
  if (readiness.ok) return true;
  const bridgeAvailable = getCursorBridgeAvailability({ env: input?.env }).available;
  const hasCursorToken =
    input?.setup?.hasCursorToken === true || Boolean(String(input?.setup?.cursorApiToken ?? "").trim());
  const hasCursorApiUrl = Boolean(String(input?.setup?.cursorApiUrl ?? "").trim());
  return bridgeAvailable || (hasCursorToken && hasCursorApiUrl);
}
