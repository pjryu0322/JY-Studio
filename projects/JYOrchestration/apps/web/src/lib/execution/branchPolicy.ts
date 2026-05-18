import { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";

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

/** ENV_TEST Hello World 연결 테스트 브랜치 접두사 (`<prefix><8hex>`) */
export const ENV_TEST_HELLO_WORLD_BRANCH_PREFIX = "envcheck/t-hello-world-" as const;

/** GitHub 웹훅·루프에서 Hello World ENV_TEST 브랜치만 매칭 */
export function isEnvTestHelloWorldBranchName(branchName: string): boolean {
  const b = String(branchName ?? "").trim();
  return (
    b.startsWith(ENV_TEST_HELLO_WORLD_BRANCH_PREFIX) &&
    /^envcheck\/t-hello-world-[0-9a-f]{8}$/i.test(b)
  );
}

/**
 * execution setup 전략에 따른 작업 브랜치 이름.
 * - taskKind === ENV_TEST | ENV_TEST_STAGE2 → 아래 첫 분기만 적용(Hello World 전용 이름). 그 외는 일반 Task 규칙.
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
  /** 환경 연결 테스트 Task 전용 브랜치 (일반 feature 브랜치와 구분) */
  taskKind?: string | null;
}): BranchPlan {
  // ENV_TEST / Stage2: 동일 Hello World 브랜치 계약.
  const tk = String(params.taskKind ?? "").trim();
  if (tk === ENV_TEST_TASK_KIND || tk === ENV_TEST_STAGE2_TASK_KIND) {
    const shortId = params.taskId.replace(/-/g, "").slice(0, 8) || "test";
    return { branchName: `${ENV_TEST_HELLO_WORLD_BRANCH_PREFIX}${shortId}`, manualStayOnBase: false };
  }

  // Normal-task-only: feature/manual 전략.
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
