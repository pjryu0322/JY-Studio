import { describe, expect, it, vi } from "vitest";
import { executeCursorBridgeWorkItem } from "@/lib/prototype/cursorBridgeClient";
import {
  CURSOR_API_NOT_CONFIGURED_MESSAGE,
  CURSOR_API_TOKEN_MISSING_MESSAGE,
} from "@/lib/prototype/cursorExecutionAvailability";

vi.mock("@/lib/prototype/cursorApiDirectExecution", () => ({
  executeCursorApiDirectFromBridgeRequest: vi.fn(async () => ({
    ok: true,
    provider: "cursor",
    status: "completed",
    selectedTaskId: "dev-1",
    commitSha: "abc123def4567890",
    changedFiles: ["src/App.tsx"],
    branchName: "wip/cursor/dev-1",
  })),
}));

import { executeCursorApiDirectFromBridgeRequest } from "@/lib/prototype/cursorApiDirectExecution";

const baseRequest = {
  projectId: "p1",
  selectedTaskId: "dev-1",
  selectedWorkItemIds: ["wi-1"],
  workItems: [],
  targetRepository: { repoFullName: "o/r", defaultBranch: "main", cloneUrl: "https://github.com/o/r" },
  branchName: "wip/cursor/dev-1",
  baseBranch: "main",
  workspaceRoot: "C:/workspace/r",
  prompt: "test",
  autoCommit: true,
  autoPush: false,
  autoPr: false,
  allowedPathGlobs: ["src/**"],
  forbiddenPathGlobs: [],
  cursorApiUrl: "http://localhost:9999",
} as const;

describe("executeCursorBridgeWorkItem", () => {
  it("calls executeCursorApiDirectFromBridgeRequest when url and token exist", async () => {
    vi.mocked(executeCursorApiDirectFromBridgeRequest).mockClear();
    await executeCursorBridgeWorkItem({ ...baseRequest }, { cursorApiToken: "secret-token" });
    expect(executeCursorApiDirectFromBridgeRequest).toHaveBeenCalledTimes(1);
  });

  it("returns blocked when cursorApiUrl missing", async () => {
    const result = await executeCursorBridgeWorkItem(
      { ...baseRequest, cursorApiUrl: undefined },
      { cursorApiToken: "secret-token" },
    );
    expect(result.status).toBe("blocked");
    expect(result.errorMessage).toBe(CURSOR_API_NOT_CONFIGURED_MESSAGE);
  });

  it("returns blocked when cursor token missing", async () => {
    const result = await executeCursorBridgeWorkItem({ ...baseRequest });
    expect(result.status).toBe("blocked");
    expect(result.errorMessage).toBe(CURSOR_API_TOKEN_MISSING_MESSAGE);
  });
});
