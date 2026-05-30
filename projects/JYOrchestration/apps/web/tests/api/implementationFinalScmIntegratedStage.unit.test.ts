import { describe, expect, it } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  isFinalScmPlatformExecutionCompleted,
  prepareCodeAgentWipForFinalScmIntegratedStage,
  validateFinalScmIntegratedStageReadiness,
} from "@/lib/prototype/implementationFinalScmIntegratedStage";
import { buildPlatformScmExecutionPersistPatch } from "@/lib/prototype/prototypeExecutionPlatformScmActions";
import {
  buildInitialImplementationIntegratedExecutionState,
} from "@/lib/prototype/implementationIntegratedExecutionState";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

function realCursorWip() {
  return {
    ...buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "cursor_api",
      bridgeExecutionStatus: "bridge_completed",
      bridgeAdapter: "cursor_api",
      selectedTaskId: workItems[0]!.taskId,
    }),
    status: "developer_approved" as const,
    commits: [
      {
        sha: "abc1234567890abcdef",
        provider: "cursor" as const,
        branchName: "wip/cursor/dev-1",
        commitMessage: "wip",
        taskId: workItems[0]!.taskId,
        workItemId: workItems[0]!.id,
        changedFiles: ["src/App.tsx"],
        diffSummary: [],
        testResults: [],
        unresolvedIssues: [],
        createdAt: "2026-05-30T00:00:00.000Z",
      },
    ],
  };
}

describe("implementationFinalScmIntegratedStage", () => {
  it("validateFinalScmIntegratedStageReadiness requires developer approval before execution", () => {
    const wip = {
      ...realCursorWip(),
      status: "developer_reviewing" as const,
    };
    const result = validateFinalScmIntegratedStageReadiness(wip);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("구현 결과 승인");
  });

  it("prepareCodeAgentWipForFinalScmIntegratedStage moves developer_approved to scm_commit_pending", () => {
    const prepared = prepareCodeAgentWipForFinalScmIntegratedStage({
      wip: realCursorWip(),
      nowIso: "2026-05-30T01:00:00.000Z",
    });
    expect(prepared.status).toBe("scm_commit_pending");
    expect(prepared.platformScmExecutionV1?.pushStatus).toBe("push_requested");
  });

  it("isFinalScmPlatformExecutionCompleted detects pr_completed", () => {
    const wip = {
      ...realCursorWip(),
      platformScmExecutionV1: {
        version: "platform_scm_execution_v1" as const,
        projectId: "p1",
        selectedTaskId: workItems[0]!.taskId,
        sourceCommitSha: "abc1234567890abcdef",
        sourceBranchName: "wip/cursor/dev-1",
        targetRepository: "owner/repo",
        pushStatus: "pr_completed" as const,
        prNumber: 7,
        createdAt: "2026-05-30T00:00:00.000Z",
        updatedAt: "2026-05-30T01:00:00.000Z",
      },
    };
    expect(isFinalScmPlatformExecutionCompleted(wip)).toBe(true);
  });

  it("buildPlatformScmExecutionPersistPatch finalizes integrated final_scm on success", () => {
    const wip = realCursorWip();
    let integrated = buildInitialImplementationIntegratedExecutionState({ projectId: "p1" });
    integrated = {
      ...integrated,
      items: integrated.items.map((item) =>
        item.step === "final_scm"
          ? { ...item, status: "in_progress" as const, startedAt: "2026-05-30T00:00:00.000Z" }
          : item.step === "refactor_common" ||
              item.step === "integrated_review" ||
              item.step === "integrated_security"
            ? { ...item, status: "done" as const, completedAt: "2026-05-30T00:00:00.000Z" }
            : item,
      ),
    };
    const patch = buildPlatformScmExecutionPersistPatch({
      requirementsStateJson: {},
      wip,
      executorResult: {
        ok: true,
        status: "completed",
        message: "PR #42 created",
        platformScmExecutionV1: {
          version: "platform_scm_execution_v1",
          projectId: "p1",
          selectedTaskId: workItems[0]!.taskId,
          sourceCommitSha: "abc1234567890abcdef",
          sourceBranchName: "wip/cursor/dev-1",
          targetRepository: "owner/repo",
          pushStatus: "pr_completed",
          prNumber: 42,
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T01:00:00.000Z",
        },
        prNumber: 42,
      },
      integratedExecutionState: integrated,
      projectId: "p1",
      finalizeIntegratedFinalScm: true,
      taskRowsCompleted: true,
    });
    expect(patch.orchestration.kind).toBe("completed");
    expect(patch.integratedExecutionState?.items.find((i) => i.step === "final_scm")?.status).toBe("done");
  });
});
