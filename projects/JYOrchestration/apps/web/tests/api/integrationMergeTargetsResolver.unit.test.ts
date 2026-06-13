import { describe, expect, it } from "vitest";
import {
  buildDiagnosticSourceBranches,
  dedupeSourceBranchesPreserveOrder,
  resolveIntegrationMergeTargets,
} from "@/lib/prototype/integrationMergeTargetsResolver";
import type { ImplementationBranchTopologyV1 } from "@/lib/prototype/implementationBranchTopology";

describe("resolveIntegrationMergeTargets", () => {
  it("uses only effectiveSourceBranch as merge target for linear_chain topology", () => {
    const result = resolveIntegrationMergeTargets({
      topology: "linear_chain",
      effectiveSourceBranch: "wip/screen/workspace",
      sourceBranches: [
        "wip/foundation/app-shell",
        "wip/data/sample-data",
        "wip/common/components",
        "wip/feature/core-flow",
        "wip/screen/workspace",
      ],
      integrationBranch: "wip/integration/final-wiring",
      baseBranch: "main",
    });

    expect(result.strategy).toBe("merge_effective_chain_head_only");
    expect(result.mergeTargets).toEqual(["wip/screen/workspace"]);
  });

  it("skips intermediate branches for linear_chain topology", () => {
    const result = resolveIntegrationMergeTargets({
      topology: "linear_chain",
      effectiveSourceBranch: "wip/screen/workspace",
      sourceBranches: [
        "wip/foundation/app-shell",
        "wip/data/sample-data",
        "wip/common/components",
        "wip/feature/core-flow",
        "wip/screen/workspace",
      ],
      integrationBranch: "integration/test",
      baseBranch: "main",
    });

    expect(result.skippedBranches).toEqual([
      "wip/foundation/app-shell",
      "wip/data/sample-data",
      "wip/common/components",
      "wip/feature/core-flow",
    ]);
  });

  it("excludes integration branch from merge targets when chain head is mis-set", () => {
    const result = resolveIntegrationMergeTargets({
      topology: "linear_chain",
      effectiveSourceBranch: "wip/screen/workspace",
      topologyChainHead: "wip/integration/final-wiring",
      sourceBranches: ["wip/data/sample-data", "wip/screen/workspace"],
      integrationBranch: "wip/integration/final-wiring",
      baseBranch: "main",
    });

    expect(result.mergeTargets).toEqual(["wip/screen/workspace"]);
  });

  it("merges unique branches in topology order for parallel_branches", () => {
    const result = resolveIntegrationMergeTargets({
      topology: "parallel_branches",
      sourceBranches: ["wip/feature/b", "wip/feature/a", "wip/feature/b"],
      orderedBranches: ["wip/feature/a", "wip/feature/b"],
      integrationBranch: "integration/test",
      baseBranch: "main",
    });

    expect(result.strategy).toBe("merge_unique_branches_in_topology_order");
    expect(result.mergeTargets).toEqual(["wip/feature/a", "wip/feature/b"]);
  });

  it("deduplicates repeated work branches before merge target resolution", () => {
    const branches = dedupeSourceBranchesPreserveOrder([
      "wip/data/sample-data",
      "wip/data/sample-data",
      "wip/screen/workspace",
    ]);
    expect(branches).toEqual(["wip/data/sample-data", "wip/screen/workspace"]);

    const result = resolveIntegrationMergeTargets({
      topology: "linear_chain",
      effectiveSourceBranch: "wip/screen/workspace",
      sourceBranches: branches,
      integrationBranch: "integration/test",
      baseBranch: "main",
    });
    expect(result.uniqueSourceBranchCount).toBe(2);
    expect(result.mergeTargets).toEqual(["wip/screen/workspace"]);
  });
});

describe("buildDiagnosticSourceBranches", () => {
  it("keeps foundation branch in diagnostic source branches when topology lists it", () => {
    const topology: ImplementationBranchTopologyV1 = {
      kind: "linear_chain",
      orderedBranches: [
        "wip/foundation/app-shell",
        "wip/data/sample-data",
        "wip/common/components",
        "wip/feature/core-flow",
        "wip/screen/workspace",
      ],
      chainHead: "wip/screen/workspace",
      baseBranch: "main",
      branchGroups: ["foundation", "data", "common", "feature", "screen"],
    };
    const diagnostic = buildDiagnosticSourceBranches({
      includedWorkBranches: [
        "wip/data/sample-data",
        "wip/screen/workspace",
        "wip/common/components",
      ],
      topology,
      integrationBranch: "wip/integration/final-wiring",
    });
    expect(diagnostic).toContain("wip/foundation/app-shell");
    expect(diagnostic).toContain("wip/screen/workspace");
  });
});
