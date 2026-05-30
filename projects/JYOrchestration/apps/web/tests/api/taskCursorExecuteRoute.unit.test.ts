import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeTaskCursorApi, shouldUseTaskCursorCloudAgentApi } from "@/lib/prototype/taskCursorApiClient";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

vi.mock("@/lib/prototype/cursorApiDirectClient", () => ({
  executeCursorApiDirect: vi.fn(),
}));

vi.mock("@/lib/prototype/taskCursorCloudAgentClient", () => ({
  executeTaskCursorViaCloudAgent: vi.fn(),
}));

import { executeCursorApiDirect } from "@/lib/prototype/cursorApiDirectClient";
import { executeTaskCursorViaCloudAgent } from "@/lib/prototype/taskCursorCloudAgentClient";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
const taskId = plan.items[0]?.id ?? "DEV-1";
const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "owner/repo",
  baseBranch: "main",
})!;

function baseRequest() {
  return {
    projectId: "p1",
    taskId,
    workItemIds: workItems.map((w) => w.id),
    workItems,
    cursorApiUrl: "https://cursor.example.com",
    cursorApiToken: "cursor-token",
    targetRepository,
    workspacePath: "C:/workspace/repo",
    baseBranch: "main",
    workBranch: "wip/cursor/dev-1",
    commitMessage: `wip: ${taskId}`,
    prompt: "implement",
    allowedPathGlobs: ["src/**"],
  };
}

describe("executeTaskCursorApi", () => {
  beforeEach(() => {
    vi.mocked(executeCursorApiDirect).mockReset();
    vi.mocked(executeTaskCursorViaCloudAgent).mockReset();
  });

  it("routes default Cursor API URL to Cloud Agent execution", async () => {
    expect(shouldUseTaskCursorCloudAgentApi("https://api.cursor.com")).toBe(true);
    vi.mocked(executeTaskCursorViaCloudAgent).mockResolvedValue({
      ok: true,
      status: "completed",
      taskId,
      commitSha: "abc123def4567890",
      changedFiles: ["src/App.tsx"],
      pushed: true,
    });
    const request = { ...baseRequest(), cursorApiUrl: "https://api.cursor.com" };
    const result = await executeTaskCursorApi(request);
    expect(result.ok).toBe(true);
    expect(executeTaskCursorViaCloudAgent).toHaveBeenCalledWith(request);
    expect(executeCursorApiDirect).not.toHaveBeenCalled();
  });

  it("uses autoPush true contract via direct client for custom bridge URL", async () => {
    vi.mocked(executeCursorApiDirect).mockResolvedValue({
      ok: true,
      status: "completed",
      provider: "cursor_api",
      selectedTaskId: taskId,
      commitSha: "abc123def4567890",
      changedFiles: ["src/App.tsx"],
      pushed: true,
      branchName: "wip/cursor/dev-1",
    });
    const result = await executeTaskCursorApi(baseRequest());
    expect(result.ok).toBe(true);
    expect(executeCursorApiDirect).toHaveBeenCalledWith(
      expect.objectContaining({ autoPush: true, autoPr: false }),
    );
  });

  it("falls back to Cloud Agent when custom bridge /execute is unsupported", async () => {
    vi.mocked(executeCursorApiDirect).mockResolvedValue({
      ok: false,
      status: "unsupported",
      provider: "cursor_api",
      selectedTaskId: taskId,
    });
    vi.mocked(executeTaskCursorViaCloudAgent).mockResolvedValue({
      ok: true,
      status: "completed",
      taskId,
      commitSha: "abc123def4567890",
      changedFiles: ["src/App.tsx"],
      pushed: true,
    });
    const result = await executeTaskCursorApi(baseRequest());
    expect(result.ok).toBe(true);
    expect(executeTaskCursorViaCloudAgent).toHaveBeenCalled();
  });

  it("returns cloud agent failure when custom bridge /execute is unsupported", async () => {
    vi.mocked(executeCursorApiDirect).mockResolvedValue({
      ok: false,
      status: "unsupported",
      provider: "cursor_api",
      selectedTaskId: taskId,
    });
    vi.mocked(executeTaskCursorViaCloudAgent).mockResolvedValue({
      ok: false,
      status: "failed",
      taskId,
      reason: "unknown",
      message: "Cloud Agent 실행 실패",
    });
    const result = await executeTaskCursorApi(baseRequest());
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Cloud Agent 실행 실패");
    expect(executeTaskCursorViaCloudAgent).toHaveBeenCalled();
  });

  it("rejects wip-stub success", async () => {
    vi.mocked(executeCursorApiDirect).mockResolvedValue({
      ok: true,
      status: "completed",
      provider: "cursor_api",
      selectedTaskId: taskId,
      commitSha: "wip-stub-1",
      changedFiles: ["src/App.tsx"],
      pushed: true,
    });
    const result = await executeTaskCursorApi(baseRequest());
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("commit_not_created");
  });
});
