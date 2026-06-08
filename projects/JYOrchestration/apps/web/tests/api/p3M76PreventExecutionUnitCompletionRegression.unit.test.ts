import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { ensurePersistedImplementationExecutionUnits } from "@/lib/prototype/implementationExecutionRuntime";
import {
  areSelectedExecutionUnitsCompletedWithPersistedOutcomes,
  countVerifiedSelectedExecutionUnits,
} from "@/lib/prototype/implementationExecutionSelectedUnits";
import { mergeExecutionUnitWithTerminalGuard } from "@/lib/prototype/implementationExecutionUnitTerminalGuard";
import {
  formatExecutionUnitVerificationCardLabels,
  resolveExecutionUnitVerificationDisplayStatus,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import { shouldAutoStartImplementationQualityGate } from "@/lib/prototype/implementationAutoQualityGate";
import { evaluateIntegrationPipelineButtonEnablement } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { saveImplementationExecutionUnitsToState } from "@/lib/prototype/implementationExecutionUnitStore";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const PID = "p-m76";

function unit(
  input: Partial<ImplementationExecutionUnitV1> & Pick<ImplementationExecutionUnitV1, "unitId" | "codeTaskId">,
): ImplementationExecutionUnitV1 {
  return {
    processTaskId: "DEV-A",
    title: "A",
    order: 0,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: "wip/a",
    dependencies: [],
    status: "ready",
    ...input,
  };
}

function verifiedRun(codeTaskId: string) {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: "r1",
    projectId: PID,
    processTaskId: "DEV-A",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified" as const,
    attemptNo: 1,
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T01:00:00.000Z",
    commitSha: "abc",
    githubOutcome: {
      status: "verified" as const,
      checkedAt: "2026-06-08T01:00:00.000Z",
      workBranch: "wip/a",
      commitSha: "abc",
      source: "github_rest" as const,
    },
  };
}

describe("P3-M76 bootstrap regression guard", () => {
  it("does not legacy bootstrap when persisted units exist", () => {
    const persistedUnit = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" });
    const result = ensurePersistedImplementationExecutionUnits({
      projectId: PID,
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: "2026-06-08T00:00:00.000Z",
          units: [persistedUnit],
        },
      },
      codeTaskPlan: null,
    });
    expect(result.bootstrapped).toBe(false);
    expect(result.units[0]?.status).toBe("verified");
    expect(result.timeline.some((t) => t.action === "implementation_execution_units_bootstrap_skipped")).toBe(
      true,
    );
  });
});

describe("P3-M76 terminal guard", () => {
  it("keeps verified when running patch is applied", () => {
    const current = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" });
    const merged = mergeExecutionUnitWithTerminalGuard({
      current,
      patch: { status: "running" },
      reason: "implementation_execution_unit_started",
    });
    expect(merged.blocked).toBe(true);
    expect(merged.unit.status).toBe("verified");
  });

  it("allows failed to ready on explicit retry reason", () => {
    const current = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "failed", retryable: true });
    const merged = mergeExecutionUnitWithTerminalGuard({
      current,
      patch: { status: "ready" },
      reason: "implementation_execution_unit_retry",
    });
    expect(merged.blocked).toBe(false);
    expect(merged.unit.status).toBe("ready");
  });

  it("save with mergeTerminalGuardFrom preserves verified across full list replace", () => {
    const prev = unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" });
    const next = [{ ...prev, status: "running" as const }];
    const patch = saveImplementationExecutionUnitsToState({
      projectId: PID,
      units: next,
      reason: "cursor_in_flight_sync",
      mergeTerminalGuardFrom: [prev],
    });
    expect(patch.implementationExecutionUnitsV1?.units[0]?.status).toBe("verified");
  });
});

describe("P3-M76 completion gate", () => {
  it("requires persisted outcome for all selected units", () => {
    const units = [
      unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" }),
      unit({ unitId: "u2", codeTaskId: "CODE-B", status: "verified" }),
    ];
    const gate = areSelectedExecutionUnitsCompletedWithPersistedOutcomes({
      units,
      selectedUnitIds: ["u1", "u2"],
      runs: [verifiedRun("CODE-A")],
    });
    expect(gate.ok).toBe(false);
    expect(gate.completedCount).toBe(1);
    expect(gate.inconsistentCodeTaskIds).toContain("CODE-B");
  });

  it("does not count quality gate pass without github outcome in summary count", () => {
    const units = [unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" })];
    const n = countVerifiedSelectedExecutionUnits({
      units,
      selectedUnitIds: ["u1"],
      runs: [{ ...verifiedRun("CODE-A"), githubOutcome: undefined, status: "quality_gate_passed" }],
    });
    expect(n).toBe(0);
  });
});

describe("P3-M76 auto quality gate ordering", () => {
  it("waits until github outcome is persisted on run", () => {
    const start = shouldAutoStartImplementationQualityGate({
      taskCursorExecution: {
        taskId: "DEV-A",
        status: "github_verified",
        commitSha: "abc",
      } as TaskCursorExecutionV1,
      codeTaskRun: {
        ...verifiedRun("CODE-A"),
        status: "cursor_running",
        githubOutcome: undefined,
      },
    });
    expect(start).toBe(false);
  });

  it("starts after persisted github verified run", () => {
    const start = shouldAutoStartImplementationQualityGate({
      taskCursorExecution: {
        projectId: PID,
        taskId: "DEV-A",
        status: "github_verifying",
        commitSha: "abc",
      } as TaskCursorExecutionV1,
      codeTaskRun: verifiedRun("CODE-A"),
    });
    expect(start).toBe(true);
  });
});

describe("P3-M76 UI alignment", () => {
  it("card labels show verification wait when unit verified without outcome", () => {
    const display = resolveExecutionUnitVerificationDisplayStatus({
      unit: unit({ unitId: "u1", codeTaskId: "CODE-DEV-SCREEN-003-001", status: "verified" }),
      run: null,
    });
    expect(display).toBe("verification_inconsistent");
    const labels = formatExecutionUnitVerificationCardLabels(display);
    expect(labels.statusLabel).toBe("검증 완료 대기");
  });

  it("disables integration button at partial persisted outcomes", () => {
    const gate = areSelectedExecutionUnitsCompletedWithPersistedOutcomes({
      units: [
        unit({ unitId: "u1", codeTaskId: "CODE-A", status: "verified" }),
        unit({ unitId: "u2", codeTaskId: "CODE-B", status: "verified" }),
      ],
      selectedUnitIds: ["u1", "u2"],
      runs: [verifiedRun("CODE-A")],
    });
    const button = evaluateIntegrationPipelineButtonEnablement({
      canIntegrate: true,
      previewRuntimeReady: false,
      completionGate: gate,
      verificationInconsistentCount: 1,
      finalWiringStepExists: true,
    });
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(false);
  });
});
