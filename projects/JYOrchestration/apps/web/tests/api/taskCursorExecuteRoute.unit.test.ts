import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeTaskCursorApi } from "@/lib/prototype/taskCursorApiClient";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

vi.mock("@/lib/prototype/cursorApiDirectClient", () => ({
  executeCursorApiDirect: vi.fn(),
}));

import { executeCursorApiDirect } from "@/lib/prototype/cursorApiDirectClient";

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
  });

  it("uses autoPush true contract via direct client", async () => {
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

  it("maps unsupported endpoint to cursor_endpoint_unsupported", async () => {
    vi.mocked(executeCursorApiDirect).mockResolvedValue({
      ok: false,
      status: "unsupported",
      provider: "cursor_api",
      selectedTaskId: taskId,
    });
    const result = await executeTaskCursorApi(baseRequest());
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cursor_endpoint_unsupported");
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
