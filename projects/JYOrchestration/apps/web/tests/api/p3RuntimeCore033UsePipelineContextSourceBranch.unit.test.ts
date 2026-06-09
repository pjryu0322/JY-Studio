import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import {
  resolveEffectiveIntegrationSourceBranch,
} from "@/lib/prototype/integrationEffectiveSourceBranch";
import { toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import { IntegrationPipelineDomainError } from "@/lib/prototype/implementationIntegrationErrors";
import {
  buildImplementationRuntimeSnapshot,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";

const PID = "p-runtime-core-033";
const NOW = "2026-06-08T12:00:00.000Z";
const INCLUDED = ["wip/common/components", "wip/feature/core-flow", "wip/screen/workspace"] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");

function regressionSnapshot() {
  const units = Array.from({ length: 3 }, (_, i) => ({
    unitId: `unit-${i + 1}`,
    codeTaskId: `CODE-${i + 1}`,
    processTaskId: `DEV-${i + 1}`,
    title: `Task ${i + 1}`,
    order: i + 1,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: INCLUDED[i]!,
    dependencies: [],
    status: "verified" as const,
  }));
  const runs: CodeTaskExecutionRunV1[] = units.map((u) => ({
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `r-${u.codeTaskId}`,
    projectId: PID,
    processTaskId: u.processTaskId,
    workItemId: "wi",
    codeTaskId: u.codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "abc",
    githubOutcome: {
      status: "verified",
      checkedAt: NOW,
      workBranch: u.workBranch,
      commitSha: "abc",
      source: "github_rest",
    },
  }));
  const plan = {
    version: "implementation_code_task_plan_v1",
    projectId: PID,
    generatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CODE-INT",
        parentTaskId: "DEV-INT",
        title: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
        description: "",
        changeType: "integration",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "integration",
          workBranch: "wip/integration/final-wiring",
          baseBranch: "main",
          executionMode: "integration_only",
        },
      },
    ],
  } as ImplementationCodeTaskPlanV1;
  const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: plan });
  const snapshot = buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: units,
    selectedExecutionUnitIds: units.map((u) => u.unitId),
    codeTaskRuns: runs,
    integrationSteps: steps,
  });
  return { snapshot, units, plan, steps };
}

describe("P3-Runtime-Core-03-3 effective source branch", () => {
  it("1. prefers context.sourceBranch when included", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/screen/workspace",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: "wip/integration/final-wiring",
      topologyChainHead: "wip/integration/final-wiring",
      includedWorkBranches: [...INCLUDED],
    });
    expect(result.ok).toBe(true);
    expect(result.sourceBranch).toBe("wip/screen/workspace");
    expect(result.reason).toBe("context_source_branch");
  });

  it("2. does not use chainHead when not in included list", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: null,
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: "wip/integration/final-wiring",
      topologyChainHead: "wip/integration/final-wiring",
      includedWorkBranches: [...INCLUDED],
      latestVerifiedWorkBranch: "wip/screen/workspace",
    });
    expect(result.sourceBranch).toBe("wip/screen/workspace");
    expect(result.reason).toBe("latest_verified_work_branch");
  });

  it("3. rejects target and integration branches as source", () => {
    const targetOnly = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/integration/final-wiring",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: "wip/integration/final-wiring",
      topologyChainHead: null,
      includedWorkBranches: [...INCLUDED, "wip/integration/final-wiring"],
    });
    expect(targetOnly.ok).toBe(false);
  });

  it("4. uses chainHead when in included and context missing", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: null,
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: "wip/integration/final-wiring",
      topologyChainHead: "wip/feature/core-flow",
      includedWorkBranches: [...INCLUDED],
      latestVerifiedWorkBranch: null,
    });
    expect(result.ok).toBe(true);
    expect(result.sourceBranch).toBe("wip/feature/core-flow");
    expect(result.reason).toBe("topology_chain_head");
  });

  it("5. fails source_branch_missing when no candidate in included", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/integration/final-wiring",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: "wip/integration/final-wiring",
      topologyChainHead: "wip/integration/final-wiring",
      includedWorkBranches: [...INCLUDED],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("source_branch_missing");
  });

  it("6–9. regression case resolves workspace and single merge item", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/screen/workspace",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: "wip/integration/final-wiring",
      topologyChainHead: "wip/integration/final-wiring",
      includedWorkBranches: [...INCLUDED],
    });
    expect(result.sourceBranch).toBe("wip/screen/workspace");
    const mergeItems = INCLUDED.filter((b) => b === result.sourceBranch);
    expect(mergeItems).toEqual(["wip/screen/workspace"]);
    expect(() => {
      if (!result.ok) {
        throw new IntegrationPipelineDomainError("integration_source_missing");
      }
    }).not.toThrow();
  });
});

describe("P3-Runtime-Core-03-3 pipeline ordering and messages", () => {
  it("10–11. resolves source before ensureGithubIntegrationBranch", () => {
    const src = readFileSync(join(prototypeDir, "implementationIntegrationPipelineService.ts"), "utf8");
    const createIdx = src.indexOf("await ensureGithubIntegrationBranch");
    const resolutionFailedIdx = src.indexOf("implementation_integration_source_resolution_failed");
    const resolutionStartedIdx = src.indexOf("implementation_integration_source_resolution_started");
    expect(createIdx).toBeGreaterThan(-1);
    expect(resolutionStartedIdx).toBeGreaterThan(-1);
    expect(resolutionStartedIdx).toBeLessThan(createIdx);
    expect(resolutionFailedIdx).toBeLessThan(createIdx);
    expect(src.indexOf("return failPipeline", resolutionFailedIdx)).toBeLessThan(createIdx);
  });

  it("12–13. user-safe message hides branch names; logs retain diagnostics", () => {
    const msg = toUserSafeIntegrationErrorMessage(
      new IntegrationPipelineDomainError("integration_source_missing", undefined, {
        contextSourceBranch: "wip/screen/workspace",
        topologyChainHead: "wip/integration/final-wiring",
      }),
    );
    expect(msg).not.toContain("wip/");
    expect(msg).toContain("최종 통합 기준 branch를 결정하지 못했습니다");
    const pipelineSrc = readFileSync(join(prototypeDir, "implementationIntegrationPipelineService.ts"), "utf8");
    expect(pipelineSrc).toContain("implementation_integration_source_resolution_failed");
    expect(pipelineSrc).toContain("includedWorkBranches");
  });

  it("legacy adapter forwards context source branch", () => {
    const src = readFileSync(join(prototypeDir, "implementationIntegrationLegacyPipelineAdapter.ts"), "utf8");
    expect(src).toContain("sourceBranch: input.sourceBranch");
    expect(src).toContain("targetBranch: input.targetBranch");
  });
});

describe("P3-Runtime-Core-03-3 regression", () => {
  it("14. integration button enabled when all complete + final_wiring pending", () => {
    const { snapshot } = regressionSnapshot();
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.enabled).toBe(true);
  });

  it("15. failed unit disables button", () => {
    const { snapshot, units } = regressionSnapshot();
    const failed = { ...units[0]!, status: "failed" as const };
    const failedSnapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [failed, ...units.slice(1)],
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [],
      integrationSteps: buildDefaultIntegrationStepsFromBranchPlan({
        codeTaskPlan: {
          version: "implementation_code_task_plan_v1",
          projectId: PID,
          generatedAt: NOW,
          tasks: [],
        } as ImplementationCodeTaskPlanV1,
      }),
    });
    expect(evaluateIntegrationPipelineButtonFromSnapshot(failedSnapshot).enabled).toBe(false);
  });

  it("16. final_wiring is not counted as code task total", () => {
    const { snapshot } = regressionSnapshot();
    expect(snapshot.codeTask.total).toBe(3);
  });
});
