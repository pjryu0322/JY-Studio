import { resolveCodeTaskWorkBranchForPlan } from "@/lib/prototype/codeTaskDisplayNameNormalize";

function slugifyCodeTaskId(codeTaskId: string): string {
  return codeTaskId
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function wipBranchFromSlug(slug: string): string {
  const normalized = slug.trim().replace(/^-+|-+$/g, "");
  return `wip/cursor/${normalized || "task"}`;
}

/** sample-data ↔ legacy mock WIP branch aliases (P3-M30 rename 호환). */
export function buildSampleDataMockBranchAliases(slug: string): readonly string[] {
  const s = slug.trim().replace(/^-+|-+$/g, "");
  if (!s) return [];
  const out: string[] = [];
  if (s.includes("sample-data")) {
    out.push(wipBranchFromSlug(s.replace(/sample-data/g, "mock")));
  } else if (s.includes("mock")) {
    out.push(wipBranchFromSlug(s.replace(/mock/g, "sample-data")));
  }
  return out;
}

function slugifyCodeTaskIdForBranchMatch(codeTaskId: string): string {
  return slugifyCodeTaskId(codeTaskId);
}

/** WIP branch가 codeTaskId(및 mock↔sample-data alias)와 일치하는지 — commit message에 ID가 없어도 branch SoT로 인정 */
export function branchMatchesCodeTaskIdentity(input: {
  readonly branch: string;
  readonly taskId: string;
  readonly codeTaskId?: string | null;
}): boolean {
  const branchLower = String(input.branch ?? "").trim().toLowerCase();
  if (!branchLower) return false;

  const taskSlug = slugifyCodeTaskIdForBranchMatch(input.taskId);
  if (taskSlug && branchLower.includes(taskSlug)) return true;

  const codeTaskId = String(input.codeTaskId ?? "").trim();
  if (!codeTaskId) return false;

  const codeTaskSlug = slugifyCodeTaskIdForBranchMatch(codeTaskId);
  if (codeTaskSlug && branchLower.includes(codeTaskSlug)) return true;

  const canonical = resolveCodeTaskWorkBranchForPlan(codeTaskId, null).toLowerCase();
  if (branchLower === canonical) return true;

  for (const alias of buildSampleDataMockBranchAliases(codeTaskSlug)) {
    if (branchLower === alias.toLowerCase()) return true;
  }

  return false;
}

export type TaskCursorGithubBranchSource =
  | "branch_plan"
  | "run"
  | "request"
  | "legacy_fallback";

export function resolveBranchSourceForCandidate(input: {
  readonly branch: string;
  readonly branchPlanWorkBranch?: string | null;
  readonly runWorkBranch?: string | null;
  readonly executionWorkBranch?: string | null;
  readonly promptWorkBranch?: string | null;
  readonly codeTaskId?: string | null;
}): TaskCursorGithubBranchSource {
  const b = String(input.branch ?? "").trim();
  const plan = String(input.branchPlanWorkBranch ?? "").trim();
  if (plan && b === plan) return "branch_plan";
  const run = String(input.runWorkBranch ?? "").trim();
  if (run && b === run) return "run";
  const exec = String(input.executionWorkBranch ?? "").trim();
  const prompt = String(input.promptWorkBranch ?? "").trim();
  if ((exec && b === exec) || (prompt && b === prompt)) return "request";
  return "legacy_fallback";
}

export function buildTaskCursorGithubBranchCandidates(input: {
  readonly codeTaskId?: string | null;
  readonly branchPlanWorkBranch?: string | null;
  readonly executionWorkBranch?: string | null;
  readonly runWorkBranch?: string | null;
  readonly promptWorkBranch?: string | null;
}): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (branch: string | null | undefined) => {
    const b = String(branch ?? "").trim();
    if (!b || seen.has(b)) return;
    seen.add(b);
    ordered.push(b);
  };

  push(input.branchPlanWorkBranch);
  push(input.runWorkBranch);
  push(input.executionWorkBranch);
  push(input.promptWorkBranch);

  const codeTaskId = String(input.codeTaskId ?? "").trim();
  if (codeTaskId) {
    const slug = slugifyCodeTaskId(codeTaskId);
    push(wipBranchFromSlug(slug));
    push(resolveCodeTaskWorkBranchForPlan(codeTaskId, null));
    for (const alias of buildSampleDataMockBranchAliases(slug)) {
      push(alias);
    }
  }

  return ordered;
}
