import { describe, expect, it } from "vitest";
import { resolveImplementationChatAvailability } from "@/lib/prototype/implementationChatAvailability";

describe("implementationChatAvailability", () => {
  it("not_started → canChat false", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: false,
      hasFailedTasks: false,
      integrationPipelineUnlocked: false,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: false,
      board: null,
      previewReady: false,
      previewUrl: null,
    });
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("not_started");
  });

  it("waiting_for_codetasks → canChat false", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: false,
      integrationPipelineUnlocked: false,
      activeTaskCursorRunning: true,
      taskCursorGithubVerifying: false,
      board: null,
      previewReady: false,
      previewUrl: null,
    });
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_codetasks");
  });

  it("waiting_for_github_verify → canChat false", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: false,
      integrationPipelineUnlocked: false,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: true,
      board: null,
      previewReady: false,
      previewUrl: null,
    });
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_github_verify");
  });

  it("waiting_for_integration → canChat false", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: false,
      integrationPipelineUnlocked: true,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: false,
      board: {
        version: "implementation_execution_board_v1",
        projectId: "p1",
        createdAt: "t",
        updatedAt: "t",
        source: "implementation_task_list_and_execution_state",
        mode: "sequential",
        taskRows: [],
        integratedRows: [{ step: "refactor_common", title: "t", ownerRole: "developer", status: "in_progress" }],
        summary: {
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          failedTasks: 0,
          reworkRequiredTasks: 0,
          userConfirmationRequired: 0,
          blockingUserConfirmation: 0,
          integratedCompleted: 0,
        },
      },
      previewReady: false,
      previewUrl: null,
    });
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_integration");
  });

  it("waiting_for_preview → canChat false", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: false,
      integrationPipelineUnlocked: true,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: false,
      board: {
        version: "implementation_execution_board_v1",
        projectId: "p1",
        createdAt: "t",
        updatedAt: "t",
        source: "implementation_task_list_and_execution_state",
        mode: "sequential",
        taskRows: [],
        integratedRows: [{ step: "refactor_common", title: "t", ownerRole: "developer", status: "done" }],
        summary: {
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          failedTasks: 0,
          reworkRequiredTasks: 0,
          userConfirmationRequired: 0,
          blockingUserConfirmation: 0,
          integratedCompleted: 1,
        },
      },
      previewReady: false,
      previewUrl: null,
    });
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_preview");
  });

  it("failed → canChat false", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: true,
      integrationPipelineUnlocked: false,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: false,
      board: null,
      previewReady: true,
      previewUrl: "https://example.com/p",
    });
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("failed");
  });

  it("preview_ready → canChat true", () => {
    const a = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: false,
      integrationPipelineUnlocked: true,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: false,
      board: null,
      previewReady: true,
      previewUrl: "https://example.com/preview",
    });
    expect(a.canChat).toBe(true);
    expect(a.status).toBe("available");
  });
});
