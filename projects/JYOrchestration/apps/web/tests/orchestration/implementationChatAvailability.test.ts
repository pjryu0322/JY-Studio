import { describe, expect, it } from "vitest";
import {
  resolveImplementationChatAvailability,
  type DeriveImplementationChatAvailabilitySignalsInput,
} from "@/lib/prototype/implementationChatAvailability";

function signals(
  overrides: Partial<DeriveImplementationChatAvailabilitySignalsInput> = {},
): DeriveImplementationChatAvailabilitySignalsInput {
  return {
    implementationStarted: true,
    codeTasksCompleted: true,
    githubVerified: true,
    integrationCompleted: true,
    previewUrl: "https://example.com/preview",
    previewReady: true,
    previewOpenTargetReady: true,
    sampleDataRequired: true,
    sampleDataQualityOk: true,
    sampleDataRenderedOk: true,
    sampleDataStatus: "ready",
    hasFailedTasks: false,
    board: null,
    integrationPipelineUnlocked: true,
    activeTaskCursorRunning: false,
    taskCursorGithubVerifying: false,
    ...overrides,
  };
}

describe("implementationChatAvailability", () => {
  it("not_started → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({ implementationStarted: false, codeTasksCompleted: false, githubVerified: false, integrationCompleted: false, previewReady: false, previewUrl: null }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("not_started");
  });

  it("waiting_for_codetasks → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({
        codeTasksCompleted: false,
        previewReady: false,
        previewUrl: null,
        activeTaskCursorRunning: true,
        integrationPipelineUnlocked: false,
      }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_codetasks");
  });

  it("waiting_for_github_verify → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({
        githubVerified: false,
        previewReady: false,
        previewUrl: null,
        integrationPipelineUnlocked: false,
        taskCursorGithubVerifying: true,
      }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_github_verify");
  });

  it("waiting_for_integration → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({
        integrationCompleted: false,
        previewReady: false,
        previewUrl: null,
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
      }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_integration");
  });

  it("waiting_for_preview → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({
        previewReady: false,
        previewUrl: null,
        integrationCompleted: true,
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
      }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_preview");
  });

  it("failed → canChat false", () => {
    const a = resolveImplementationChatAvailability(signals({ hasFailedTasks: true }));
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("failed");
  });

  it("previewUrl only and previewReady false → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({
        previewUrl: "https://example.com/preview",
        previewReady: false,
        previewOpenTargetReady: true,
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
      }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("waiting_for_preview");
  });

  it("previewUrl with sampleDataRenderedOk false → canChat false", () => {
    const a = resolveImplementationChatAvailability(
      signals({
        previewUrl: "https://example.com/preview",
        previewReady: true,
        sampleDataRenderedOk: false,
        sampleDataQualityOk: true,
        sampleDataStatus: "not_rendered",
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
      }),
    );
    expect(a.canChat).toBe(false);
    expect(a.status).toBe("sample_data_not_rendered");
  });
});
