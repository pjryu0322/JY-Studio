import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { areAllSelectedExecutionUnitsVerifiedWithRuns } from "@/lib/prototype/implementationExecutionSelectedUnits";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import {
  buildImplementationRuntimeSnapshot,
  buildImplementationRuntimeSnapshotFromRequirementsState,
  resolveIntegrationStepsForRuntimeSnapshot,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";

const PID = "p-runtime-core-03";
const NOW = "2026-06-08T12:00:00.000Z";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "../../src/app");
const componentsDir = join(__dirname, "../../src/components/preview");

function unit(
  n: number,
  input?: Partial<ImplementationExecutionUnitV1>,
): ImplementationExecutionUnitV1 {
  return {
    unitId: `unit-${n}`,
    codeTaskId: `CODE-${n}`,
    processTaskId: `DEV-${n}`,
    title: `Task ${n}`,
    order: n,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: `wip/${n}`,
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

function integrationPlanStub(): ImplementationCodeTaskPlanV1 {
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

function finalWiringStep(status: ImplementationIntegrationStepV1["status"]): ImplementationIntegrationStepV1 {
  return {
    stepId: "final-wiring",
    kind: "final_wiring",
    title: "최종 연결/통합 Wiring",
    order: 1,
    status,
  };
}

function snapshot15Complete(finalWiring: ImplementationIntegrationStepV1["status"]) {
  const units = Array.from({ length: 15 }, (_, i) => unit(i + 1));
  const runs = units.map((u) => verifiedRun(u.codeTaskId));
  const steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: integrationPlanStub() }).map(
    (s) => (s.kind === "final_wiring" ? { ...s, status: finalWiring } : s),
  );
  const snapshot = buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: units,
    selectedExecutionUnitIds: units.map((u) => u.unitId),
    codeTaskRuns: runs,
    integrationSteps: steps,
  });
  return { snapshot, units, runs, steps };
}

describe("P3-Runtime-Core-03 snapshot / button policy", () => {
  it("1. 15/15 + final_wiring pending enables button", () => {
    const { snapshot } = snapshot15Complete("pending");
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(true);
    expect(button.userStatusLines.join("\n")).toContain("최종 연결/통합 Wiring을 실행할 수 있습니다.");
    expect(button.userStatusLines.join("\n")).not.toContain("통합 단계를 준비하지 못했습니다");
  });

  it("2. 15/15 + final_wiring ready enables button", () => {
    const { snapshot } = snapshot15Complete("ready");
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.enabled).toBe(true);
  });

  it("3. 15/15 + final_wiring failed enables button (retry)", () => {
    const { snapshot } = snapshot15Complete("failed");
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(true);
  });

  it("4. 15/14 shows visible disabled button", () => {
    const units = Array.from({ length: 15 }, (_, i) =>
      unit(i + 1, i < 14 ? { status: "verified" } : { status: "ready" }),
    );
    const runs = units.slice(0, 14).map((u) => verifiedRun(u.codeTaskId));
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: runs,
      integrationSteps: [finalWiringStep("pending")],
    });
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.disabledReasonLines.join("\n")).toContain("미완료 또는 검증 대기");
  });

  it("5. failed=1 visible disabled", () => {
    const units = [unit(1), unit(2, { status: "failed" })];
    const failedRun: CodeTaskExecutionRunV1 = {
      ...verifiedRun("CODE-2"),
      runId: "run-failed",
      status: "failed",
      githubOutcome: {
        status: "failed",
        checkedAt: NOW,
        reason: "github_branch_missing",
        retryable: true,
        message: "apiStatus=404",
      },
    };
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [verifiedRun("CODE-1"), failedRun],
      integrationSteps: [finalWiringStep("pending")],
    });
    expect(snapshot.codeTask.failed).toBe(1);
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.disabledReasonLines.join("\n")).toContain("실패한 CodeTask가 있어");
  });

  it("6. inconsistent=1 visible disabled", () => {
    const u = unit(1, { status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u],
      selectedExecutionUnitIds: [u.unitId],
      codeTaskRuns: [],
      integrationSteps: [finalWiringStep("pending")],
    });
    expect(snapshot.codeTask.inconsistent).toBe(1);
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
  });

  it("7. final_wiring missing visible disabled with prep message", () => {
    const u = unit(1);
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u],
      selectedExecutionUnitIds: [u.unitId],
      codeTaskRuns: [verifiedRun(u.codeTaskId)],
      integrationSteps: [],
    });
    expect(snapshot.integration.finalWiringStatus).toBe("missing");
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
    expect(button.disabledReasonLines.join("\n")).toContain("통합 단계를 준비하지 못했습니다");
  });

  it("bootstraps integration steps from branch plan when persisted steps empty", () => {
    const units = [unit(1)];
    const steps = resolveIntegrationStepsForRuntimeSnapshot({
      requirementsState: {
        implementationCodeTaskPlanV1: integrationPlanStub(),
      },
      codeTaskPlan: integrationPlanStub(),
    });
    expect(steps.some((s) => s.kind === "final_wiring")).toBe(true);
    const snapshot = buildImplementationRuntimeSnapshotFromRequirementsState({
      projectId: PID,
      requirementsState: {
        implementationCodeTaskPlanV1: integrationPlanStub(),
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: NOW,
          units,
          selectedExecutionUnitIds: units.map((u) => u.unitId),
        },
        codeTaskExecutionRunsV1: [verifiedRun(units[0]!.codeTaskId)],
      },
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
    });
    expect(snapshot.integration.finalWiringStatus).toBe("pending");
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.enabled).toBe(true);
    expect(button.userStatusLines.join("\n")).not.toContain("통합 단계를 준비하지 못했습니다");
  });
});

describe("P3-Runtime-Core-03 API alignment", () => {
  it("8. run-pipeline route invokes project integration pipeline", () => {
    const src = readFileSync(join(appDir, "api/prototype/integration/run-pipeline/route.ts"), "utf8");
    expect(src).toContain("runProjectIntegrationPipeline");
  });

  it("9. 15/15 verified gate does not require codetask_completion_required", () => {
    const { units, runs } = snapshot15Complete("pending");
    const summary = buildImplementationExecutionSummaryCounts({
      projectId: PID,
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: NOW,
          units,
          selectedExecutionUnitIds: units.map((u) => u.unitId),
        },
      },
      codeTaskPlan: null,
      runs,
    });
    expect(summary.runtimeSnapshot.codeTask.completed).toBe(15);
    const gateOk = areAllSelectedExecutionUnitsVerifiedWithRuns({
      units: summary.executionUnits,
      selectedUnitIds: summary.selectedExecutionUnitIds,
      runs,
    });
    expect(gateOk).toBe(true);
  });

  it("10. pipeline service exposes success status variants", () => {
    const src = readFileSync(
      join(__dirname, "../../src/lib/prototype/projectIntegrationPipelineService.ts"),
      "utf8",
    );
    expect(src).toContain('"integrated_app_preview_ready"');
    expect(src).toContain('"build_pending"');
  });

  it("11. final_wiring failure returns user-safe message", () => {
    const src = readFileSync(
      join(__dirname, "../../src/lib/prototype/projectIntegrationPipelineService.ts"),
      "utf8",
    );
    expect(src).toContain("final_wiring_failed");
    const routeSrc = readFileSync(join(appDir, "api/prototype/integration/run-pipeline/route.ts"), "utf8");
    expect(routeSrc).toContain("userSafeMessage");
    expect(routeSrc).toContain("codetask_completion_required");
  });

  it("maps codetasks_incomplete to codetask_completion_required in API JSON", () => {
    const routeSrc = readFileSync(join(appDir, "api/prototype/integration/run-pipeline/route.ts"), "utf8");
    expect(routeSrc).toContain('outcome.status === "codetasks_incomplete"');
    expect(routeSrc).toContain('"codetask_completion_required"');
    const eligibilitySrc = readFileSync(
      join(__dirname, "../../src/lib/prototype/projectIntegrationPipelineEligibility.ts"),
      "utf8",
    );
    expect(eligibilitySrc).toContain(
      "미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.",
    );
  });
});

describe("P3-Runtime-Core-03 UI policy", () => {
  it("12–15. board panel uses snapshot button policy and user-safe hints", () => {
    const src = readFileSync(join(componentsDir, "ImplementationExecutionBoardPanel.tsx"), "utf8");
    expect(src).toContain("evaluateIntegrationPipelineButtonFromSnapshot");
    expect(src).toContain("implementation-integration-run-button");
    expect(src).toContain("aria-disabled");
    expect(src).not.toMatch(/githubVerifyTechnicalLines.*integrationSection/);
  });

  it("13. enabled policy does not surface prep-failed copy for pending final_wiring", () => {
    const { snapshot } = snapshot15Complete("pending");
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.enabled).toBe(true);
    expect(button.disabledReasonLines).toEqual([]);
    expect(button.userStatusLines.join("\n")).not.toContain("통합 단계를 준비하지 못했습니다");
  });

  it("16. button disabled reasons avoid operator/debug tokens", () => {
    const partial = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [unit(1, { status: "failed" })],
      selectedExecutionUnitIds: ["unit-1"],
      codeTaskRuns: [verifiedRun("CODE-1")],
      integrationSteps: [finalWiringStep("pending")],
    });
    const lines = evaluateIntegrationPipelineButtonFromSnapshot(partial).disabledReasonLines.join("\n");
    expect(lines).not.toContain("run-");
    expect(lines).not.toContain("apiStatus");
    expect(lines).not.toContain("github_rest");
  });
});

describe("P3-Runtime-Core-03 regression hooks", () => {
  it("17. final_wiring is not counted in codeTask totals", () => {
    const { snapshot } = snapshot15Complete("pending");
    expect(snapshot.codeTask.total).toBe(15);
    expect(snapshot.codeTask.selected).toBe(15);
  });

  it("18. failed outcome is not completed in snapshot counts", () => {
    const u = unit(1, { status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u],
      selectedExecutionUnitIds: [u.unitId],
      codeTaskRuns: [
        {
          ...verifiedRun(u.codeTaskId),
          status: "failed",
          githubOutcome: {
            status: "failed",
            checkedAt: NOW,
            reason: "github_branch_missing",
            retryable: true,
            message: "apiStatus=404",
          },
        },
      ],
      integrationSteps: [],
    });
    expect(snapshot.codeTask.completed).toBe(0);
    expect(snapshot.codeTask.failed).toBe(1);
  });
});
