import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { summarizeImplementationCodeTasksForUserAction } from "@/lib/prototype/implementationCodeTaskSelectionSummary";
import { resolveImplementationBoardPrimaryAction } from "@/lib/prototype/implementationActionButtonPolicy";
import { buildVerifiedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

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

describe("P3-08C/08D selection summary and actions", () => {
  const completedIds = ["CT-1", "CT-2"];
  const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  const codeTasks = [...completedIds.map((id) => task(id)), task(sampleId, "data")];
  const units = [
    ...completedIds.map((id) => unit(id, "verified")),
    unit(sampleId, "ready"),
  ];
  const runs = completedIds.map((id) => verifiedRun(id));
  const progress = new Map([
    ...completedIds.map((id) => [id, { statusLabel: "완료", progressLabel: "GitHub outcome 저장됨" }] as const),
    [sampleId, { statusLabel: "대기", progressLabel: "실행 가능" }] as const,
  ]);
  const visible = codeTasks.map((t) => t.codeTaskId);

  it("reports runnableCount=1 when only sample data is execution-eligible", () => {
    const summary = summarizeImplementationCodeTasksForUserAction({
      codeTasks,
      units,
      runs,
      progressByCodeTaskId: progress,
      visibleCodeTaskIds: visible,
    });
    expect(summary.runnableCount).toBe(1);
    expect(summary.integrationReadyCount).toBe(2);
  });

  it("primary action is execute_selected when sample data is selected", () => {
    const summary = summarizeImplementationCodeTasksForUserAction({
      codeTasks,
      selectedCodeTaskIds: [sampleId],
      units,
      runs,
      progressByCodeTaskId: progress,
      visibleCodeTaskIds: visible,
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectedCodeTaskIds: [sampleId],
      userActionSummary: summary,
      runnableCodeTaskIds: [sampleId],
    });
    expect(action.primaryAction).toBe("execute_selected_runnable_codetasks");
    expect(action.primaryLabel).toBe("선택 작업 실행");
    expect(action.showExecuteSelectedButton).toBe(true);
    expect(action.showIntegrationPrepareButton).toBe(false);
  });

  it("primary action is integration when no runnable tasks remain", () => {
    const summary = summarizeImplementationCodeTasksForUserAction({
      codeTasks: completedIds.map((id) => task(id)),
      selectedCodeTaskIds: [],
      units: completedIds.map((id) => unit(id, "verified")),
      runs,
      progressByCodeTaskId: new Map(
        completedIds.map((id) => [id, { statusLabel: "완료", progressLabel: "GitHub outcome 저장됨" }] as const),
      ),
      visibleCodeTaskIds: completedIds,
    });
    const action = resolveImplementationBoardPrimaryAction({
      selectedCodeTaskIds: [],
      userActionSummary: summary,
      runnableCodeTaskIds: [],
      integrationPrepareEnabled: true,
    });
    expect(action.primaryAction).toBe("prepare_integration_preview");
    expect(action.showIntegrationPrepareButton).toBe(true);
  });
});
