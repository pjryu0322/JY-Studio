import { describe, expect, it } from "vitest";
import {
  mapCursorApiDirectResultToBridgeResult,
  buildCursorApiDirectRequestFromBridgeRequest,
} from "@/lib/prototype/cursorApiDirectExecution";
import type { CursorBridgeExecuteRequest } from "@/lib/prototype/cursorBridgeExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["mock"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "pjryu0322/aiproject",
  baseBranch: "main",
})!;

function bridgeRequest(): CursorBridgeExecuteRequest {
  return {
    projectId: "p1",
    selectedTaskId: workItems[0]!.taskId,
    selectedWorkItemIds: [workItems[0]!.id],
    workItems,
    targetRepository,
    branchName: "wip/cursor/dev-mock-001",
    baseBranch: "main",
    workspaceRoot: "C:/workspace/aiproject",
    commitMessage: "feat: mock",
    prompt: "implement mock",
    autoCommit: true,
    autoPush: false,
    autoPr: false,
    allowedPathGlobs: ["src/**"],
    forbiddenPathGlobs: [],
    cursorApiUrl: "https://api.cursor.com",
    bridgeAdapter: "cursor_api",
  };
}

describe("cursorApiDirectExecution", () => {
  it("buildCursorApiDirectRequestFromBridgeRequest maps bridge request fields", () => {
    const direct = buildCursorApiDirectRequestFromBridgeRequest(bridgeRequest(), "token-123");
    expect(direct.cursorApiUrl).toBe("https://api.cursor.com");
    expect(direct.workspacePath).toBe("C:/workspace/aiproject");
    expect(direct.branchName).toBe("wip/cursor/dev-mock-001");
  });

  it("rejects wip-stub sha in mapCursorApiDirectResultToBridgeResult", () => {
    const mapped = mapCursorApiDirectResultToBridgeResult(bridgeRequest(), {
      ok: true,
      status: "completed",
      provider: "cursor_api",
      selectedTaskId: workItems[0]!.taskId,
      commitSha: "wip-stub-123",
      changedFiles: ["src/a.ts"],
      branchName: "wip/cursor/dev-mock-001",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.status).not.toBe("completed");
  });

  it("rejects empty changedFiles in mapCursorApiDirectResultToBridgeResult", () => {
    const mapped = mapCursorApiDirectResultToBridgeResult(bridgeRequest(), {
      ok: true,
      status: "completed",
      provider: "cursor_api",
      selectedTaskId: workItems[0]!.taskId,
      commitSha: "abc1234567890",
      changedFiles: [],
      branchName: "wip/cursor/dev-mock-001",
    });
    expect(mapped.ok).toBe(false);
  });

  it("accepts real sha and changedFiles", () => {
    const mapped = mapCursorApiDirectResultToBridgeResult(bridgeRequest(), {
      ok: true,
      status: "completed",
      provider: "cursor_api",
      selectedTaskId: workItems[0]!.taskId,
      commitSha: "abc1234567890abcdef",
      changedFiles: ["src/mock.ts"],
      branchName: "wip/cursor/dev-mock-001",
      pushed: false,
      pushStatus: "skipped",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.status).toBe("completed");
    expect(mapped.commitSha).toBe("abc1234567890abcdef");
    expect(mapped.changedFiles).toEqual(["src/mock.ts"]);
  });
});
