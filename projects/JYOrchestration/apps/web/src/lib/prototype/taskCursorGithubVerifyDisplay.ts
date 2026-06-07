import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  isLegacyMockProcessTaskId,
  repairLegacyMockProcessTaskId,
} from "@/lib/prototype/codeTaskRunTargetCanonical";

export function resolveGithubVerifyToastTaskLabel(input: {
  readonly executionTaskId: string;
  readonly codeTaskId: string;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): Readonly<{ readonly label: string; readonly clearedStaleMock: boolean }> {
  const executionTaskId = String(input.executionTaskId ?? "").trim();
  const codeTaskId = String(input.codeTaskId ?? "").trim();
  const codeTask = input.codeTaskPlan?.tasks.find((t) => t.codeTaskId.trim() === codeTaskId) ?? null;
  const branchPlan = parseCodeTaskBranchPlanV1(codeTask?.branchPlan);
  const canonicalProcessTaskId = codeTask
    ? repairLegacyMockProcessTaskId({
        taskId: codeTask.parentTaskId,
        codeTaskId,
        branchGroup: branchPlan?.branchGroup ?? null,
      })
    : executionTaskId;

  const clearedStaleMock =
    Boolean(executionTaskId) &&
    isLegacyMockProcessTaskId(executionTaskId) &&
    canonicalProcessTaskId !== executionTaskId;

  const title = String(codeTask?.title ?? "").trim();
  const label =
    (canonicalProcessTaskId && !isLegacyMockProcessTaskId(canonicalProcessTaskId)
      ? canonicalProcessTaskId
      : "") ||
    title ||
    executionTaskId;

  return { label, clearedStaleMock };
}

export function formatGithubVerifyCheckingToast(label: string): string {
  return `${label} · GitHub branch에서 commit 확인 중…`;
}
