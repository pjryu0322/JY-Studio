import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { buildVerifiedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  isIntegrationReadyCodeTask,
  isUserSelectableRunnableCodeTask,
  listUserSelectableRunnableCodeTaskIds,
} from "@/lib/prototype/implementationRunnableCodeTaskSelection";
import { summarizeImplementationCodeTasksForUserAction } from "@/lib/prototype/implementationCodeTaskSelectionSummary";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import { resolveCodeTaskTreeSelectAll } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

const NOW = "2026-06-03T12:00:00.000Z";

function task(id: string, changeType = "screen"): ImplementationCodeTaskV1 {
  return {
    codeTaskId: id,
    parentTaskId: "DEV-A",
    title: id,
    description: "d",
    changeType,
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    candidateFileHints: [],
    ...(id === CANONICAL_SAMPLE_DATA_CODE_TASK_ID
      ? {
          branchPlan: {
            branchGroup: "data",
            baseBranch: "main",
            workBranch: "feat/sample",
            executionMode: "sequential",
          },
        }
      : {}),
  };
}

function unit(codeTaskId: string, status: ImplementationExecutionUnitV1["status"]): ImplementationExecutionUnitV1 {
  return {
    version: "implementation_execution_unit_v1",
    unitId: `u-${codeTaskId}`,
    projectId: "p1",
    codeTaskId,
    processTaskId: "DEV-A",
    title: codeTaskId,
    order: 1,
    branchGroup: codeTaskId === CANONICAL_SAMPLE_DATA_CODE_TASK_ID ? "data" : "screen",
    baseBranch: "main",
    workBranch: `feat/${codeTaskId}`,
    status,
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
    commitSha: "abc",
    branchHeadCommitSha: "abc",
    githubOutcome: buildVerifiedCodeTaskGithubOutcome({
      checkedAt: NOW,
      workBranch: `feat/${codeTaskId}`,
      commitSha: "abc",
    }),
  };
}

describe("runnable CodeTask user selection (P3-08D)", () => {
  const completed = ["CT-1", "CT-2"];
  const sample = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  const codeTasks = [...completed.map((id) => task(id)), task(sample, "data")];
  const units = [...completed.map((id) => unit(id, "verified")), unit(sample, "ready")];
  const runs = completed.map((id) => verifiedRun(id));
  const progress = new Map([
    ...completed.map((id) => [id, { statusLabel: "완료", progressLabel: "GitHub outcome 저장됨" }] as const),
    [sample, { statusLabel: "대기", progressLabel: "실행 가능" }] as const,
  ]);

  it("sample data 대기/실행 가능 is user selectable", () => {
    expect(
      isUserSelectableRunnableCodeTask({
        codeTask: codeTasks.find((t) => t.codeTaskId === sample)!,
        unit: units.find((u) => u.codeTaskId === sample)!,
        runs: [],
        statusLabel: "대기",
        progressLabel: "실행 가능",
      }),
    ).toBe(true);
  });

  it("completed outcome saved is not user selectable", () => {
    expect(
      isUserSelectableRunnableCodeTask({
        codeTask: codeTasks[0]!,
        unit: units[0]!,
        runs,
        statusLabel: "완료",
        progressLabel: "GitHub outcome 저장됨",
      }),
    ).toBe(false);
    expect(isIntegrationReadyCodeTask({ codeTask: codeTasks[0]!, unit: units[0]!, runs })).toBe(true);
  });

  it("summary reports runnable 1 and integration ready 2", () => {
    const summary = summarizeImplementationCodeTasksForUserAction({
      codeTasks,
      units,
      runs,
      progressByCodeTaskId: progress,
    });
    expect(summary.runnableCount).toBe(1);
    expect(summary.integrationReadyCount).toBe(2);
  });

  it("select all picks only 대기 (user-selectable) sample task", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      tasks: codeTasks,
    };
    const selected = resolveCodeTaskTreeSelectAll({
      selectAll: true,
      codeTaskPlan: plan,
      userSelectableCodeTaskIds: [sample],
    });
    expect(selected).toEqual([sample]);
  });

  it("does not show board execute when sample selected", () => {
    const summary = summarizeImplementationCodeTasksForUserAction({
      codeTasks,
      selectedCodeTaskIds: [sample],
      units,
      runs,
      progressByCodeTaskId: progress,
    });
    const action = resolveImplementationBoardPrimaryAction({
      userActionSummary: summary,
    });
    expect(action.showExecuteSelectedButton).toBe(false);
    expect(action.showIntegrationPrepareButton).toBe(true);
  });

  it("primary action is integration when no runnable left", () => {
    const allDone = codeTasks.map((t) => t.codeTaskId);
    const summary = summarizeImplementationCodeTasksForUserAction({
      codeTasks,
      selectedCodeTaskIds: [],
      units: allDone.map((id) => unit(id, "verified")),
      runs: allDone.map((id) => verifiedRun(id)),
      progressByCodeTaskId: new Map(
        allDone.map((id) => [id, { statusLabel: "완료", progressLabel: "GitHub outcome 저장됨" }] as const),
      ),
    });
    const action = resolveImplementationBoardPrimaryAction({
      userActionSummary: summary,
      integrationPrepareEnabled: true,
    });
    expect(action.primaryAction).toBe("prepare_integration_preview");
  });

  it("listUserSelectableRunnableCodeTaskIds without progress map uses unit labels", () => {
    const ids = listUserSelectableRunnableCodeTaskIds({
      codeTasks,
      units,
      runs: [],
    });
    expect(ids).toContain(sample);
  });
});
