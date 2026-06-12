import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import {
  TASK_CURSOR_GITHUB_VERIFY_NON_JSON_USER_MESSAGE,
  buildTaskCursorGithubVerifyRequestBody,
  postTaskCursorGithubVerify,
} from "@/lib/prototype/taskCursorGithubVerifyClient";

describe("postTaskCursorGithubVerify", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a user-safe message when response is HTML", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("<!DOCTYPE html><html></html>", {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = buildTaskCursorGithubVerifyRequestBody({
      projectId: "p1",
      execution: buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-SAMPLE-DATA-001",
        workItemIds: [],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      state: {},
      codeTaskId: "CODE-DATA-SAMPLE-001",
      manualGithubRecheck: true,
      manualRecheckPayload: {
        version: "code_task_manual_github_recheck_payload_v1",
        codeTaskId: "CODE-DATA-SAMPLE-001",
        workBranch: "wip/data/sample-data",
        taskId: "DEV-SAMPLE-DATA-001",
      },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(postTaskCursorGithubVerify(body)).rejects.toThrow(
      TASK_CURSOR_GITHUB_VERIFY_NON_JSON_USER_MESSAGE,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "[manual_github_commit_recheck_non_json_response]",
      expect.objectContaining({
        status: 404,
        url: "/api/prototype/task-cursor/verify-github",
        codeTaskId: "CODE-DATA-SAMPLE-001",
        workBranch: "wip/data/sample-data",
      }),
    );
  });

  it("parses JSON verify responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, message: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const body = buildTaskCursorGithubVerifyRequestBody({
      projectId: "p1",
      execution: buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-SAMPLE-DATA-001",
        workItemIds: [],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      state: {},
    });

    const json = await postTaskCursorGithubVerify(body);
    expect(json.success).toBe(true);
  });
});
