import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { buildImplementationIntegrationPipelineContext } from "@/lib/prototype/implementationIntegrationPipelineContextBuilder";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import {
  buildImplementationIntegrationPipelineEligibilityFromSnapshot,
} from "@/lib/prototype/projectIntegrationPipelineEligibility";
import {
  buildImplementationRuntimeSnapshot,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { buildReviewIntegrationPipelineContext } from "@/lib/prototype/reviewIntegrationPipelineAdapter";

const PID = "p-runtime-core-031";
const NOW = "2026-06-08T12:00:00.000Z";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");
const appDir = join(__dirname, "../../src/app");

function unit(n: number, input?: Partial<ImplementationExecutionUnitV1>): ImplementationExecutionUnitV1 {
  return {
    unitId: `unit-${n}`,
    codeTaskId: `CODE-${n}`,
    processTaskId: `DEV-${n}`,
    title: `Task ${n}`,
    order: n,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: `wip/screen/task-${n}`,
    dependencies: [],
    status: "verified",
    ...input,
  };
}

function verifiedRun(codeTaskId: string): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `r-${codeTaskId}`,
    projectId: PID,
    processTaskId: "DEV",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "abc",
    githubOutcome: {
      status: "verified",
      checkedAt: NOW,
      workBranch: "wip",
      commitSha: "abc",
      source: "github_rest",
    },
  };
}

function integrationPlan(): ImplementationCodeTaskPlanV1 {
  return {
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
}

function snapshotAllComplete() {
  const units = Array.from({ length: 3 }, (_, i) => unit(i + 1));
  const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: integrationPlan() });
  const snapshot = buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: units,
    selectedExecutionUnitIds: units.map((u) => u.unitId),
    codeTaskRuns: units.map((u) => verifiedRun(u.codeTaskId)),
    integrationSteps: steps,
  });
  return { snapshot, units, steps };
}

describe("P3-Runtime-Core-03-1 pipeline context", () => {
  it("1. implementation context uses implementation stage and initial_preview mode", () => {
    const { snapshot, steps } = snapshotAllComplete();
    const context = buildImplementationIntegrationPipelineContext({
      projectId: PID,
      trigger: "manual_integration_button",
      baseBranch: "main",
      snapshot,
      codeTaskPlan: integrationPlan(),
      integrationSteps: steps,
    });
    expect(context.stage).toBe("implementation");
    expect(context.mode).toBe("initial_preview");
    expect(context.trigger).toBe("manual_integration_button");
  });

  it("2. review context skeleton uses review stage and review_refresh mode", () => {
    const context = buildReviewIntegrationPipelineContext({
      projectId: PID,
      reviewRequestId: "rev-1",
      changeRequestId: "chg-1",
      reviewBranch: "wip/review/change-1",
      baseIntegratedBranch: "wip/integration/final-wiring",
    });
    expect(context.stage).toBe("review");
    expect(context.mode).toBe("review_refresh");
    expect(context.trigger).toBe("review_change_request_completed");
  });

  it("3. context includes sourceBranch, targetBranch, integrationBranch", () => {
    const { snapshot, steps } = snapshotAllComplete();
    const context = buildImplementationIntegrationPipelineContext({
      projectId: PID,
      trigger: "manual_integration_button",
      baseBranch: "main",
      snapshot,
      codeTaskPlan: integrationPlan(),
      integrationSteps: steps,
    });
    expect(context.sourceBranch).toContain("wip/");
    expect(context.targetBranch).toBe("wip/integration/final-wiring");
    expect(context.integrationBranch).toBe(context.targetBranch);
  });
});

describe("P3-Runtime-Core-03-1 eligibility", () => {
  it("4. implementation eligibility derives canRun from snapshot completion state", () => {
    const { snapshot } = snapshotAllComplete();
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(snapshot);
    expect(eligibility.canRun).toBe(true);
    expect(eligibility.reasonCode).toBe("ready");
  });

  it("5. blocked eligibility maps to non-ready reason codes", () => {
    const units = [unit(1), unit(2, { status: "ready" })];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [verifiedRun("CODE-1")],
      integrationSteps: buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: integrationPlan() }),
    });
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(snapshot);
    expect(eligibility.canRun).toBe(false);
    expect(eligibility.reasonCode).toBe("codetask_completion_required");
  });

  it("6. pipeline service checks eligibility before running steps", () => {
    const src = readFileSync(join(prototypeDir, "projectIntegrationPipelineService.ts"), "utf8");
    expect(src).toContain("if (!input.eligibility.canRun)");
    expect(src).toContain("project_integration_pipeline_blocked");
    expect(src).toContain("final_wiring");
  });
});

describe("P3-Runtime-Core-03-1 pipeline wiring", () => {
  it("7. runProjectIntegrationPipeline logs stage/trigger/mode", () => {
    const src = readFileSync(join(prototypeDir, "projectIntegrationPipelineService.ts"), "utf8");
    expect(src).toContain("project_integration_pipeline_started");
    expect(src).toContain("projectIntegrationPipelineContextLogFields");
  });

  it("8. board integration pipeline client delegates to prepare-only integration path", () => {
    const src = readFileSync(join(prototypeDir, "implementationBoardIntegrationPipelineRun.ts"), "utf8");
    expect(src).toContain("runProjectIntegrationPrepareOnly");
  });

  it("9. run-pipeline route uses runProjectIntegrationPipeline as primary path", () => {
    const routeSrc = readFileSync(join(appDir, "api/prototype/integration/run-pipeline/route.ts"), "utf8");
    expect(routeSrc).toContain("runProjectIntegrationPipeline");
    expect(routeSrc).toContain("buildImplementationIntegrationPipelineEligibilityFromSnapshot");
    expect(routeSrc).not.toMatch(/runIntegrationBranchPipeline\s*\(/);
  });

  it("10. final_wiring pending eligibility allows pipeline start", () => {
    const { snapshot } = snapshotAllComplete();
    expect(snapshot.integration.finalWiringStatus).toBe("pending");
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(snapshot);
    expect(eligibility.canRun).toBe(true);
  });
});

describe("P3-Runtime-Core-03-1 review reuse", () => {
  it("11. review context builder does not import implementation snapshot", () => {
    const src = readFileSync(join(prototypeDir, "reviewIntegrationPipelineAdapter.ts"), "utf8");
    expect(src).not.toContain("ImplementationRuntimeSnapshot");
    expect(src).not.toContain("buildImplementationRuntimeSnapshot");
  });

  it("12. review context is valid input shape for project pipeline", () => {
    const context = buildReviewIntegrationPipelineContext({
      projectId: PID,
      reviewRequestId: "rev-9",
      reviewBranch: "wip/review/x",
      baseIntegratedBranch: "wip/integration/final-wiring",
    });
    expect(context.stage).toBe("review");
    expect(context.integrationBranch).toBe("wip/review/preview-refresh");
  });
});

describe("P3-Runtime-Core-03-1 regression", () => {
  it("13. integration button policy unchanged for completed codetasks", () => {
    const { snapshot } = snapshotAllComplete();
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.enabled).toBe(true);
  });

  it("14. failed codetask keeps button disabled", () => {
    const units = [unit(1), unit(2, { status: "failed" })];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [
        verifiedRun("CODE-1"),
        {
          ...verifiedRun("CODE-2"),
          status: "failed",
          githubOutcome: {
            status: "failed",
            checkedAt: NOW,
            reason: "github_branch_missing",
            retryable: true,
            message: "x",
          },
        },
      ],
      integrationSteps: buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: integrationPlan() }),
    });
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.enabled).toBe(false);
  });

  it("15. panel source avoids operator diagnostic in integration hints", () => {
    const panelSrc = readFileSync(
      join(__dirname, "../../src/components/preview/ImplementationExecutionBoardPanel.tsx"),
      "utf8",
    );
    expect(panelSrc).toContain("evaluateIntegrationPipelineButtonFromSnapshot");
    expect(panelSrc).not.toContain("githubVerifyTechnicalLines");
  });
});
