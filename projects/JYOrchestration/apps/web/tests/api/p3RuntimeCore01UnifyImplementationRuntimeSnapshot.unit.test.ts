import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import {
  buildImplementationRuntimeSnapshot,
  formatImplementationRuntimeSnapshotSummaryLines,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { buildIntegrationEligibilitySummaryLinesFromSnapshot } from "@/lib/prototype/implementationIntegrationScopeUi";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";

const PID = "p-runtime-core-01";

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
    status: "ready",
    ...input,
  };
}

function verifiedRun(codeTaskId: string) {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `r-${codeTaskId}`,
    projectId: PID,
    processTaskId: "DEV",
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
      workBranch: "wip",
      commitSha: "abc",
      source: "github_rest" as const,
    },
  };
}

describe("P3-Runtime-Core-01 snapshot builder", () => {
  it("uses execution unit count for total even when codeTaskPlanCount is 0", () => {
    const units = Array.from({ length: 15 }, (_, i) => unit(i + 1));
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [],
      integrationSteps: [],
      codeTaskPlanCount: 0,
    });
    expect(snapshot.codeTask.total).toBe(15);
    expect(snapshot.codeTask.selected).toBe(15);
  });

  it("does not count verified without persisted outcome as completed", () => {
    const u = unit(1, { status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u],
      selectedExecutionUnitIds: [u.unitId],
      codeTaskRuns: [],
      integrationSteps: [],
    });
    expect(snapshot.codeTask.inconsistent).toBe(1);
    expect(snapshot.codeTask.completed).toBe(0);
  });

  it("counts persisted verified outcome as completed", () => {
    const u = unit(1, { status: "verified" });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [u],
      selectedExecutionUnitIds: [u.unitId],
      codeTaskRuns: [verifiedRun(u.codeTaskId)],
      integrationSteps: [],
    });
    expect(snapshot.codeTask.completed).toBe(1);
  });

  it("enables integration when all codetasks done and final_wiring pending", () => {
    const units = [unit(1, { status: "verified" })];
    const steps = buildDefaultIntegrationStepsFromBranchPlan({
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        projectId: PID,
        generatedAt: "2026-06-08T00:00:00.000Z",
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
      } as ImplementationCodeTaskPlanV1,
    });
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [verifiedRun(units[0]!.codeTaskId)],
      integrationSteps: steps,
    });
    expect(snapshot.integration.canRunIntegration).toBe(true);
    expect(snapshot.preview.integratedAppPreviewReady).toBe(false);
  });

  it("blocks integration at 14/15 completed", () => {
    const units = Array.from({ length: 15 }, (_, i) =>
      unit(i + 1, i < 14 ? { status: "verified" } : { status: "verified" }),
    );
    const runs = units.slice(0, 14).map((u) => verifiedRun(u.codeTaskId));
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: runs,
      integrationSteps: [],
    });
    expect(snapshot.codeTask.completed).toBe(14);
    expect(snapshot.integration.canRunIntegration).toBe(false);
  });
});

describe("P3-Runtime-Core-01 adapters", () => {
  it("summary lines use snapshot counts not plan counts", () => {
    const units = Array.from({ length: 15 }, (_, i) => unit(i + 1));
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [],
      integrationSteps: [],
      codeTaskPlanCount: 0,
    });
    const text = formatImplementationRuntimeSnapshotSummaryLines(snapshot).join("\n");
    expect(text).toContain("전체 CodeTask: 15개");
    expect(text).toContain("선택 CodeTask: 15개");
    expect(text).not.toContain("0 / 0");
  });

  it("integration summary does not mention excluded codetask for final wiring wait", () => {
    const units = [unit(1, { status: "verified" })];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [verifiedRun(units[0]!.codeTaskId)],
      integrationSteps: buildDefaultIntegrationStepsFromBranchPlan({
        codeTaskPlan: {
          version: "implementation_code_task_plan_v1",
          projectId: PID,
          generatedAt: "2026-06-08T00:00:00.000Z",
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
        } as ImplementationCodeTaskPlanV1,
      }),
    });
    const lines = buildIntegrationEligibilitySummaryLinesFromSnapshot(snapshot);
    expect(lines.join(" ")).not.toMatch(/미완료인 CodeTask/);
    expect(lines.some((l) => l.includes("Wiring"))).toBe(true);
  });

  it("buildImplementationExecutionSummaryCounts exposes runtimeSnapshot", () => {
    const units = Array.from({ length: 3 }, (_, i) => unit(i + 1));
    const summary = buildImplementationExecutionSummaryCounts({
      projectId: PID,
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: "2026-06-08T00:00:00.000Z",
          units,
          selectedExecutionUnitIds: units.map((u) => u.unitId),
        },
      },
      codeTaskPlan: null,
      runs: [],
    });
    expect(summary.totalCodeTaskCount).toBe(3);
    expect(summary.runtimeSnapshot.codeTask.total).toBe(3);
  });

  it("integration button follows snapshot.canRunIntegration", () => {
    const units = [unit(1, { status: "verified" })];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: [verifiedRun(units[0]!.codeTaskId)],
      integrationSteps: [],
    });
    const disabled = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(disabled.enabled).toBe(false);
  });
});
