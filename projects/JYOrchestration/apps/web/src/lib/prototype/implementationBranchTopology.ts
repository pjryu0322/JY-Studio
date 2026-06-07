import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  DEFAULT_BRANCH_PLAN_EXECUTION_ORDER,
  type CodeTaskBranchGroupV1,
} from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";

export type ImplementationBranchTopologyV1 =
  | Readonly<{
      readonly kind: "linear_chain";
      readonly orderedBranches: readonly string[];
      readonly chainHead: string;
      readonly baseBranch: string;
      readonly branchGroups: readonly string[];
    }>
  | Readonly<{
      readonly kind: "parallel_groups";
      readonly baseGroups: readonly Readonly<{
        readonly baseBranch: string;
        readonly workBranches: readonly string[];
      }>[];
    }>
  | Readonly<{
      readonly kind: "mixed";
      readonly linearSegments: readonly (readonly string[])[];
      readonly parallelGroups: readonly Readonly<{
        readonly baseBranch: string;
        readonly workBranches: readonly string[];
      }>[];
    }>
  | Readonly<{
      readonly kind: "invalid";
      readonly reason: string;
    }>;

type GroupBranchRow = Readonly<{
  readonly branchGroup: string;
  readonly workBranch: string;
  readonly baseBranch: string;
}>;

function collectGroupBranchRows(plan: ImplementationCodeTaskPlanV1 | null): readonly GroupBranchRow[] {
  if (!plan?.tasks.length) return [];
  const implPlan = plan.implementationBranchPlanV1;
  if (implPlan?.groups?.length) {
    const order = implPlan.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
    const rank = new Map(order.map((g, i) => [g, i] as const));
    return [...implPlan.groups]
      .sort((a, b) => (rank.get(a.groupId as CodeTaskBranchGroupV1) ?? 99) - (rank.get(b.groupId as CodeTaskBranchGroupV1) ?? 99))
      .map((g) => ({
        branchGroup: String(g.groupId),
        workBranch: String(g.workBranch ?? "").trim(),
        baseBranch: String(g.baseBranch ?? "").trim(),
      }))
      .filter((g) => g.workBranch);
  }

  const byGroup = new Map<string, GroupBranchRow>();
  for (const task of plan.tasks) {
    const bp = parseCodeTaskBranchPlanV1(task.branchPlan);
    if (!bp?.workBranch?.trim() || !bp.branchGroup) continue;
    if (!byGroup.has(bp.branchGroup)) {
      byGroup.set(bp.branchGroup, {
        branchGroup: bp.branchGroup,
        workBranch: bp.workBranch.trim(),
        baseBranch: String(bp.baseBranch ?? "").trim(),
      });
    }
  }
  const order = DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
  return order
    .map((g) => byGroup.get(g))
    .filter((row): row is GroupBranchRow => Boolean(row));
}

function isLinearChain(rows: readonly GroupBranchRow[], rootBase: string): boolean {
  if (rows.length < 2) return rows.length === 1;
  let expectedBase = rootBase.trim() || "main";
  for (const row of rows) {
    if (row.baseBranch !== expectedBase) return false;
    expectedBase = row.workBranch;
  }
  return true;
}

function buildParallelGroups(
  rows: readonly GroupBranchRow[],
): readonly Readonly<{ readonly baseBranch: string; readonly workBranches: readonly string[] }>[] {
  const byBase = new Map<string, Set<string>>();
  for (const row of rows) {
    const base = row.baseBranch || "main";
    const set = byBase.get(base) ?? new Set<string>();
    set.add(row.workBranch);
    byBase.set(base, set);
  }
  return [...byBase.entries()].map(([baseBranch, workBranches]) => ({
    baseBranch,
    workBranches: [...workBranches],
  }));
}

export function analyzeImplementationBranchTopology(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly completedCodeTaskIds?: readonly string[];
}): ImplementationBranchTopologyV1 {
  const rows = collectGroupBranchRows(input.codeTaskPlan);
  if (!rows.length) {
    return { kind: "invalid", reason: "branch_plan_missing" };
  }

  const rootBase =
    input.codeTaskPlan?.implementationBranchPlanV1?.baseBranch?.trim() ||
    rows[0]?.baseBranch ||
    "main";

  const orderedBranches = rows.map((r) => r.workBranch);
  const branchGroups = rows.map((r) => r.branchGroup);

  if (isLinearChain(rows, rootBase)) {
    return {
      kind: "linear_chain",
      orderedBranches,
      chainHead: orderedBranches[orderedBranches.length - 1]!,
      baseBranch: rootBase,
      branchGroups,
    };
  }

  const parallelGroups = buildParallelGroups(rows);
  const hasParallel = parallelGroups.some((g) => g.workBranches.length > 1);
  if (!hasParallel) {
    return {
      kind: "invalid",
      reason: "branch_chain_broken",
    };
  }

  return {
    kind: "parallel_groups",
    baseGroups: parallelGroups,
  };
}

export function branchPairOnLinearChain(input: {
  readonly topology: ImplementationBranchTopologyV1;
  readonly branchA: string;
  readonly branchB: string;
}): boolean {
  if (input.topology.kind !== "linear_chain") return false;
  const a = input.branchA.trim();
  const b = input.branchB.trim();
  const order = input.topology.orderedBranches;
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return ia !== ib;
}

export function resolveIntegrationSourceBranchForTopology(input: {
  readonly topology: ImplementationBranchTopologyV1;
}): string | null {
  if (input.topology.kind === "linear_chain") return input.topology.chainHead;
  return null;
}
