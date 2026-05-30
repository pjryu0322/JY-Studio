import {
  isRealCursorSourceGenerationCompleted,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { validateScmPushBranchName } from "@/lib/prototype/platformScmGitSecurity";
import { resolvePlatformScmWipContext } from "@/lib/prototype/platformScmWipContext";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

export type PlatformScmReadinessResult = Readonly<
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly noOp?: boolean }
>;

export function isPlatformScmPushPrCompleted(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): boolean {
  const pushStatus = wip?.platformScmExecutionV1?.pushStatus;
  return pushStatus === "push_completed" || pushStatus === "pr_completed";
}

/** @deprecated Prefer `isPlatformScmPushPrCompleted` */
export const isFinalScmPlatformExecutionCompleted = isPlatformScmPushPrCompleted;

export function validatePlatformScmPushReadiness(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
}): PlatformScmReadinessResult {
  if (!isRealCursorSourceGenerationCompleted(input.wip)) {
    return { ok: false, message: "실제 Cursor commit 결과가 없어 SCM push를 수행할 수 없습니다." };
  }
  if (input.wip.status !== "scm_commit_pending" && input.wip.status !== "developer_approved") {
    return {
      ok: false,
      message: "SCM 반영은 AI개발자 승인 후 [SCM 반영 요청]으로 시작할 수 있습니다.",
    };
  }
  const scm = input.wip.platformScmExecutionV1;
  if (scm?.pushStatus === "push_completed" || scm?.pushStatus === "pr_completed") {
    return { ok: false, message: "이미 플랫폼 SCM push/PR이 완료되었습니다." };
  }
  const githubToken = String(input.setup?.githubAccessToken ?? "").trim();
  if (!githubToken) {
    return {
      ok: false,
      message: "GitHub Access Token이 설정되지 않았습니다. 환경설정에서 GitHub 토큰을 저장해 주세요.",
    };
  }
  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoName: input.setup?.gitRepoName,
    gitRepoUrl: input.setup?.gitRepoUrl,
    baseBranch: input.setup?.baseBranch,
  });
  if (!targetRepository) {
    return { ok: false, message: "대상 Git 저장소가 설정되지 않았습니다." };
  }
  const ctx = resolvePlatformScmWipContext(input.wip);
  const branchName = String(ctx.branchName ?? "").trim();
  const commitSha = String(ctx.commitSha ?? "").trim();
  const baseBranch = String(input.wip.baseBranch ?? input.setup?.baseBranch ?? targetRepository.defaultBranch ?? "main").trim();
  const branchPolicy = validateScmPushBranchName({ branchName, baseBranch });
  if (!branchPolicy.ok) {
    return { ok: false, message: branchPolicy.message };
  }
  if (!commitSha || commitSha.startsWith("wip-stub")) {
    return { ok: false, message: "SCM push 차단: wip-stub 또는 유효하지 않은 commit SHA입니다." };
  }
  return { ok: true };
}

export function validatePlatformScmMergeStepReadiness(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): PlatformScmReadinessResult {
  if (!wip) {
    return { ok: false, message: "Code Agent WIP 실행 결과가 없어 PR merge를 실행할 수 없습니다." };
  }
  if (wip.platformScmExecutionV1?.pushStatus !== "pr_completed") {
    return { ok: false, message: "플랫폼 SCM PR 생성이 완료된 뒤 merge를 실행할 수 있습니다." };
  }
  if (wip.platformScmExecutionV1?.mergeStatus === "merge_completed") {
    return { ok: false, message: "이미 PR merge가 완료되었습니다.", noOp: true };
  }
  return { ok: true };
}

export function validatePlatformScmMergeReadiness(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
}): PlatformScmReadinessResult {
  const step = validatePlatformScmMergeStepReadiness(input.wip);
  if (!step.ok) return step;

  if (!isRealCursorSourceGenerationCompleted(input.wip)) {
    return { ok: false, message: "실제 Cursor commit 결과가 없어 PR merge를 수행할 수 없습니다." };
  }

  const scm = input.wip.platformScmExecutionV1!;
  if (!scm.prNumber || !scm.prUrl) {
    return { ok: false, message: "PR 정보가 없어 merge를 수행할 수 없습니다." };
  }

  const githubToken = String(input.setup?.githubAccessToken ?? "").trim();
  if (!githubToken) {
    return { ok: false, message: "GitHub Access Token이 설정되지 않았습니다." };
  }

  return { ok: true };
}

export function validateFinalScmIntegratedStageReadiness(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): PlatformScmReadinessResult {
  if (!wip) {
    return {
      ok: false,
      message: "Code Agent WIP 실행 결과가 없어 최종 SCM 반영을 실행할 수 없습니다.",
    };
  }
  if (!isRealCursorSourceGenerationCompleted(wip)) {
    return {
      ok: false,
      message: "실제 Cursor commit 결과가 없어 최종 SCM 반영을 실행할 수 없습니다.",
    };
  }
  if (isPlatformScmPushPrCompleted(wip)) {
    return { ok: true };
  }
  if (wip.status !== "developer_approved" && wip.status !== "scm_commit_pending") {
    return {
      ok: false,
      message: "AI개발자 [구현 결과 승인] 후 최종 SCM 반영을 실행할 수 있습니다.",
    };
  }
  return { ok: true };
}

export function shouldAttemptAutoPlatformScmMerge(wip: CodeAgentWipExecutionV1): boolean {
  const scm = wip.platformScmExecutionV1;
  return scm?.pushStatus === "pr_completed" && scm.mergeStatus !== "merge_completed";
}
