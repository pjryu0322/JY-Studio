import { describe, expect, it } from "vitest";
import {
  buildFixCodeTaskFromWorkingQueueItem,
  buildWorkingQueueApprovalOrchestrationPatch,
  workingQueueFixCodeTaskId,
  WORKING_QUEUE_FIX_CODE_TASK_SOURCE,
} from "@/lib/prototype/implementationWorkingQueueFixCodeTasks";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

describe("working queue approval creates fix code tasks", () => {
  const item: ImplementationWorkingQueueItem = {
    id: "iwq-abc-123",
    projectId: "proj-1",
    title: "Preview 캡처 기반 보완요청",
    description: "세로스크롤이 발생하지 않도록 창높이를 조정",
    rawUserMessage: "세로스크롤이 발생하지 않도록 창높이를 조정해줘",
    desiredBehavior: "세로스크롤 없이 전체가 보이게",
    targetUi: "메인 레이아웃",
    regionCaptureId: "reg-1",
    previewUrl: "https://example.com/preview",
    affectedArea: "ui",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  };

  it("builds fix code task with working queue linkage", () => {
    const codeTaskId = workingQueueFixCodeTaskId(item.id);
    const task = buildFixCodeTaskFromWorkingQueueItem({
      item,
      parentTaskId: "task-parent-1",
      projectId: "proj-1",
      nowIso: "2026-06-14T00:00:00.000Z",
    });
    expect(codeTaskId).toContain("fix-wq-");
    expect(task.codeTaskId).toBe(codeTaskId);
    expect(task.llmRationale).toContain(item.id);
    expect(task.llmRationale).toContain(WORKING_QUEUE_FIX_CODE_TASK_SOURCE);
    expect(task.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(task.description).toContain(item.description);
    expect(task.description).toContain(item.desiredBehavior!);
  });

  it("patch adds code tasks and execution enqueue timeline", () => {
    const queue = {
      version: "implementation_working_queue_v1" as const,
      projectId: "proj-1",
      items: [item],
      updatedAt: "2026-06-14T00:00:00.000Z",
    };
    const { orchestrationPatch, createdCodeTaskIds } = buildWorkingQueueApprovalOrchestrationPatch({
      projectId: "proj-1",
      requirementsStateJson: {
        implementationSeedV1: { version: "implementation_seed_v1" },
        implementationTaskListV1: {
          version: "implementation_task_list_v1",
          projectId: "proj-1",
          tasks: [{ taskId: "task-parent-1", title: "Main", type: "feature", priority: "P1" }],
        },
      },
      queue,
      approvedItems: [{ ...item, status: "approved" }],
      nowIso: "2026-06-14T00:00:00.000Z",
    });
    expect(createdCodeTaskIds).toHaveLength(1);
    expect(orchestrationPatch.implementationCodeTaskPlanV1?.tasks?.length).toBe(1);
    expect(orchestrationPatch.codeTaskExecutionRunsV1?.length).toBeGreaterThan(0);
    expect(
      orchestrationPatch.promptTimeline?.some((e) => String(e.action).includes("working_queue_item_approved")),
    ).toBe(true);
    expect(
      orchestrationPatch.promptTimeline?.some((e) => String(e.action).includes("implementation_execution_enqueued")),
    ).toBe(true);
  });
});
