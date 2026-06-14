import { describe, expect, it } from "vitest";
import { buildImplementationIntentResolverInput } from "@/lib/prototype/implementationWorkingQueueContextBuilder";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationWorkingQueueV1 } from "@/lib/prototype/implementationWorkingQueueTypes";

describe("implementation intent resolver input context", () => {
  const queue: ImplementationWorkingQueueV1 = {
    version: "implementation_working_queue_v1",
    projectId: "proj-1",
    items: [
      {
        id: "iwq-1",
        title: "Pending fix",
        status: "pending",
        riskLevel: "low",
        affectedArea: "ui",
        createdAt: "2026-06-14T00:00:00.000Z",
        updatedAt: "2026-06-14T00:00:00.000Z",
      },
      {
        id: "iwq-2",
        title: "Approved fix",
        status: "approved",
        riskLevel: "low",
        affectedArea: "ui",
        createdAt: "2026-06-14T00:00:00.000Z",
        updatedAt: "2026-06-14T00:00:00.000Z",
      },
    ],
  };

  it("includes pending/approved queue, mode, runnable count, previewReady", () => {
    const userMsg = newRequirementsMessage({
      id: "u-1",
      role: "user",
      speakerType: "USER",
      messageType: "STATEMENT",
      content: "진행해",
      createdAt: "2026-06-14T00:00:00.000Z",
    });
    const input = buildImplementationIntentResolverInput({
      projectId: "proj-1",
      userText: "진행해",
      userMsg,
      priorMessages: [
        newRequirementsMessage({
          id: "a-1",
          role: "ai",
          speakerType: "AI",
          messageType: "STATEMENT",
          content: "작업대기 항목을 승인하려면 진행해 라고 말씀해 주세요.",
          createdAt: "2026-06-14T00:00:00.000Z",
        }),
      ],
      queue,
      hasRunnableCodeTasks: true,
      runnableCodeTaskCount: 3,
      implementationMode: "ready",
      previewReady: true,
    });

    expect(input.mode).toBe("ready");
    expect(input.pendingWorkingQueueItems).toHaveLength(1);
    expect(input.approvedWorkingQueueItems).toHaveLength(1);
    expect(input.runnableCodeTaskCount).toBe(3);
    expect(input.previewReady).toBe(true);
    expect(input.lastAssistantMessage).toContain("진행해");
    expect(input.availableActions).toContain("approve_pending_work_queue");
    expect(input.availableActions).toContain("start_initial_quick_run");
  });

  it("documents LLM-only resolution for ambiguous phrases (context fields present)", () => {
    const userMsg = newRequirementsMessage({
      id: "u-2",
      role: "user",
      speakerType: "USER",
      messageType: "STATEMENT",
      content: "부탁해",
      createdAt: "2026-06-14T00:00:00.000Z",
    });
    const input = buildImplementationIntentResolverInput({
      projectId: "proj-1",
      userText: "부탁해",
      userMsg,
      priorMessages: [],
      queue: { ...queue, items: [] },
      hasRunnableCodeTasks: false,
      implementationMode: "ready",
    });
    expect(input.pendingWorkingQueueItems).toHaveLength(0);
    expect(input.availableActions).toContain("ask_clarification");
    expect(input.userText).toBe("부탁해");
  });
});
