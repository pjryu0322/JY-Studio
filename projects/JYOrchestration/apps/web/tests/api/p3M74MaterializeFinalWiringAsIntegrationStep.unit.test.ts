import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildDefaultIntegrationStepsFromBranchPlan,
  buildIntegrationStepsBuiltTimeline,
} from "@/lib/prototype/implementationIntegrationStepBuilder";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildExecutionUnitsFromLegacyState } from "@/lib/prototype/implementationExecutionUnitBuilder";
import {
  isExecutionUnitCompletedForSummary,
  resolveExecutionUnitVerificationDisplayStatus,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { evaluateImplementationPreviewReadiness } from "@/lib/prototype/implementationPreviewReadiness";
import { evaluateImplementationIntegrationEligibility } from "@/lib/prototype/implementationIntegrationEligibility";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { isFinalWiringIntegrationStepCompleted } from "@/lib/prototype/implementationIntegrationStatus";

const PID = "p-m74";

function planWithIntegrationWiring(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: PID,
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
        codeTaskId: "CODE-INTEGRATION",
        parentTaskId: "DEV-INTEGRATION",
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

function unitVerified(codeTaskId: string): ImplementationExecutionUnitV1 {
  return {
    unitId: codeTaskId,
    codeTaskId,
    processTaskId: "DEV",
    title: codeTaskId,
    order: 0,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: "wip/screen/workspace",
    dependencies: [],
    status: "verified",
  };
}

describe("P3-M74 integration steps from branch plan", () => {
  it("creates final_wiring step and excludes wiring from ExecutionUnit count", () => {
    const plan = planWithIntegrationWiring();
    const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: plan });
    expect(steps.some((s) => s.kind === "final_wiring")).toBe(true);
    expect(steps.find((s) => s.kind === "final_wiring")?.workBranch).toBe("wip/integration/final-wiring");

    const { units } = buildExecutionUnitsFromLegacyState({ codeTaskPlan: plan });
    expect(units).toHaveLength(1);
    expect(units[0]?.codeTaskId).toBe("CODE-A");
  });

  it("logs implementation_integration_steps_built", () => {
    const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: planWithIntegrationWiring() });
    const entry = buildIntegrationStepsBuiltTimeline({ projectId: PID, steps });
    expect(entry.action).toBe("implementation_integration_steps_built");
  });
});

describe("P3-M74 execution unit verification cross-check", () => {
  it("marks verification_inconsistent when only unit.status is verified", () => {
    const unit = unitVerified("CODE-DEV-SCREEN-003-001");
    const status = resolveExecutionUnitVerificationDisplayStatus({ unit, run: null });
    expect(status).toBe("verification_inconsistent");
    expect(isExecutionUnitCompletedForSummary({ unit, run: null })).toBe(false);
  });

  it("counts completed only when unit verified and persisted github outcome exist", () => {
    const unit = unitVerified("CODE-A");
    const run = {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: "r1",
      projectId: PID,
      processTaskId: "DEV",
      workItemId: "wi",
      codeTaskId: "CODE-A",
      status: "github_verified" as const,
      attemptNo: 1,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T01:00:00.000Z",
      githubOutcome: {
        status: "verified" as const,
        checkedAt: "2026-06-08T01:00:00.000Z",
        workBranch: "wip/screen/workspace",
        commitSha: "abc",
        source: "github_rest" as const,
      },
    };
    expect(isExecutionUnitCompletedForSummary({ unit, run })).toBe(true);
    const summary = buildImplementationExecutionSummaryCounts({
      projectId: PID,
      codeTaskPlan: planWithIntegrationWiring(),
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: "2026-06-08T00:00:00.000Z",
          units: [unit],
          selectedExecutionUnitIds: [unit.unitId],
        },
      },
      runs: [run],
    });
    expect(summary.completedCodeTaskCount).toBe(1);
    expect(summary.verificationInconsistentCount).toBe(0);
  });

  it("does not increase completed count for toast-only verified unit without outcome", () => {
    const unit = unitVerified("CODE-DEV-SCREEN-003-001");
    const summary = buildImplementationExecutionSummaryCounts({
      projectId: PID,
      codeTaskPlan: planWithIntegrationWiring(),
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: "2026-06-08T00:00:00.000Z",
          units: [unit],
          selectedExecutionUnitIds: [unit.unitId],
        },
      },
      runs: [],
    });
    expect(summary.completedCodeTaskCount).toBe(0);
    expect(summary.verificationInconsistentCount).toBe(1);
  });
});

describe("P3-M74 preview readiness", () => {
  it("reports final_wiring_pending when all codetasks verified but wiring step pending", () => {
    const plan = planWithIntegrationWiring();
    const unit = unitVerified("CODE-A");
    const run = {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: "r1",
      projectId: PID,
      processTaskId: "DEV",
      workItemId: "wi",
      codeTaskId: "CODE-A",
      status: "github_verified" as const,
      attemptNo: 1,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T01:00:00.000Z",
      githubOutcome: {
        status: "verified" as const,
        checkedAt: "2026-06-08T01:00:00.000Z",
        workBranch: "wip/screen/workspace",
        commitSha: "abc",
        source: "github_rest" as const,
      },
    };
    const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: plan });
    const eligibility = evaluateImplementationIntegrationEligibility({
      codeTaskPlan: plan,
      taskList: null,
      codeTaskRuns: [run],
      autoQualityGate: null,
    });
    const readiness = evaluateImplementationPreviewReadiness({
      projectId: PID,
      codeTaskPlan: plan,
      codeTaskRuns: [run],
      eligibility,
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: "2026-06-08T00:00:00.000Z",
          units: [unit],
          selectedExecutionUnitIds: [unit.unitId],
        },
        implementationIntegrationStepsV1: {
          version: "implementation_integration_steps_v1",
          projectId: PID,
          updatedAt: "2026-06-08T00:00:00.000Z",
          steps,
        },
      },
    });
    expect(readiness.mode).toBe("final_wiring_pending");
    expect(readiness.integratedAppPreviewReady).toBe(false);
    expect(isFinalWiringIntegrationStepCompleted(steps)).toBe(false);
  });
});
