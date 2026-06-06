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

export function buildTaskCursorGithubBranchCandidates(input: {
  readonly codeTaskId?: string | null;
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

  push(input.runWorkBranch);
  push(input.executionWorkBranch);
  push(input.promptWorkBranch);

  const codeTaskId = String(input.codeTaskId ?? "").trim();
  if (codeTaskId) {
    push(resolveCodeTaskWorkBranchForPlan(codeTaskId, null));
    const slug = slugifyCodeTaskId(codeTaskId);
    push(wipBranchFromSlug(slug));
    for (const alias of buildSampleDataMockBranchAliases(slug)) {
      push(alias);
    }
  }

  return ordered;
}
