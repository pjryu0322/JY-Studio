import { buildBranchWorkPrincipleLines } from "@/lib/prototype/codeTaskDeveloperPromptTemplate";

export const IMPLEMENTATION_BRANCH_PLAN_VERSION = "implementation_branch_plan_v1" as const;

export type CodeTaskBranchGroupV1 =
  | "foundation"
  | "data"
  | "common"
  | "feature"
  | "screen"
  | "integration";

export type CodeTaskBaseBranchPolicyV1 =
  | "main"
  | "previous_group"
  | "foundation"
  | "same_group"
  | "integration";

export type CodeTaskBranchExecutionModeV1 =
  | "sequential"
  | "parallel_safe"
  | "integration_only";

export type CodeTaskBranchPlanV1 = Readonly<{
  readonly branchGroup: CodeTaskBranchGroupV1;
  readonly workBranch: string;
  readonly baseBranchPolicy: CodeTaskBaseBranchPolicyV1;
  readonly baseBranch: string;
  readonly executionMode: CodeTaskBranchExecutionModeV1;
  readonly dependsOnBranchGroups?: readonly CodeTaskBranchGroupV1[];
  readonly requiresIntegrationChange?: boolean;
}>;

export type ImplementationBranchPlanGroupV1 = Readonly<{
  readonly groupId: CodeTaskBranchGroupV1;
  readonly title: string;
  readonly workBranch: string;
  readonly baseBranch: string;
  readonly codeTaskIds: readonly string[];
  readonly policy: "sequential" | "parallel_safe" | "integration_only";
  readonly ownedFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
  readonly conflictGroupIds: readonly string[];
}>;

export type ImplementationBranchPlanV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_BRANCH_PLAN_VERSION;
  readonly projectId: string;
  readonly targetRepository?: string | null;
  readonly baseBranch: string;
  readonly createdAt: string;
  readonly groups: readonly ImplementationBranchPlanGroupV1[];
  readonly executionOrder: readonly CodeTaskBranchGroupV1[];
}>;

export const DEFAULT_BRANCH_PLAN_EXECUTION_ORDER: readonly CodeTaskBranchGroupV1[] = [
  "foundation",
  "data",
  "common",
  "feature",
  "screen",
  "integration",
] as const;

export const DEFAULT_WORK_BRANCH_BY_GROUP: Readonly<Record<CodeTaskBranchGroupV1, string>> = {
  foundation: "wip/foundation/app-shell",
  data: "wip/data/sample-data",
  common: "wip/common/components",
  feature: "wip/feature/core-flow",
  screen: "wip/screen/workspace",
  integration: "wip/integration/final-wiring",
};

export function parseCodeTaskBranchPlanV1(raw: unknown): CodeTaskBranchPlanV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const group = String(o.branchGroup ?? "").trim() as CodeTaskBranchGroupV1;
  if (!DEFAULT_BRANCH_PLAN_EXECUTION_ORDER.includes(group)) return null;
  const workBranch = String(o.workBranch ?? "").trim();
  const baseBranch = String(o.baseBranch ?? "").trim();
  if (!workBranch || !baseBranch) return null;
  const policy = String(o.baseBranchPolicy ?? "main").trim() as CodeTaskBaseBranchPolicyV1;
  const mode = String(o.executionMode ?? "sequential").trim() as CodeTaskBranchExecutionModeV1;
  return {
    branchGroup: group,
    workBranch,
    baseBranch,
    baseBranchPolicy: policy,
    executionMode: mode,
    ...(Array.isArray(o.dependsOnBranchGroups)
      ? {
          dependsOnBranchGroups: (o.dependsOnBranchGroups as unknown[])
            .map(String)
            .filter(Boolean) as CodeTaskBranchGroupV1[],
        }
      : {}),
    ...(o.requiresIntegrationChange === true ? { requiresIntegrationChange: true } : {}),
  };
}

export function parseImplementationBranchPlanV1(raw: unknown): ImplementationBranchPlanV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_BRANCH_PLAN_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const baseBranch = String(o.baseBranch ?? "main").trim() || "main";
  if (!projectId) return null;
  const executionOrder = Array.isArray(o.executionOrder)
    ? (o.executionOrder as unknown[])
        .map(String)
        .filter((g): g is CodeTaskBranchGroupV1 =>
          DEFAULT_BRANCH_PLAN_EXECUTION_ORDER.includes(g as CodeTaskBranchGroupV1),
        )
    : [...DEFAULT_BRANCH_PLAN_EXECUTION_ORDER];
  const groups: ImplementationBranchPlanGroupV1[] = [];
  if (Array.isArray(o.groups)) {
    for (const row of o.groups) {
      if (!row || typeof row !== "object") continue;
      const g = row as Record<string, unknown>;
      const groupId = String(g.groupId ?? "").trim() as CodeTaskBranchGroupV1;
      if (!DEFAULT_BRANCH_PLAN_EXECUTION_ORDER.includes(groupId)) continue;
      groups.push({
        groupId,
        title: String(g.title ?? groupId),
        workBranch: String(g.workBranch ?? "").trim(),
        baseBranch: String(g.baseBranch ?? baseBranch).trim(),
        codeTaskIds: Array.isArray(g.codeTaskIds)
          ? (g.codeTaskIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
          : [],
        policy:
          g.policy === "parallel_safe" || g.policy === "integration_only"
            ? g.policy
            : "sequential",
        ownedFiles: Array.isArray(g.ownedFiles)
          ? (g.ownedFiles as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
          : [],
        forbiddenFiles: Array.isArray(g.forbiddenFiles)
          ? (g.forbiddenFiles as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
          : [],
        conflictGroupIds: Array.isArray(g.conflictGroupIds)
          ? (g.conflictGroupIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
          : [],
      });
    }
  }
  return {
    version: IMPLEMENTATION_BRANCH_PLAN_VERSION,
    projectId,
    baseBranch,
    createdAt: String(o.createdAt ?? new Date().toISOString()),
    groups,
    executionOrder,
    ...(typeof o.targetRepository === "string" ? { targetRepository: o.targetRepository } : {}),
  };
}

export function buildCodeTaskBranchPlanPromptSections(
  branchPlan: CodeTaskBranchPlanV1 | null | undefined,
): string[] {
  if (!branchPlan) return [];
  return [
    "",
    "## Branch Plan",
    "",
    `- branch group: \`${branchPlan.branchGroup}\``,
    `- work branch: \`${branchPlan.workBranch}\``,
    `- base branch: \`${branchPlan.baseBranch}\``,
    `- execution mode: \`${branchPlan.executionMode}\``,
    "",
    "## Branch 작업 원칙",
    ...buildBranchWorkPrincipleLines(branchPlan).map((line) => line),
  ];
}

export function summarizeBranchPlanForUi(
  branchPlan: ImplementationBranchPlanV1 | null | undefined,
): readonly string[] {
  if (!branchPlan?.groups.length) return ["Branch Plan이 없습니다. 실행 전 Branch Plan 보정이 필요합니다."];
  return branchPlan.executionOrder
    .map((groupId, index) => {
      const g = branchPlan.groups.find((row) => row.groupId === groupId);
      if (!g) return null;
      return `${index + 1}. ${g.groupId} · ${g.workBranch} · ${g.codeTaskIds.length} Task`;
    })
    .filter(Boolean) as string[];
}
