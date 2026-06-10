import { describe, expect, it } from "vitest";
import {
  CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
} from "@/lib/prototype/codeTaskCanonicalId";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildVerifiedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  evaluateExecutionSelectionGate,
  evaluateIntegrationBoardSelectionGate,
  filterCodeTaskIdsForSelectionMode,
  getCodeTaskSelectionEligibility,
} from "@/lib/prototype/implementationCodeTaskSelectionPolicy";
import {
  isCodeTaskTreeFullySelected,
  resolveCodeTaskTreeSelectAll,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { evaluateQuickRunExecutionSelectionGate } from "@/lib/prototype/implementationExecutionButtonPolicy";

const NOW = "2026-06-03T12:00:00.000Z";

function codeTask(overrides: Partial<ImplementationCodeTaskV1> & Pick<ImplementationCodeTaskV1, "codeTaskId">): ImplementationCodeTaskV1 {
  return {
    parentTaskId: "DEV-A",
    title: overrides.codeTaskId,
    description: "d",
    changeType: "screen",
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    candidateFileHints: [],
    ...overrides,
  };
}

function unitFor(input: {
  readonly codeTaskId: string;
  readonly status?: ImplementationExecutionUnitV1["status"];
}): ImplementationExecutionUnitV1 {
  return {
    version: "implementation_execution_unit_v1",
    unitId: `unit-${input.codeTaskId}`,
    projectId: "p1",
    codeTaskId: input.codeTaskId,
    processTaskId: "DEV-A",
    title: input.codeTaskId,
    order: 1,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: `feat/${input.codeTaskId}`,
    status: input.status ?? "ready",
    retryable: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function verifiedRun(codeTaskId: string): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: `run-${codeTaskId}`,
    projectId: "p1",
    processTaskId: "DEV-A",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "abc123",
    branchHeadCommitSha: "abc123",
    githubOutcome: buildVerifiedCodeTaskGithubOutcome({
      checkedAt: NOW,
      workBranch: `feat/${codeTaskId}`,
      commitSha: "abc123",
    }),
  };
}

describe("implementationCodeTaskSelectionPolicy", () => {
  const completedId = "CT-DONE";
  const pendingId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  const codeTasks = [
    codeTask({
      codeTaskId: completedId,
      branchPlan: {
        branchGroup: "screen",
        baseBranch: "main",
        workBranch: "feat/done",
        executionMode: "sequential",
      },
    }),
    codeTask({
      codeTaskId: pendingId,
      title: "샘플 데이터 생성",
      changeType: "data",
      branchPlan: {
        branchGroup: "data",
        baseBranch: "main",
        workBranch: "feat/sample",
        executionMode: "sequential",
      },
    }),
  ];
  const units = [
    unitFor({ codeTaskId: completedId, status: "verified" }),
    unitFor({ codeTaskId: pendingId, status: "ready" }),
  ];
  const runs = [verifiedRun(completedId)];
  const progress = new Map([
    [completedId, { statusLabel: "완료", progressLabel: "GitHub outcome 저장됨" }],
    [pendingId, { statusLabel: "대기", progressLabel: "실행 가능" }],
  ]);

  it("allows completed task in integration mode only when outcome saved", () => {
    const eligibility = getCodeTaskSelectionEligibility({
      mode: "integration",
      quiet: true,
      context: {
        codeTask: codeTasks[0]!,
        unit: units[0],
        runs,
        statusLabel: "완료",
        progressLabel: "GitHub outcome 저장됨",
      },
    });
    expect(eligibility.selectable).toBe(true);
  });

  it("blocks pending sample data in integration mode", () => {
    const eligibility = getCodeTaskSelectionEligibility({
      mode: "integration",
      quiet: true,
      context: {
        codeTask: codeTasks[1]!,
        unit: units[1],
        runs: [],
        statusLabel: "대기",
        progressLabel: "실행 가능",
      },
    });
    expect(eligibility.selectable).toBe(false);
    expect(eligibility.reason).toBe("not_completed_for_integration");
  });

  it("allows pending sample data in execution mode", () => {
    const eligibility = getCodeTaskSelectionEligibility({
      mode: "execution",
      quiet: true,
      context: {
        codeTask: codeTasks[1]!,
        unit: units[1],
        runs: [],
        statusLabel: "대기",
        progressLabel: "실행 가능",
      },
    });
    expect(eligibility.selectable).toBe(true);
  });

  it("blocks completed task from being newly selected in execution mode", () => {
    const eligibility = getCodeTaskSelectionEligibility({
      mode: "execution",
      quiet: true,
      context: {
        codeTask: codeTasks[0]!,
        unit: units[0],
        runs,
        statusLabel: "완료",
        progressLabel: "GitHub outcome 저장됨",
      },
    });
    expect(eligibility.selectable).toBe(false);
    expect(eligibility.reason).toBe("already_completed");
  });

  it("execution select-all picks 대기 tasks only", () => {
    const plan: ImplementationCodeTaskPlanV1 = {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      tasks: codeTasks,
    };
    const waitingIds = [pendingId];
    const selected = resolveCodeTaskTreeSelectAll({
      selectAll: true,
      codeTaskPlan: plan,
      userSelectableCodeTaskIds: waitingIds,
    });
    expect(selected).toEqual([pendingId]);
    expect(
      isCodeTaskTreeFullySelected({
        selectedCodeTaskIds: selected,
        codeTaskPlan: plan,
        userSelectableCodeTaskIds: waitingIds,
      }),
    ).toBe(true);
  });

  it("integration select-all picks completed tasks only", () => {
    const ids = filterCodeTaskIdsForSelectionMode({
      codeTaskIds: codeTasks.map((t) => t.codeTaskId),
      mode: "integration",
      codeTasks,
      units,
      runs,
      progressByCodeTaskId: progress,
    });
    expect(ids).toEqual([completedId]);
  });

  it("quick run gate allows sample-only selection", () => {
    const gate = evaluateQuickRunExecutionSelectionGate({
      selectedCodeTaskIds: [pendingId],
      runnableCodeTaskIdsFromBoard: [pendingId],
    });
    expect(gate.ok).toBe(true);
    expect(gate.runnableIds).toEqual([pendingId]);
  });

  it("integration board gate rejects mixed pending + completed selection", () => {
    const gate = evaluateIntegrationBoardSelectionGate({
      selectedCodeTaskIds: [completedId, pendingId],
      codeTasks,
      units,
      runs,
    });
    expect(gate.ok).toBe(false);
    expect(gate.message).toContain("통합에는 완료된 CodeTask만");
  });

  it("evaluateExecutionSelectionGate blocks completed-only selection", () => {
    const gate = evaluateExecutionSelectionGate({
      selectedCodeTaskIds: [completedId],
      codeTasks,
      units,
      runs,
    });
    expect(gate.ok).toBe(false);
  });
});
