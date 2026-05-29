import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { defaultForbiddenTargetPathGlobs } from "@/lib/prototype/targetRepositoryPathGuard";
import type {
  BridgeResultValidationContext,
  CursorBridgeExecuteRequest,
  CursorBridgeExecuteResult,
} from "@/lib/prototype/cursorBridgeExecution";
import { validateBridgeResultForRealSourceGeneration } from "@/lib/prototype/cursorBridgeExecution";

export const BRIDGE_SOURCE_GENERATION_REJECTED_HEADING =
  "Cursor API 실행 결과를 실제 소스 생성으로 인정하지 않았습니다." as const;

export type CodeAgentPushStatus = "success" | "skipped" | "failed";

export type BridgePushPrStatus = Readonly<{
  readonly pushStatus: CodeAgentPushStatus;
  readonly pushStatusLine: string;
  readonly prStatusLine: string;
  readonly pushErrorMessage?: string;
}>;

export function resolveBridgePushAndPrStatus(input: {
  readonly autoPush: boolean;
  readonly autoPr: boolean;
  readonly pushed?: boolean;
  readonly pushErrorMessage?: string;
  readonly prNumber?: number;
}): BridgePushPrStatus {
  let pushStatus: CodeAgentPushStatus = "skipped";
  let pushStatusLine = "Push: 미수행 — 환경설정 autoPush=false";
  let pushErrorMessage: string | undefined;

  if (input.autoPush) {
    if (input.pushed === true) {
      pushStatus = "success";
      pushStatusLine = "Push: 성공";
    } else if (input.pushErrorMessage?.trim()) {
      pushStatus = "failed";
      pushErrorMessage = input.pushErrorMessage.trim();
      pushStatusLine = `Push: 실패 — ${pushErrorMessage}`;
    } else {
      pushStatus = "skipped";
      pushStatusLine = "Push: 미수행 — push가 실행되지 않았습니다 (GIT_APPLY_PUSH_ENABLED 또는 remote 확인)";
    }
  }

  let prStatusLine: string;
  if (!input.autoPr) {
    prStatusLine = "PR: 미수행 — 환경설정 autoPr=false";
  } else if (input.prNumber !== undefined && Number.isFinite(input.prNumber)) {
    prStatusLine = `PR: 생성됨 — #${input.prNumber}`;
  } else {
    prStatusLine = "PR: 미수행 — PR 자동 생성은 아직 미연결";
  }

  return {
    pushStatus,
    pushStatusLine,
    prStatusLine,
    ...(pushErrorMessage ? { pushErrorMessage } : {}),
  };
}

export function evaluateBridgeResultEligibleForCompletion(
  result: CursorBridgeExecuteResult,
  context: BridgeResultValidationContext,
): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly reasons: readonly string[] }>> {
  const reasons: string[] = [];

  if (!result.ok || result.status !== "completed") {
    reasons.push(result.errorMessage ?? "Bridge 실행이 완료 상태가 아닙니다.");
    return { ok: false, reasons };
  }

  const validation = validateBridgeResultForRealSourceGeneration(result, context);
  if (!validation.ok) {
    reasons.push(validation.reason);
  }

  if (!result.branchName?.trim()) {
    reasons.push("branchName이 없습니다.");
  }

  if (reasons.length) {
    return { ok: false, reasons };
  }
  return { ok: true };
}

export function formatBridgeSourceGenerationRejectionMessage(reasons: readonly string[]): string {
  return [BRIDGE_SOURCE_GENERATION_REJECTED_HEADING, "사유:", ...reasons.map((r) => `- ${r}`)].join("\n");
}

export function bridgeValidationContextFromWip(
  wip: CodeAgentWipExecutionV1,
  request?: CursorBridgeExecuteRequest,
): BridgeResultValidationContext | null {
  if (request) {
    return {
      targetRepository: request.targetRepository,
      allowedPathGlobs: request.allowedPathGlobs,
      forbiddenPathGlobs: request.forbiddenPathGlobs,
    };
  }
  const snap = wip.targetRepositorySnapshot;
  if (!snap) return null;
  return {
    targetRepository: {
      owner: snap.owner,
      repo: snap.repo,
      repoFullName: snap.repoFullName,
      defaultBranch: snap.defaultBranch,
      gitRepoUrl: snap.gitRepoUrl,
      gitRepoProvider: "github",
    },
    allowedPathGlobs: wip.bridgeAllowedPathGlobs ?? [],
    forbiddenPathGlobs: defaultForbiddenTargetPathGlobs(),
  };
}

export type ImplementationQualityGateBridgeTarget = Readonly<{
  readonly selectedTaskId?: string;
  readonly targetRepository?: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly changedFiles?: readonly string[];
  readonly workspacePath?: string;
  readonly baseBranch?: string;
}>;

export function buildQualityGateBridgeTargetFromWip(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): ImplementationQualityGateBridgeTarget | undefined {
  if (!wip || wip.bridgeExecutionStatus !== "bridge_completed" || wip.executionMode !== "cursor_bridge") {
    return undefined;
  }
  const last = wip.commits[wip.commits.length - 1];
  if (!last?.sha || last.sha.startsWith("wip-stub")) return undefined;
  return {
    ...(wip.selectedTaskId ? { selectedTaskId: wip.selectedTaskId } : {}),
    ...(wip.targetRepositorySnapshot?.repoFullName || wip.targetRepoFullName || wip.targetRepository
      ? { targetRepository: wip.targetRepositorySnapshot?.repoFullName ?? wip.targetRepoFullName ?? wip.targetRepository }
      : {}),
    ...(last.branchName ? { branchName: last.branchName } : wip.branchName ? { branchName: wip.branchName } : {}),
    commitSha: last.sha,
    changedFiles: last.changedFiles,
    ...(wip.workspacePath ? { workspacePath: wip.workspacePath } : {}),
    ...(wip.baseBranch ? { baseBranch: wip.baseBranch } : {}),
  };
}

export function formatQualityGateBridgeTargetLines(
  target: ImplementationQualityGateBridgeTarget | undefined,
): readonly string[] {
  if (!target?.commitSha) return [];
  const fileCount = target.changedFiles?.length ?? 0;
  return [
    "점검 기준:",
    ...(target.targetRepository ? [`- 저장소: ${target.targetRepository}`] : []),
    ...(target.branchName ? [`- 브랜치: ${target.branchName}`] : []),
    `- Commit: ${target.commitSha}`,
    `- 변경 파일: ${fileCount}건`,
  ];
}
