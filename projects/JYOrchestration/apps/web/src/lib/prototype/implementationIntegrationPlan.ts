import type {
  CompletedCodeTaskIntegrationTarget,
  ExcludedCodeTaskIntegrationTarget,
} from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { IntegrationCheckResultV1 } from "@/lib/prototype/implementationIntegrationCheckService";

export const CODE_TASK_INTEGRATION_PLAN_VERSION = "code_task_integration_plan_v1" as const;

export type CodeTaskIntegrationPlanStatus =
  | "draft"
  | "branch_creating"
  | "integrating"
  | "conflict"
  | "build_checking"
  | "preview_ready"
  | "pr_ready"
  | "failed";

export type CodeTaskIntegrationPlanItemV1 = Readonly<{
  readonly runId: string;
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly title: string;
  readonly workBranch: string;
  readonly commitSha: string;
  readonly order: number;
}>;

export type CodeTaskIntegrationExcludedReason =
  | "not_completed"
  | "quality_not_passed"
  | "missing_branch"
  | "missing_commit"
  | "failed"
  | "skipped"
  | "blocked";

export type CodeTaskIntegrationExcludedItemV1 = Readonly<{
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly title: string;
  readonly reason: CodeTaskIntegrationExcludedReason;
}>;

export type CodeTaskIntegrationMergeResultV1 = Readonly<{
  readonly codeTaskId: string;
  readonly workBranch: string;
  readonly commitSha: string;
  readonly status: "merged" | "conflict" | "skipped" | "failed";
  readonly mergeCommitSha?: string | null;
  readonly conflictFiles?: readonly string[] | null;
  readonly message?: string | null;
}>;

export type CodeTaskIntegrationPlanV1 = Readonly<{
  readonly version: typeof CODE_TASK_INTEGRATION_PLAN_VERSION;
  readonly projectId: string;
  readonly targetRepository: string;
  readonly baseBranch: string;
  readonly integrationBranch: string;
  readonly createdAt: string;
  readonly baseCommitSha?: string | null;
  readonly included: readonly CodeTaskIntegrationPlanItemV1[];
  readonly excluded: readonly CodeTaskIntegrationExcludedItemV1[];
  readonly strategy: "merge" | "cherry_pick";
  readonly status: CodeTaskIntegrationPlanStatus;
  readonly mergeResults?: readonly CodeTaskIntegrationMergeResultV1[];
  readonly checkResult?: IntegrationCheckResultV1 | null;
  readonly pullRequestUrl?: string | null;
  readonly pullRequestNumber?: number | null;
  readonly failureMessage?: string | null;
  readonly conflictCodeTaskId?: string | null;
}>;

function mapExcludedReason(
  reason: ExcludedCodeTaskIntegrationTarget["reason"],
): CodeTaskIntegrationExcludedReason {
  switch (reason) {
    case "not_started":
    case "queued":
    case "prompt_ready":
      return "not_completed";
    case "cursor_running":
    case "github_verifying":
      return "not_completed";
    case "failed":
      return "failed";
    case "blocked_by_dependency":
      return "blocked";
    case "cancelled":
      return "skipped";
    case "quality_not_passed":
      return "quality_not_passed";
    case "missing_branch":
      return "missing_branch";
    case "missing_commit":
      return "missing_commit";
    default:
      return "not_completed";
  }
}

export function buildIntegrationBranchName(input: {
  readonly projectId: string;
  readonly now?: Date;
}): string {
  const now = input.now ?? new Date();
  const pid = input.projectId.trim().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 12) || "project";
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `integration/${pid}-${y}${m}${d}-${hh}${mm}`;
}

export function orderIntegrationTargets(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly runIdByCodeTaskId?: ReadonlyMap<string, string>;
}): readonly CompletedCodeTaskIntegrationTarget[] {
  const included = [...input.included];
  const orderIndex = new Map<string, number>();
  const selected = (input.selectedCodeTaskIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (selected.length) {
    selected.forEach((id, idx) => orderIndex.set(id, idx));
  } else {
    for (const [idx, task] of (input.codeTaskPlan?.tasks ?? []).entries()) {
      orderIndex.set(task.codeTaskId, idx);
    }
  }
  included.sort((a, b) => {
    const ai = orderIndex.get(a.codeTaskId) ?? Number.MAX_SAFE_INTEGER;
    const bi = orderIndex.get(b.codeTaskId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
  return included;
}

export function buildCodeTaskIntegrationPlanDraft(input: {
  readonly projectId: string;
  readonly targetRepository: string;
  readonly baseBranch: string;
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly excluded: readonly ExcludedCodeTaskIntegrationTarget[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly runIdByCodeTaskId?: ReadonlyMap<string, string>;
  readonly nowIso?: string;
}): CodeTaskIntegrationPlanV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const ordered = orderIntegrationTargets({
    included: input.included,
    codeTaskPlan: input.codeTaskPlan,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    runIdByCodeTaskId: input.runIdByCodeTaskId,
  });

  const includedItems: CodeTaskIntegrationPlanItemV1[] = ordered.map((row, index) => ({
    runId: input.runIdByCodeTaskId?.get(row.codeTaskId) ?? row.codeTaskId,
    processTaskId: row.taskId,
    codeTaskId: row.codeTaskId,
    title: row.title,
    workBranch: String(row.workBranch ?? "").trim(),
    commitSha: String(row.commitSha ?? "").trim(),
    order: index + 1,
  }));

  const excludedItems: CodeTaskIntegrationExcludedItemV1[] = input.excluded.map((row) => ({
    processTaskId: row.taskId,
    codeTaskId: row.codeTaskId,
    title: row.title,
    reason: mapExcludedReason(row.reason),
  }));

  return {
    version: CODE_TASK_INTEGRATION_PLAN_VERSION,
    projectId: input.projectId.trim(),
    targetRepository: input.targetRepository.trim(),
    baseBranch: input.baseBranch.trim() || "main",
    integrationBranch: buildIntegrationBranchName({ projectId: input.projectId, now: new Date(nowIso) }),
    createdAt: nowIso,
    included: includedItems,
    excluded: excludedItems,
    strategy: "merge",
    status: "draft",
  };
}

export function parseCodeTaskIntegrationPlanV1(raw: unknown): CodeTaskIntegrationPlanV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== CODE_TASK_INTEGRATION_PLAN_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const integrationBranch = String(o.integrationBranch ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  if (!projectId || !integrationBranch || !createdAt) return null;

  const status = String(o.status ?? "draft") as CodeTaskIntegrationPlanStatus;

  return {
    version: CODE_TASK_INTEGRATION_PLAN_VERSION,
    projectId,
    targetRepository: String(o.targetRepository ?? "").trim(),
    baseBranch: String(o.baseBranch ?? "main").trim() || "main",
    integrationBranch,
    createdAt,
    ...(o.baseCommitSha ? { baseCommitSha: String(o.baseCommitSha).trim() } : {}),
    included: Array.isArray(o.included) ? (o.included as CodeTaskIntegrationPlanItemV1[]) : [],
    excluded: Array.isArray(o.excluded) ? (o.excluded as CodeTaskIntegrationExcludedItemV1[]) : [],
    strategy: o.strategy === "cherry_pick" ? "cherry_pick" : "merge",
    status,
    ...(Array.isArray(o.mergeResults) ? { mergeResults: o.mergeResults as CodeTaskIntegrationMergeResultV1[] } : {}),
    ...(o.checkResult ? { checkResult: o.checkResult as IntegrationCheckResultV1 } : {}),
    ...(o.pullRequestUrl ? { pullRequestUrl: String(o.pullRequestUrl).trim() } : {}),
    ...(typeof o.pullRequestNumber === "number" ? { pullRequestNumber: o.pullRequestNumber } : {}),
    ...(o.failureMessage ? { failureMessage: String(o.failureMessage).trim() } : {}),
    ...(o.conflictCodeTaskId ? { conflictCodeTaskId: String(o.conflictCodeTaskId).trim() } : {}),
  };
}

export function patchCodeTaskIntegrationPlan(
  plan: CodeTaskIntegrationPlanV1,
  patch: Partial<Omit<CodeTaskIntegrationPlanV1, "version" | "projectId">>,
): CodeTaskIntegrationPlanV1 {
  return { ...plan, ...patch };
}
