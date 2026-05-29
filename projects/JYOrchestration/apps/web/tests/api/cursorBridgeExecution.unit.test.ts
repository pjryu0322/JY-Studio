import { describe, expect, it } from "vitest";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  validateBridgeResultForRealSourceGeneration,
  type CursorBridgeExecuteResult,
} from "@/lib/prototype/cursorBridgeExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "pjryu0322/aiproject",
  gitRepoUrl: "https://github.com/pjryu0322/aiproject",
  baseBranch: "main",
})!;

const workItem = {
  id: "wi-1",
  taskId: "DEV-1",
  title: "Task",
  prompt: "do work",
  requiredFilesHint: ["src/App.tsx"],
  expectedOutput: [],
  testCommands: [],
  forbiddenPaths: [],
  blocked: false,
  blockers: [],
  qualityGate: { promptReady: true, score: 10, missing: [] },
};

describe("buildCursorBridgeExecuteRequestFromWorkItems", () => {
  it("request contains targetRepository and execution setup fields", () => {
    const built = buildCursorBridgeExecuteRequestFromWorkItems({
      projectId: "p1",
      selectedTaskId: "DEV-1",
      selectedWorkItemIds: ["wi-1"],
      workItems: [workItem],
      targetRepository,
      branchName: "wip/cursor/dev-1",
      baseBranch: "main",
      workspaceRoot: "C:/workspace/aiproject",
      commitMessage: "wip: test",
      allowedPathGlobs: ["src/**"],
      autoCommit: true,
      autoPush: true,
      autoPr: false,
      cursorApiUrl: "https://api.cursor.com",
    });
    expect("prompt" in built).toBe(true);
    if ("prompt" in built) {
      expect(built.targetRepository.repoFullName).toBe("pjryu0322/aiproject");
      expect(built.baseBranch).toBe("main");
      expect(built.workspaceRoot).toBe("C:/workspace/aiproject");
      expect(built.allowedPathGlobs).toEqual(["src/**"]);
      expect(built.autoPush).toBe(true);
      expect(built.autoPr).toBe(false);
    }
  });
});

describe("validateBridgeResultForRealSourceGeneration", () => {
  const context = {
    targetRepository,
    allowedPathGlobs: [] as string[],
    forbiddenPathGlobs: [] as string[],
  };

  const base: CursorBridgeExecuteResult = {
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: "DEV-1",
    targetRepository: "pjryu0322/aiproject",
    commitSha: "abc123def456",
    changedFiles: ["src/App.tsx"],
  };

  it("target repo changedFiles src/App.tsx valid", () => {
    expect(validateBridgeResultForRealSourceGeneration(base, context).ok).toBe(true);
  });

  it("rejects wip-stub sha", () => {
    expect(
      validateBridgeResultForRealSourceGeneration({ ...base, commitSha: "wip-stub-1" }, context).ok,
    ).toBe(false);
  });

  it("empty changedFiles invalid", () => {
    expect(validateBridgeResultForRealSourceGeneration({ ...base, changedFiles: [] }, context).ok).toBe(
      false,
    );
  });

  it("forbidden .env invalid", () => {
    expect(
      validateBridgeResultForRealSourceGeneration({ ...base, changedFiles: [".env"] }, context).ok,
    ).toBe(false);
  });
});
