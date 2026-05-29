import { afterEach, describe, expect, it, vi } from "vitest";
import { executeCursorApiDirect } from "@/lib/prototype/cursorApiDirectClient";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

const workItems: readonly CursorWorkItem[] = [
  {
    id: "wi-1",
    taskId: "DEV-001",
    title: "task",
    prompt: "do work",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: [],
    forbiddenPaths: [],
    blocked: false,
    blockers: [],
    qualityGate: { score: 1, promptReady: true, missing: [] },
  },
];

const baseRequest = {
  projectId: "p1",
  selectedTaskId: "DEV-001",
  selectedWorkItemIds: ["wi-1"],
  workItems,
  cursorApiUrl: "http://localhost:7777",
  cursorApiToken: "secret-token",
  targetRepository: {
    owner: "o",
    repo: "r",
    repoFullName: "o/r",
    defaultBranch: "main",
    gitRepoUrl: "https://github.com/o/r",
    gitRepoProvider: "github",
  },
  workspacePath: "C:/workspace/r",
  baseBranch: "main",
  branchName: "wip/cursor/dev-001",
  commitMessage: "wip(cursor): [DEV-001]",
  prompt: "implement",
  autoCommit: true,
  autoPush: false,
  autoPr: false,
  allowedPathGlobs: ["src/**"],
} as const;

describe("executeCursorApiDirect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends bearer token to execute endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          status: "completed",
          commitSha: "abc123def4567890",
          changedFiles: ["src/a.ts"],
          branchName: "wip/cursor/dev-001",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await executeCursorApiDirect(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init?.headers && (init.headers as Record<string, string>).Authorization)).toBe(
      "Bearer secret-token",
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://localhost:7777/execute");
  });

  it("maps 404 to unsupported", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "not found",
      }),
    );
    const result = await executeCursorApiDirect(baseRequest);
    expect(result.status).toBe("unsupported");
    expect(result.ok).toBe(false);
  });

  it("never returns completed without commitSha and changedFiles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, status: "completed" }),
      }),
    );
    const result = await executeCursorApiDirect(baseRequest);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("rejects wip-stub sha as completed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            status: "completed",
            commitSha: "wip-stub-123",
            changedFiles: ["src/a.ts"],
          }),
      }),
    );
    const result = await executeCursorApiDirect(baseRequest);
    expect(result.ok).toBe(false);
  });
});
