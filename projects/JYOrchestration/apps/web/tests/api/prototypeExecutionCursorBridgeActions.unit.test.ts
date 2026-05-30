import { describe, expect, it } from "vitest";
import {
  applyCursorBridgeResultToWipExecution,
  buildCursorBridgeOrchestrationResult,
  patchWipForCursorBridgePhase,
} from "@/lib/prototype/prototypeExecutionCursorBridgeActions";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  toCodeAgentTargetRepositorySnapshot,
} from "@/lib/prototype/projectTargetRepository";

const NOW = "2026-05-29T12:00:00.000Z";

const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "pjryu0322/aiproject",
  baseBranch: "main",
})!;

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

function baseWip() {
  const wip = buildInitialCodeAgentWipExecution({
    projectId: "p1",
    plan,
    workItems,
    provider: "cursor",
  });
  const taskId = workItems[0]!.taskId;
  return {
    ...wip,
    selectedTaskId: taskId,
    executionMode: "cursor_bridge" as const,
    bridgeExecutionStatus: "bridge_running" as const,
    targetRepositorySnapshot: toCodeAgentTargetRepositorySnapshot(targetRepository),
    targetRepoFullName: targetRepository.repoFullName,
    workspacePath: "C:/workspace/aiproject",
    baseBranch: "main",
    bridgeAllowedPathGlobs: ["src/**"],
    bridgeAutoPush: false,
    bridgeAutoPr: false,
  };
}

describe("applyCursorBridgeResultToWipExecution", () => {
  it("valid result becomes bridge_completed with commitSha and push skipped", () => {
    const updated = applyCursorBridgeResultToWipExecution({
      wip: baseWip(),
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItems[0]!.taskId,
        targetRepository: targetRepository.repoFullName,
        branchName: "wip/cursor/dev-1",
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx"],
        pushed: false,
        workspacePath: "C:/workspace/aiproject",
      },
      commitTitle: "wip: test",
      nowIso: NOW,
    });
    expect(updated.bridgeExecutionStatus).toBe("bridge_completed");
    expect(updated.executionMode).toBe("cursor_api");
    expect(updated.bridgeAdapter).toBe("cursor_api");
    expect(updated.bridgeAdapter).toBe("cursor_api");
    expect(updated.executionStatus).toBe("bridge_completed");
    expect(updated.commitSha).toBe("abc123def4567890");
    expect(updated.pushStatus).toBe("skipped");
    expect(updated.commits[updated.commits.length - 1]?.changedFiles).toEqual(["src/App.tsx"]);
  });

  it("wip-stub sha becomes failed", () => {
    const updated = applyCursorBridgeResultToWipExecution({
      wip: baseWip(),
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItems[0]!.taskId,
        targetRepository: targetRepository.repoFullName,
        commitSha: "wip-stub-1",
        changedFiles: ["src/App.tsx"],
        branchName: "wip/cursor/dev-1",
      },
      commitTitle: "wip",
      nowIso: NOW,
    });
    expect(updated.bridgeExecutionStatus).toBe("failed");
    expect(updated.bridgeErrorMessage).toContain("인정되지 않았습니다");
    expect(updated.bridgeErrorMessage).toContain("Cursor API 호출은 성공했지만");
  });

  it("empty changedFiles becomes failed", () => {
    const updated = applyCursorBridgeResultToWipExecution({
      wip: baseWip(),
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItems[0]!.taskId,
        commitSha: "abc123def4567890",
        changedFiles: [],
        branchName: "wip/cursor/dev-1",
      },
      commitTitle: "wip",
      nowIso: NOW,
    });
    expect(updated.bridgeExecutionStatus).toBe("failed");
  });
});

describe("buildCursorBridgeOrchestrationResult", () => {
  it("rejection returns failed kind with orchestration patch", () => {
    const wip = baseWip();
    const result = buildCursorBridgeOrchestrationResult({
      requirementsStateJson: {},
      wip,
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItems[0]!.taskId,
        commitSha: "wip-stub",
        changedFiles: ["src/App.tsx"],
        branchName: "wip/cursor/dev-1",
      },
      nowIso: NOW,
    });
    expect(result.kind).toBe("failed");
    expect(result.orchestrationPatch?.codeAgentWipExecutionV1.bridgeExecutionStatus).toBe("failed");
  });

  it("completed result adds cursor_api_direct_execution_completed timeline", () => {
    const wip = baseWip();
    const result = buildCursorBridgeOrchestrationResult({
      requirementsStateJson: {},
      wip,
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItems[0]!.taskId,
        targetRepository: targetRepository.repoFullName,
        branchName: "wip/cursor/dev-1",
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx", "src/B.tsx"],
        pushed: true,
        pushStatus: "success",
        prStatus: "PR: 미수행",
        workspacePath: "C:/workspace/aiproject",
      },
      runId: "cursor-run-001",
      nowIso: NOW,
    });
    expect(result.kind).toBe("completed");
    const actions = result.orchestrationPatch?.promptTimeline?.map((e) => e.action) ?? [];
    expect(actions).toContain("cursor_api_direct_execution_completed");
    expect(actions).toContain("cursor_api_git_commit_created");
    expect(actions).toContain("cursor_api_git_push_completed");
  });
});

describe("patchWipForCursorBridgePhase", () => {
  it("sets bridge_requested with cursor_api execution mode", () => {
    const wip = baseWip();
    const patched = patchWipForCursorBridgePhase({
      wip,
      phase: "requested",
      targetRepository: targetRepository.repoFullName,
      workspacePath: "C:/workspace/aiproject",
      baseBranch: "main",
    });
    expect(patched.bridgeExecutionStatus).toBe("bridge_requested");
    expect(patched.executionMode).toBe("cursor_api");
    expect(patched.executionStatus).toBe("bridge_requested");
  });
});
