import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  getLatestImplementationQualityGateResultForRole,
  type ImplementationQualityGateResultV1,
} from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import {
  fetchEnvTestPullDetail,
  fetchEnvTestPullFiles,
} from "@/lib/service/githubEnvTestMergeService";
import type { PlatformScmExecutionV1 } from "@/lib/prototype/platformScmExecution";

export type PlatformScmDiffGateStatus = "validated" | "failed" | "blocked";

export type PlatformScmDiffGateResult = Readonly<{
  readonly ok: boolean;
  readonly status: PlatformScmDiffGateStatus;
  readonly message: string;
  readonly prHeadSha?: string;
  readonly prFileCount?: number;
  readonly matchedFileCount?: number;
  readonly requiresDiffValidation?: boolean;
}>;

export type PlatformScmQualityGateMergePolicyResult = Readonly<{
  readonly ok: boolean;
  readonly message: string;
  readonly requiresDiffValidation: boolean;
  readonly reviewerResult?: ImplementationQualityGateResultV1 | null;
  readonly securityResult?: ImplementationQualityGateResultV1 | null;
}>;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function collectWipChangedFiles(wip: CodeAgentWipExecutionV1): readonly string[] {
  const lastCommit = wip.commits[wip.commits.length - 1];
  const fromCommit = lastCommit?.changedFiles ?? [];
  if (fromCommit.length) return fromCommit.map(normalizePath);
  return (wip.changedFiles ?? []).map(normalizePath);
}

function roleGateBlocksMerge(
  result: ImplementationQualityGateResultV1 | null,
): boolean {
  if (!result) return false;
  if (result.status === "passed") return false;
  if (result.engineConnectionStatus === "pending_engine_connection") return false;
  return true;
}

function roleGateRequiresDiffValidation(
  result: ImplementationQualityGateResultV1 | null,
): boolean {
  return result?.engineConnectionStatus === "pending_engine_connection";
}

export function evaluatePlatformScmQualityGateMergePolicy(input: {
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly selectedTaskId?: string;
}): PlatformScmQualityGateMergePolicyResult {
  const reviewerResult = getLatestImplementationQualityGateResultForRole(
    input.qualityGateResults,
    "reviewer",
  );
  const securityResult = getLatestImplementationQualityGateResultForRole(
    input.qualityGateResults,
    "security",
  );

  if (roleGateBlocksMerge(reviewerResult)) {
    return {
      ok: false,
      message: "AI 검수자 점검이 실패하여 PR merge를 진행할 수 없습니다.",
      requiresDiffValidation: false,
      reviewerResult,
      securityResult,
    };
  }
  if (roleGateBlocksMerge(securityResult)) {
    return {
      ok: false,
      message: "AI 보안관 점검이 실패하여 PR merge를 진행할 수 없습니다.",
      requiresDiffValidation: false,
      reviewerResult,
      securityResult,
    };
  }

  const failedRoleItems =
    input.executionState?.items.some(
      (item) =>
        (item.ownerRole === "reviewer" || item.ownerRole === "security") &&
        item.status === "failed" &&
        (!input.selectedTaskId || item.taskId === input.selectedTaskId),
    ) ?? false;
  if (failedRoleItems) {
    return {
      ok: false,
      message: "검수/보안 작업이 실패 상태여서 PR merge를 진행할 수 없습니다.",
      requiresDiffValidation: false,
      reviewerResult,
      securityResult,
    };
  }

  const requiresDiffValidation =
    roleGateRequiresDiffValidation(reviewerResult) ||
    roleGateRequiresDiffValidation(securityResult);

  return {
    ok: true,
    message: requiresDiffValidation
      ? "검수/보안 diff 엔진 미연결 — GitHub PR diff 검증으로 대체합니다."
      : "검수/보안 점검 기준을 충족했습니다.",
    requiresDiffValidation,
    reviewerResult,
    securityResult,
  };
}

export async function validatePlatformScmPrDiffGate(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly scm: PlatformScmExecutionV1;
  readonly repoUrl: string;
  readonly githubAccessToken: string;
  readonly requireDiffValidation: boolean;
}): Promise<PlatformScmDiffGateResult> {
  const prNumber = input.scm.prNumber;
  if (prNumber === undefined || !Number.isFinite(prNumber)) {
    return { ok: false, status: "blocked", message: "PR 번호가 없어 diff 검증을 수행할 수 없습니다." };
  }
  if (!input.requireDiffValidation) {
    return { ok: true, status: "validated", message: "검수/보안 점검 통과 — diff 검증 생략" };
  }

  const token = input.githubAccessToken.trim();
  if (!token) {
    return { ok: false, status: "blocked", message: "GitHub Access Token이 없어 diff 검증을 수행할 수 없습니다." };
  }

  const detail = await fetchEnvTestPullDetail({
    repoUrl: input.repoUrl,
    pullNumber: prNumber,
    token,
  });
  if (!detail.ok) {
    return { ok: false, status: "failed", message: detail.message };
  }

  const prHeadSha = String(detail.pr.head?.sha ?? "").trim();
  const expectedSha = String(input.scm.sourceCommitSha ?? input.wip.commitSha ?? "").trim();
  if (expectedSha && prHeadSha && !prHeadSha.startsWith(expectedSha.slice(0, 12)) && prHeadSha !== expectedSha) {
    return {
      ok: false,
      status: "failed",
      message: "PR head commit이 WIP commit과 일치하지 않습니다.",
      prHeadSha,
    };
  }

  const filesResult = await fetchEnvTestPullFiles({
    repoUrl: input.repoUrl,
    pullNumber: prNumber,
    token,
  });
  if (!filesResult.ok) {
    return { ok: false, status: "failed", message: filesResult.message };
  }

  const prFiles = filesResult.files
    .map((file) => normalizePath(String(file.filename ?? "")))
    .filter(Boolean);
  const wipFiles = collectWipChangedFiles(input.wip);
  const prFileSet = new Set(prFiles);
  const matched = wipFiles.filter((file) => prFileSet.has(file));

  if (wipFiles.length > 0 && matched.length === 0) {
    return {
      ok: false,
      status: "failed",
      message: "PR diff 파일과 WIP 변경 파일 목록이 일치하지 않습니다.",
      prHeadSha,
      prFileCount: prFiles.length,
      matchedFileCount: 0,
      requiresDiffValidation: true,
    };
  }

  return {
    ok: true,
    status: "validated",
    message:
      wipFiles.length > 0
        ? `PR diff 검증 완료 (${matched.length}/${wipFiles.length} 파일 일치)`
        : `PR diff 검증 완료 (${prFiles.length} 파일)`,
    prHeadSha,
    prFileCount: prFiles.length,
    matchedFileCount: matched.length,
    requiresDiffValidation: true,
  };
}
