import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { buildTaskCursorGithubBranchCandidates } from "@/lib/prototype/taskCursorGithubBranchCandidates";
import { patchRunWithGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildCanonicalProcessTaskIdForCodeTask,
  CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID,
  evaluateWorkBranchRepairForVerify,
  isInvalidVerifyBranchContext,
  isLegacyMockProcessTaskId,
  isRunTargetTupleConsistent,
  repairLegacyMockProcessTaskId,
  resolveCanonicalCodeTaskRunTarget,
  shouldDiscardStaleMockProcessRun,
} from "@/lib/prototype/codeTaskRunTargetCanonical";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";

function sampleDataTask(parentTaskId = "DEV-MOCK-001"): ImplementationCodeTaskV1 {
  return {
    codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
    parentTaskId,
    title: "샘플 데이터 생성",
    description: "sample",
    changeType: "data",
    targetHints: ["data"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: ["forbidden"],
    branchPlan: {
      branchGroup: "data",
      workBranch: "wip/data/sample-data",
      baseBranch: "wip/foundation/app-shell",
      executionMode: "sequential",
    },
    fileBoundary: {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/data/sample/*"],
      ownedFiles: ["src/data/sample/*"],
      forbiddenFiles: [],
    },
  };
}

describe("P3-M63 canonical verify target tuple", () => {
  it("builds canonical sample-data tuple from branch plan", () => {
    const target = resolveCanonicalCodeTaskRunTarget({ codeTask: sampleDataTask() });
    expect(target).toMatchObject({
      processTaskId: CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID,
      codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
      branchGroup: "data",
      baseBranch: "wip/foundation/app-shell",
      workBranch: "wip/data/sample-data",
    });
  });

  it("repairs DEV-MOCK process task id for sample-data code task", () => {
    expect(
      repairLegacyMockProcessTaskId({
        taskId: "DEV-MOCK-001",
        codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
        branchGroup: "data",
      }),
    ).toBe(CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID);
  });

  it("maps CODE-DEV-FRAME to DEV-FRAME-001", () => {
    expect(
      buildCanonicalProcessTaskIdForCodeTask({
        codeTaskId: "CODE-DEV-FRAME-001-001",
        branchGroup: "foundation",
      }),
    ).toBe("DEV-FRAME-001");
  });

  it("flags inconsistent DEV-MOCK + sample-data tuple", () => {
    expect(
      isRunTargetTupleConsistent({
        taskId: "DEV-MOCK-001",
        codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
      }),
    ).toBe(false);
  });

  it("discards stale DEV-MOCK + frame tuple", () => {
    expect(
      shouldDiscardStaleMockProcessRun({
        processTaskId: "DEV-MOCK-001",
        codeTaskId: "CODE-DEV-FRAME-001-001",
      }),
    ).toBe(true);
  });

  it("omits conflicting execution work branch when branch plan is set", () => {
    const candidates = buildTaskCursorGithubBranchCandidates({
      codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
      branchPlanWorkBranch: "wip/data/sample-data",
      executionWorkBranch: "wip/foundation/app-shell",
      runWorkBranch: "wip/data/sample-data",
      promptWorkBranch: "wip/data/sample-data",
    });
    expect(candidates[0]).toBe("wip/data/sample-data");
    expect(candidates).not.toContain("wip/foundation/app-shell");
  });

  it("blocks data → foundation work branch repair", () => {
    const evalResult = evaluateWorkBranchRepairForVerify({
      fromBranch: "wip/data/sample-data",
      toBranch: "wip/foundation/app-shell",
      branchPlanWorkBranch: "wip/data/sample-data",
      branchPlanBaseBranch: "wip/foundation/app-shell",
      branchGroup: "data",
    });
    expect(evalResult.allow).toBe(false);
    expect(["cross_code_task_branch_repair_forbidden", "work_branch_repair_to_base_forbidden"]).toContain(
      evalResult.reason,
    );
  });

  it("allows legacy cursor branch → canonical plan work branch", () => {
    const evalResult = evaluateWorkBranchRepairForVerify({
      fromBranch: "wip/cursor/code-dev-sample-data-001",
      toBranch: "wip/data/sample-data",
      branchPlanWorkBranch: "wip/data/sample-data",
      branchGroup: "data",
    });
    expect(evalResult.allow).toBe(true);
  });

  it("detects invalid verify context when base equals work", () => {
    expect(
      isInvalidVerifyBranchContext({
        baseBranch: "wip/foundation/app-shell",
        workBranch: "wip/foundation/app-shell",
      }),
    ).toBe(true);
  });

  it("blocks outcome persist when run codeTaskId mismatches", () => {
    const run: CodeTaskExecutionRunV1 = {
      runId: "run-1",
      projectId: "p1",
      processTaskId: CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID,
      workItemId: "w1",
      codeTaskId: "CODE-DEV-FRAME-001-001",
      status: "cursor_running",
      workBranch: "wip/foundation/app-shell",
      updatedAt: new Date().toISOString(),
    };
    const patch = patchRunWithGithubOutcome({
      run,
      expectedCodeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
      nowIso: new Date().toISOString(),
      githubOutcome: {
        status: "verified",
        checkedAt: new Date().toISOString(),
        workBranch: "wip/data/sample-data",
        commitSha: "abc123",
        source: "github_rest",
      },
    });
    expect(patch).toEqual({});
  });

  it("detects legacy mock process task id", () => {
    expect(isLegacyMockProcessTaskId("DEV-MOCK-001")).toBe(true);
    expect(isLegacyMockProcessTaskId(CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID)).toBe(false);
  });
});
