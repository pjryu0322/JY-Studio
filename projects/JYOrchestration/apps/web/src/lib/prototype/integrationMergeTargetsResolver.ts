import type { ImplementationBranchTopologyV1 } from "@/lib/prototype/implementationBranchTopology";
import { INTEGRATION_FINAL_WIRING_WORK_BRANCH } from "@/lib/prototype/implementationIntegrationStep";

export type IntegrationBranchTopologyKindV1 =
  | "linear_chain"
  | "parallel_branches"
  | "mixed"
  | "unknown";

export type IntegrationMergeStrategyV1 =
  | "merge_effective_chain_head_only"
  | "merge_unique_branches_in_topology_order"
  | "blocked_requires_manual_resolution";

export type IntegrationMergeTargetsResultV1 = Readonly<{
  readonly strategy: IntegrationMergeStrategyV1;
  readonly mergeTargets: readonly string[];
  readonly skippedBranches: readonly string[];
  readonly reason: string;
  readonly sourceBranches: readonly string[];
  readonly uniqueSourceBranchCount: number;
}>;

export function mapImplementationBranchTopologyKind(
  topology: ImplementationBranchTopologyV1 | null | undefined,
): IntegrationBranchTopologyKindV1 {
  if (!topology) return "unknown";
  if (topology.kind === "linear_chain") return "linear_chain";
  if (topology.kind === "parallel_groups") return "parallel_branches";
  if (topology.kind === "mixed") return "mixed";
  return "unknown";
}

export function dedupeSourceBranchesPreserveOrder(branches: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of branches) {
    const branch = String(raw ?? "").trim();
    if (!branch || seen.has(branch)) continue;
    seen.add(branch);
    out.push(branch);
  }
  return out;
}

export function isIntegrationOrchestrationMergeBranch(
  branch: string | null | undefined,
  integrationBranch?: string | null,
): boolean {
  const b = String(branch ?? "").trim();
  if (!b) return true;
  const integration = String(integrationBranch ?? "").trim();
  if (integration && b === integration) return true;
  if (b === INTEGRATION_FINAL_WIRING_WORK_BRANCH) return true;
  return b.startsWith("wip/integration/") || b.startsWith("integration/");
}

export function resolveIntegrationMergeTargets(input: {
  readonly topology: IntegrationBranchTopologyKindV1;
  readonly effectiveSourceBranch?: string | null;
  readonly topologyChainHead?: string | null;
  readonly sourceBranches: readonly string[];
  readonly integrationBranch?: string | null;
  readonly baseBranch?: string | null;
  readonly orderedBranches?: readonly string[];
}): IntegrationMergeTargetsResultV1 {
  const integrationBranch = String(input.integrationBranch ?? "").trim() || null;
  const sourceBranches = dedupeSourceBranchesPreserveOrder(
    input.sourceBranches.filter((b) => !isIntegrationOrchestrationMergeBranch(b, integrationBranch)),
  );
  const ordered = dedupeSourceBranchesPreserveOrder(input.orderedBranches ?? []);

  const pickHeadForLinearChain = (): string | null => {
    const effective = String(input.effectiveSourceBranch ?? "").trim();
    if (effective && !isIntegrationOrchestrationMergeBranch(effective, integrationBranch)) {
      return effective;
    }
    const chainHead = String(input.topologyChainHead ?? "").trim();
    if (chainHead && !isIntegrationOrchestrationMergeBranch(chainHead, integrationBranch)) {
      if (sourceBranches.includes(chainHead)) return chainHead;
    }
    return sourceBranches[sourceBranches.length - 1] ?? null;
  };

  if (input.topology === "linear_chain") {
    const head = pickHeadForLinearChain();
    if (!head) {
      return {
        strategy: "blocked_requires_manual_resolution",
        mergeTargets: [],
        skippedBranches: sourceBranches,
        reason: "linear_chain_missing_effective_head",
        sourceBranches,
        uniqueSourceBranchCount: sourceBranches.length,
      };
    }
    return {
      strategy: "merge_effective_chain_head_only",
      mergeTargets: [head],
      skippedBranches: sourceBranches.filter((b) => b !== head),
      reason: "linear_chain_head_contains_prior_branch_changes",
      sourceBranches,
      uniqueSourceBranchCount: sourceBranches.length,
    };
  }

  if (input.topology === "parallel_branches" || input.topology === "mixed") {
    const mergeTargets =
      ordered.length > 0
        ? ordered.filter((b) => sourceBranches.includes(b))
        : sourceBranches;
    return {
      strategy: "merge_unique_branches_in_topology_order",
      mergeTargets,
      skippedBranches: sourceBranches.filter((b) => !mergeTargets.includes(b)),
      reason: "merge_unique_work_branches_in_topology_order",
      sourceBranches,
      uniqueSourceBranchCount: sourceBranches.length,
    };
  }

  const effective = String(input.effectiveSourceBranch ?? "").trim();
  if (effective && sourceBranches.includes(effective)) {
    return {
      strategy: "merge_effective_chain_head_only",
      mergeTargets: [effective],
      skippedBranches: sourceBranches.filter((b) => b !== effective),
      reason: "unknown_topology_effective_source_only",
      sourceBranches,
      uniqueSourceBranchCount: sourceBranches.length,
    };
  }

  return {
    strategy: "merge_unique_branches_in_topology_order",
    mergeTargets: sourceBranches,
    skippedBranches: [],
    reason: "unknown_topology_merge_all_unique_sources",
    sourceBranches,
    uniqueSourceBranchCount: sourceBranches.length,
  };
}

export function buildDiagnosticSourceBranches(input: {
  readonly includedWorkBranches: readonly string[];
  readonly topology: ImplementationBranchTopologyV1 | null | undefined;
  readonly integrationBranch?: string | null;
}): readonly string[] {
  const fromIncluded = dedupeSourceBranchesPreserveOrder(input.includedWorkBranches).filter(
    (b) => !isIntegrationOrchestrationMergeBranch(b, input.integrationBranch),
  );
  if (input.topology?.kind === "linear_chain") {
    return dedupeSourceBranchesPreserveOrder([
      ...input.topology.orderedBranches,
      ...fromIncluded,
    ]);
  }
  return fromIncluded;
}
