import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateBuildIntegrationStepCompletion, runBuildIntegrationStep } from "@/lib/prototype/implementationBuildStepService";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import { deriveIntegrationStepPipelinePhase } from "@/lib/prototype/implementationIntegrationStatus";
import { CODE_TASK_INTEGRATION_PLAN_VERSION } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");
const appDir = join(__dirname, "../../src/app");

function readPrototypeSource(name: string): string {
  return readFileSync(join(prototypeDir, name), "utf8");
}

function planWithIntegration(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p-m75",
    generatedAt: "2026-06-08T00:00:00.000Z",
    tasks: [
      {
        codeTaskId: "CODE-A",
        parentTaskId: "DEV-A",
        title: "A",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "screen",
          workBranch: "wip/screen/workspace",
          baseBranch: "main",
          executionMode: "sequential",
        },
      },
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
          baseBranch: "wip/screen/workspace",
          executionMode: "integration_only",
        },
      },
    ],
  };
}

describe("P3-M75 legacy pipeline isolation", () => {
  it("final wiring service does not run integration branch pipeline directly", () => {
    const src = readPrototypeSource("implementationFinalWiringService.ts");
    expect(src).not.toContain("runIntegrationBranchPipeline");
    expect(src).not.toContain("runImplementationIntegrationStepPipeline");
  });

  it("integration step pipeline uses legacy adapter not direct pipeline import", () => {
    const src = readPrototypeSource("implementationIntegrationStepPipelineService.ts");
    expect(src).not.toContain("runIntegrationBranchPipeline(");
    expect(src).toContain("runLegacyIntegrationBranchPipelineAsFinalWiringAdapter");
  });

  it("run-pipeline route calls runImplementationIntegrationStepPipeline", () => {
    const src = readFileSync(
      join(appDir, "api/prototype/integration/run-pipeline/route.ts"),
      "utf8",
    );
    expect(src).toContain("runImplementationIntegrationStepPipeline");
  });
});

describe("P3-M75 build step", () => {
  it("completes build when integration branch and included tasks exist", () => {
    const evaluation = evaluateBuildIntegrationStepCompletion({
      projectId: "p-m75",
      plan: {
        version: CODE_TASK_INTEGRATION_PLAN_VERSION,
        projectId: "p-m75",
        targetRepository: "org/repo",
        baseBranch: "main",
        integrationBranch: "wip/integration/final-wiring",
        createdAt: "2026-06-08T00:00:00.000Z",
        included: [
          {
            runId: "r1",
            processTaskId: "DEV-A",
            codeTaskId: "CODE-A",
            title: "A",
            workBranch: "wip/screen/workspace",
            commitSha: "abc",
            order: 0,
          },
        ],
        excluded: [],
        strategy: "merge",
        status: "preview_ready",
      },
    });
    expect(evaluation.ok).toBe(true);

    const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: planWithIntegration() });
    const buildRun = runBuildIntegrationStep({
      projectId: "p-m75",
      steps,
      plan: {
        version: CODE_TASK_INTEGRATION_PLAN_VERSION,
        projectId: "p-m75",
        targetRepository: "org/repo",
        baseBranch: "main",
        integrationBranch: "wip/integration/final-wiring",
        createdAt: "2026-06-08T00:00:00.000Z",
        included: [{ runId: "r1", processTaskId: "DEV-A", codeTaskId: "CODE-A", title: "A", workBranch: "w", commitSha: "a", order: 0 }],
        excluded: [],
        strategy: "merge",
        status: "preview_ready",
      },
      nowIso: "2026-06-08T12:00:00.000Z",
    });
    expect(buildRun.ok).toBe(true);
    expect(buildRun.steps.find((s) => s.kind === "build")?.status).toBe("completed");
  });

  it("fails build when plan status is conflict", () => {
    const evaluation = evaluateBuildIntegrationStepCompletion({
      projectId: "p-m75",
      plan: {
        version: CODE_TASK_INTEGRATION_PLAN_VERSION,
        projectId: "p-m75",
        targetRepository: "org/repo",
        baseBranch: "main",
        integrationBranch: "wip/integration/final-wiring",
        createdAt: "2026-06-08T00:00:00.000Z",
        included: [],
        excluded: [],
        strategy: "merge",
        status: "conflict",
      },
    });
    expect(evaluation.ok).toBe(false);
  });
});

describe("P3-M75 integration step phase", () => {
  it("requires all steps completed before all_completed phase", () => {
    const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: planWithIntegration() }).map((s) =>
      s.kind === "final_wiring" || s.kind === "integration_branch"
        ? { ...s, status: "completed" as const }
        : s,
    );
    expect(deriveIntegrationStepPipelinePhase(steps)).toBe("build_pending");

    const allDone = steps.map((s) => ({ ...s, status: "completed" as const }));
    expect(deriveIntegrationStepPipelinePhase(allDone)).toBe("all_completed");
  });

  it("final_wiring completed alone is not all_completed", () => {
    const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: planWithIntegration() }).map((s) =>
      s.kind === "final_wiring" ? { ...s, status: "completed" as const } : s,
    );
    expect(deriveIntegrationStepPipelinePhase(steps)).toBe("integration_branch_pending");
  });
});
