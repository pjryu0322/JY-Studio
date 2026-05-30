import { isRealCursorSourceGenerationCompleted, type CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import {
  evaluatePlatformScmQualityGateMergePolicy,
  validatePlatformScmPrDiffGate,
  type PlatformScmDiffGateResult,
} from "@/lib/prototype/platformScmDiffGateValidator";
import {
  patchPlatformScmExecutionStatus,
  type PlatformScmExecutionV1,
} from "@/lib/prototype/platformScmExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { autoMergePullRequest, isAutoMergeEnabled } from "@/lib/service/githubAutoMergeService";

export type PlatformScmMergeExecutorResult = Readonly<{
  readonly ok: boolean;
  readonly status: "completed" | "blocked" | "failed" | "pending";
  readonly message: string;
  readonly platformScmExecutionV1?: PlatformScmExecutionV1;
  readonly merged?: boolean;
  readonly diffGate?: PlatformScmDiffGateResult;
  readonly autoMergeAttempted?: boolean;
  readonly log?: readonly string[];
}>;

export function validatePlatformScmMergeReadiness(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
}): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  if (!isRealCursorSourceGenerationCompleted(input.wip)) {
    return { ok: false, message: "실제 Cursor commit 결과가 없어 PR merge를 수행할 수 없습니다." };
  }
  const scm = input.wip.platformScmExecutionV1;
  if (!scm || scm.pushStatus !== "pr_completed") {
    return { ok: false, message: "플랫폼 SCM PR 생성이 완료된 뒤 merge를 실행할 수 있습니다." };
  }
  if (scm.mergeStatus === "merge_completed") {
    return { ok: false, message: "이미 PR merge가 완료되었습니다." };
  }
  if (!scm.prNumber || !scm.prUrl) {
    return { ok: false, message: "PR 정보가 없어 merge를 수행할 수 없습니다." };
  }
  const githubToken = String(input.setup?.githubAccessToken ?? "").trim();
  if (!githubToken) {
    return { ok: false, message: "GitHub Access Token이 설정되지 않았습니다." };
  }
  return { ok: true };
}

export async function executePlatformScmMerge(input: {
  readonly projectId: string;
  readonly wip: CodeAgentWipExecutionV1;
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly autoMergeOnly?: boolean;
  readonly nowIso?: string;
}): Promise<PlatformScmMergeExecutorResult> {
  const readiness = validatePlatformScmMergeReadiness({ wip: input.wip, setup: input.setup });
  if (!readiness.ok) {
    return { ok: false, status: "blocked", message: readiness.message };
  }

  const now = input.nowIso ?? new Date().toISOString();
  const log: string[] = [];
  const scm = input.wip.platformScmExecutionV1!;
  const selectedTaskId = input.wip.selectedTaskId ?? scm.selectedTaskId ?? "unknown";

  const gatePolicy = evaluatePlatformScmQualityGateMergePolicy({
    qualityGateResults: input.qualityGateResults,
    executionState: input.executionState,
    selectedTaskId,
  });
  if (!gatePolicy.ok) {
    return { ok: false, status: "blocked", message: gatePolicy.message };
  }
  log.push(gatePolicy.message);

  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoName: input.setup?.gitRepoName,
    gitRepoUrl: input.setup?.gitRepoUrl,
    baseBranch: input.setup?.baseBranch,
  });
  const repoUrl =
    targetRepository?.gitRepoUrl ??
    `https://github.com/${scm.targetRepository || input.wip.targetRepoFullName || ""}`;

  let runningScm = patchPlatformScmExecutionStatus(scm, scm.pushStatus, {
    mergeStatus: "merge_pending",
    nowIso: now,
  });

  const diffGate = await validatePlatformScmPrDiffGate({
    wip: input.wip,
    scm,
    repoUrl,
    githubAccessToken: String(input.setup?.githubAccessToken ?? ""),
    requireDiffValidation: gatePolicy.requiresDiffValidation,
  });
  if (!diffGate.ok) {
    runningScm = patchPlatformScmExecutionStatus(runningScm, runningScm.pushStatus, {
      mergeStatus: "merge_failed",
      nowIso: now,
    });
    return {
      ok: false,
      status: diffGate.status === "blocked" ? "blocked" : "failed",
      message: diffGate.message,
      platformScmExecutionV1: runningScm,
      diffGate,
      log,
    };
  }
  log.push(diffGate.message);

  const autoMergeEnabled = isAutoMergeEnabled();
  if (input.autoMergeOnly && !autoMergeEnabled) {
    return {
      ok: true,
      status: "pending",
      message: "검수/보안 diff 검증 완료 — PR merge는 수동 승인 대기 중입니다.",
      platformScmExecutionV1: runningScm,
      merged: false,
      diffGate,
      autoMergeAttempted: false,
      log,
    };
  }

  if (!autoMergeEnabled) {
    return {
      ok: true,
      status: "pending",
      message: "검수/보안 기준 충족 — auto-merge 비활성화로 PR merge 대기 중입니다.",
      platformScmExecutionV1: runningScm,
      merged: false,
      diffGate,
      autoMergeAttempted: false,
      log,
    };
  }

  const mergeResult = await autoMergePullRequest({
    prUrl: scm.prUrl!,
    githubAccessToken: String(input.setup?.githubAccessToken ?? ""),
    commitTitle: `[JYO][PROTOTYPE] ${selectedTaskId} — platform SCM merge`.slice(0, 240),
  });

  if (!mergeResult.ok) {
    runningScm = patchPlatformScmExecutionStatus(runningScm, runningScm.pushStatus, {
      mergeStatus: "merge_failed",
      nowIso: now,
    });
    return {
      ok: false,
      status: "failed",
      message: mergeResult.message,
      platformScmExecutionV1: runningScm,
      merged: false,
      diffGate,
      autoMergeAttempted: true,
      log,
    };
  }

  runningScm = patchPlatformScmExecutionStatus(runningScm, runningScm.pushStatus, {
    mergeStatus: "merge_completed",
    nowIso: now,
  });

  return {
    ok: true,
    status: "completed",
    message: mergeResult.detail?.alreadyMerged
      ? "PR이 이미 merge된 상태입니다."
      : `PR #${scm.prNumber} merge가 완료되었습니다.`,
    platformScmExecutionV1: runningScm,
    merged: true,
    diffGate,
    autoMergeAttempted: true,
    log,
  };
}
