import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  markFinalWiringIntegrationStepReady,
  resolveSelectedExecutionUnitIdsForFinalWiringGate,
} from "@/lib/prototype/implementationFinalWiringService";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const PID = "p-final-wiring";
const NOW = "2026-06-13T12:00:00.000Z";

function unit(
  input: Partial<ImplementationExecutionUnitV1> & Pick<ImplementationExecutionUnitV1, "unitId" | "codeTaskId">,
): ImplementationExecutionUnitV1 {
  return {
    processTaskId: "DEV-001",
    title: input.codeTaskId,
    order: 0,
    branchGroup: "feature",
    baseBranch: "main",
    workBranch: "wip/feature/x",
    dependencies: [],
    status: "verified",
    commitSha: "sha1",
    verifiedAt: NOW,
    ...input,
  };
}

function verifiedRun(codeTaskId: string): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `run-${codeTaskId}`,
    projectId: PID,
    processTaskId: "DEV-001",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "sha1",
    githubOutcome: {
      status: "verified",
      checkedAt: NOW,
      workBranch: "wip/feature/x",
      commitSha: "sha1",
      source: "github_rest",
    },
  };
}

describe("resolveSelectedExecutionUnitIdsForFinalWiringGate", () => {
  it("falls back to all executable units when persisted selection is empty", () => {
    const units = [
      unit({ unitId: "u1", codeTaskId: "CODE-A", order: 0 }),
      unit({ unitId: "u2", codeTaskId: "CODE-B", order: 1 }),
    ];
    const ids = resolveSelectedExecutionUnitIdsForFinalWiringGate({
      executionUnits: units,
      selectedExecutionUnitIds: [],
      codeTaskPlan: null,
    });
    expect(ids).toEqual(["u1", "u2"]);
  });

  it("excludes integration wiring task from fallback selection", () => {
    const plan: ImplementationCodeTaskPlanV1 = {
      version: "implementation_code_task_plan_v1",
      projectId: PID,
      generatedAt: NOW,
      tasks: [
        {
          codeTaskId: "CODE-A",
          parentTaskId: "DEV-001",
          title: "A",
          description: "",
          changeType: "feature",
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
        },
        {
          codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
          parentTaskId: "DEV-INT",
          title: "최종 연결/통합 Wiring",
          description: "",
          changeType: "integration",
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
        },
      ],
    };
    const units = [
      unit({ unitId: "u1", codeTaskId: "CODE-A", order: 0 }),
      unit({ unitId: "u-wiring", codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID, order: 1 }),
    ];
    const ids = resolveSelectedExecutionUnitIdsForFinalWiringGate({
      executionUnits: units,
      selectedExecutionUnitIds: [],
      codeTaskPlan: plan,
    });
    expect(ids).toEqual(["u1"]);
  });
});

describe("markFinalWiringIntegrationStepReady", () => {
  it("marks final wiring ready using all executable completed units when selected execution units are empty", async () => {
    const codeTaskId = "CODE-DEV-FRAME-001-001";
    const u = unit({ unitId: codeTaskId, codeTaskId, order: 0 });
    const result = await markFinalWiringIntegrationStepReady({
      projectId: PID,
      requirementsState: {
        implementationExecutionUnitsV1: {
          version: "implementation_execution_units_v1",
          projectId: PID,
          updatedAt: NOW,
          units: [u],
          selectedExecutionUnitIds: [],
        },
        implementationIntegrationStepsV1: {
          version: "implementation_integration_steps_v1",
          projectId: PID,
          updatedAt: NOW,
          steps: [
            {
              stepId: "final-wiring",
              kind: "final_wiring",
              title: "최종 연결/통합 Wiring",
              order: 1,
              status: "pending",
            },
          ],
        },
      },
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        projectId: PID,
        generatedAt: NOW,
        tasks: [
          {
            codeTaskId,
            parentTaskId: "DEV-FRAME-001",
            title: "Frame",
            description: "",
            changeType: "feature",
            acceptanceCriteria: [],
            verificationHints: [],
            forbiddenPaths: [],
            candidateFiles: [],
          },
        ],
      },
      runs: [verifiedRun(codeTaskId)],
      nowIso: NOW,
    });

    expect(
      result.timeline.some((t) => t.action === "implementation_final_wiring_selected_units_fallback_applied"),
    ).toBe(true);
    expect(result.timeline.some((t) => t.action === "implementation_integration_final_wiring_ready")).toBe(true);
    expect(
      result.timeline.some((t) => t.action === "implementation_integration_final_wiring_ready_blocked"),
    ).toBe(false);
    const steps = result.orchestrationPatch.implementationIntegrationStepsV1?.steps ?? [];
    expect(steps.find((s) => s.stepId === "final-wiring")?.status).toBe("ready");
  });
});
