import type { ImplementationCodeTaskBoardStateV1 } from "@/lib/prototype/implementationCodeTaskBoardState";

export const CODE_TASK_SUPPLEMENTARY_RUN_ACTION = "code_task_supplementary_run" as const;

/** 보완 재실행 work branch suffix (향후 CodeTaskRevision 확장 전 MVP). */
export function buildSupplementaryWorkBranch(baseWorkBranch: string, revision = 2): string {
  const base = baseWorkBranch.trim();
  if (!base) return `wip/supplementary-r${revision}`;
  if (/-r\d+$/i.test(base)) {
    return base.replace(/-r\d+$/i, `-r${revision}`);
  }
  return `${base}-r${revision}`;
}

export function resolveCodeTaskSupplementaryRunEligibility(input: {
  readonly boardState: ImplementationCodeTaskBoardStateV1;
}): Readonly<{
  readonly eligible: boolean;
  readonly reason: string | null;
}> {
  if (!input.boardState.isCompleted) {
    return { eligible: false, reason: "not_completed" };
  }
  if (!input.boardState.isIntegrationReady) {
    return { eligible: false, reason: "missing_github_outcome" };
  }
  return { eligible: true, reason: null };
}
