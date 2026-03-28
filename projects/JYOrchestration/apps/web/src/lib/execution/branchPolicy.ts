function slugPart(s: string, max: number): string {
  const x = String(s ?? "")
    .replace(/[^\w\uAC00-\uD7A3-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .toLowerCase();
  return x || "task";
}

export type BranchPlan = {
  branchName: string;
  /** true면 새 브랜치를 만들지 않고 base만 체크아웃 */
  manualStayOnBase: boolean;
};

/**
 * execution setup 전략에 따른 작업 브랜치 이름.
 * - manual: baseBranch 유지
 * - feature-per-workflow: orch/{prefix}/w-{projectSlug}
 * - feature-per-task: orch/{prefix}/t-{shortId}-{titleSlug}
 */
export function computeExecutionBranchPlan(params: {
  branchStrategy: string;
  branchPrefix: string | null;
  projectId: string;
  taskId: string;
  taskTitle: string;
  baseBranch: string;
}): BranchPlan {
  const base = String(params.baseBranch ?? "").trim() || "main";
  const prefix = String(params.branchPrefix ?? "orch")
    .trim()
    .replace(/[^\w/-]/g, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 40) || "orch";

  if (params.branchStrategy === "manual") {
    return { branchName: base, manualStayOnBase: true };
  }

  if (params.branchStrategy === "feature-per-workflow") {
    const wid = slugPart(params.projectId.replace(/-/g, ""), 24);
    return { branchName: `${prefix}/w-${wid}`, manualStayOnBase: false };
  }

  const shortId = params.taskId.replace(/-/g, "").slice(0, 10);
  const title = slugPart(params.taskTitle, 24);
  return { branchName: `${prefix}/t-${shortId}-${title}`, manualStayOnBase: false };
}
