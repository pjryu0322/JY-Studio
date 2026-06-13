import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  resolveRunIntegrationReadyForBoardGate,
  summarizeCodeTaskBoardGateFromPlanAndUnits,
} from "@/lib/prototype/implementationIntegrationBoardGateSummary";
import { evaluateIntegrationPrepareGateFromBoardSummary } from "@/lib/prototype/implementationBoardIntegrationGate";
import { buildImplementationIntegrationPipelineEligibilityFromSnapshot } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import { boardTreeNode } from "./implementationBoardSummaryTestHelpers";
import {
  resolveCodeTaskBoardState,
  summarizeCodeTaskBoardRowsFromTreeNodes,
} from "@/lib/prototype/implementationCodeTaskBoardState";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";

function minimalSnapshot(input: {
  readonly selected?: number;
  readonly completed?: number;
}): ImplementationRuntimeSnapshotV1 {
  return {
    projectId: "p1",
    codeTask: {
      total: 15,
      selected: input.selected ?? 1,
      completed: input.completed ?? 0,
      failed: 0,
      inconsistent: 0,
      pendingCodeTaskIds: ["CODE-DATA-SAMPLE-001"],
      inconsistentCodeTaskIds: [],
    },
    integration: {
      finalWiringStatus: "ready",
      integrationBranchStatus: "pending",
      buildStatus: "pending",
      appPreviewTargetStatus: "pending",
      nextRequiredStep: "final_wiring",
      disabledReason: null,
    },
    preview: {
      integratedAppPreviewReady: false,
      codeTaskPreviewReady: false,
      readinessStatus: "codetask_completion_pending",
      message: "",
      previewUrl: null,
    },
    units: [],
  } as ImplementationRuntimeSnapshotV1;
}

describe("integration board gate vs pipeline eligibility", () => {
  it("allows integration when board summary shows 15 integration-ready and 0 runnable", () => {
    const nodes = Array.from({ length: 15 }, (_, i) =>
      boardTreeNode(`CT-${i + 1}`, "완료", "GitHub outcome 저장됨", true),
    );
    const boardSummary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(boardSummary.runnableCount).toBe(0);
    expect(boardSummary.integrationReadyCount).toBe(15);

    const gate = evaluateIntegrationPrepareGateFromBoardSummary(boardSummary);
    expect(gate.ok).toBe(true);
    expect(gate.resolvedAction).toBe("prepare_integration_preview");
    expect(gate.blockedCodeTaskIds).toEqual([]);

    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(
      minimalSnapshot({ selected: 1, completed: 0 }),
      { boardGateSummary: boardSummary },
    );
    expect(eligibility.canRun).toBe(true);
    expect(eligibility.userMessage).not.toContain("미완료 또는 검증 대기");
  });

  it("blocks integration when only 14 of 15 are integration-ready", () => {
    const nodes = [
      ...Array.from({ length: 14 }, (_, i) =>
        boardTreeNode(`CT-${i + 1}`, "완료", "GitHub outcome 저장됨", true),
      ),
      {
        codeTaskId: "CT-15",
        boardState: resolveCodeTaskBoardState({
          codeTaskId: "CT-15",
          title: "CT-15",
          statusLabel: "GitHub 확인 중",
          progressLabel: "검증 중",
          githubOutcomeSaved: false,
          runIntegrationReady: false,
        }),
      },
    ];
    const boardSummary = summarizeCodeTaskBoardRowsFromTreeNodes({
      nodes,
      checkedCodeTaskIds: [],
    });
    expect(boardSummary.integrationReadyCount).toBe(14);
    expect(boardSummary.totalCount).toBe(15);

    const gate = evaluateIntegrationPrepareGateFromBoardSummary(boardSummary);
    expect(gate.ok).toBe(false);
    expect(gate.message).toContain("GitHub 확인");
  });
});

describe("summarizeCodeTaskBoardGateFromPlanAndUnits", () => {
  const PID = "p-gate-summary";
  const NOW = "2026-06-13T12:00:00.000Z";

  function planTask(codeTaskId: string): ImplementationCodeTaskPlanV1["tasks"][number] {
    return {
      codeTaskId,
      parentTaskId: "DEV-001",
      title: codeTaskId,
      description: "",
      changeType: "feature",
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
      candidateFiles: [],
      branchPlan: {
        branchGroup: "feature",
        workBranch: `wip/feature/${codeTaskId}`,
        baseBranch: "main",
        executionMode: "sequential",
      },
    };
  }

  function verifiedUnit(codeTaskId: string, order: number): ImplementationExecutionUnitV1 {
    return {
      unitId: codeTaskId,
      codeTaskId,
      processTaskId: "DEV-001",
      title: codeTaskId,
      order,
      branchGroup: "feature",
      baseBranch: "main",
      workBranch: `wip/feature/${codeTaskId}`,
      dependencies: [],
      status: "verified",
      verifiedAt: NOW,
      commitSha: "abc123",
    };
  }

  it("treats completed units with persisted GitHub outcome as integration-ready when runs are missing", () => {
    const codeTaskIds = ["CODE-A", "CODE-B"];
    const plan: ImplementationCodeTaskPlanV1 = {
      version: "implementation_code_task_plan_v1",
      projectId: PID,
      generatedAt: NOW,
      tasks: codeTaskIds.map(planTask),
    };
    const gate = summarizeCodeTaskBoardGateFromPlanAndUnits({
      codeTaskPlan: plan,
      units: codeTaskIds.map((id, i) => verifiedUnit(id, i)),
      runs: [],
    });
    expect(gate.runnableCount).toBe(0);
    expect(gate.integrationReadyCount).toBe(2);
    expect(gate.totalCount).toBe(2);
    expect(gate.blockedDetails).toHaveLength(0);
    expect(evaluateIntegrationPrepareGateFromBoardSummary(gate).ok).toBe(true);
  });

  it("does not let stale runIntegrationReady=false override persisted completion evidence", () => {
    const codeTaskId = "CODE-A";
    const plan: ImplementationCodeTaskPlanV1 = {
      version: "implementation_code_task_plan_v1",
      projectId: PID,
      generatedAt: NOW,
      tasks: [planTask(codeTaskId)],
    };
    const queuedRun: CodeTaskExecutionRunV1 = {
      version: CODE_TASK_EXECUTION_RUN_VERSION,
      runId: "run-queued",
      projectId: PID,
      processTaskId: "DEV-001",
      workItemId: "wi",
      codeTaskId,
      status: "queued",
      attemptNo: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(
      resolveRunIntegrationReadyForBoardGate({
        run: queuedRun,
        githubOutcomeSaved: true,
        commitSha: "abc123",
        noCodeChangeEvidence: false,
      }),
    ).toBeNull();
    const gate = summarizeCodeTaskBoardGateFromPlanAndUnits({
      codeTaskPlan: plan,
      units: [verifiedUnit(codeTaskId, 0)],
      runs: [queuedRun],
    });
    expect(gate.integrationReadyCount).toBe(1);
    expect(gate.runnableCount).toBe(0);
  });
});
