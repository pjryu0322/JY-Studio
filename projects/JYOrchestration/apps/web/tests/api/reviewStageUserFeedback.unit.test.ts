import { describe, expect, it } from "vitest";
import {
  appendReviewStageUserFeedback,
  canCompleteReviewStage,
  convertReviewFeedbackToImplementationRework,
  getActiveReviewFeedbackItems,
  parseReviewStageUserFeedbackListV1,
} from "@/lib/prototype/reviewStageUserFeedback";
import { countActiveReworkRequestsForTask } from "@/lib/prototype/implementationExecutionBoardState";
import { buildImplementationExecutionBoard } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-29T12:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "화면",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "dev-2",
        title: "결과",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "medium",
        dependencies: ["dev-1"],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("reviewStageUserFeedback", () => {
  it("appendReviewStageUserFeedback appends registered feedback with defaults", () => {
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "버튼 위치",
      detail: "다운로드 버튼이 잘 안 보임",
      nowIso: NOW,
    });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.category).toBe("other");
    expect(list.items[0]?.severity).toBe("medium");
    expect(list.items[0]?.status).toBe("registered");
  });

  it("converted feedback is excluded from active list", () => {
    let list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "t",
      detail: "d",
      feedbackId: "fb-1",
      nowIso: NOW,
    });
    const converted = convertReviewFeedbackToImplementationRework({
      feedbackList: list,
      boardState: null,
      projectId: "p1",
      feedbackId: "fb-1",
      fallbackTaskId: "dev-1",
      nowIso: NOW,
    });
    expect(getActiveReviewFeedbackItems(converted.feedbackList)).toHaveLength(0);
    expect(converted.feedbackList.items[0]?.status).toBe("converted_to_rework");
    expect(converted.feedbackList.items[0]?.convertedReworkRequestId).toBeTruthy();
  });

  it("feedback with targetTaskId converts to same task rework", () => {
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "검수 UI",
      detail: "문구 수정",
      targetTaskId: "dev-2",
      nowIso: NOW,
      feedbackId: "fb-2",
    });
    const converted = convertReviewFeedbackToImplementationRework({
      feedbackList: list,
      boardState: null,
      projectId: "p1",
      feedbackId: "fb-2",
      fallbackTaskId: "dev-1",
      nowIso: NOW,
    });
    const rework = converted.boardState.reworkRequests.find((r) => r.taskId === "dev-2");
    expect(rework?.taskId).toBe("dev-2");
    const board = buildImplementationExecutionBoard({
      projectId: "p1",
      taskList: sampleTaskList(),
      boardState: converted.boardState,
      nowIso: NOW,
    });
    expect(countActiveReworkRequestsForTask(converted.boardState, "dev-2")).toBe(1);
    expect(board.taskRows.find((r) => r.taskId === "dev-2")?.reworkCount).toBe(1);
  });

  it("blocking feedback prevents completion", () => {
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "차단",
      detail: "d",
      severity: "blocking",
      nowIso: NOW,
    });
    expect(canCompleteReviewStage({ feedbackList: list }).ok).toBe(false);
  });

  it("parseReviewStageUserFeedbackListV1 skips invalid rows", () => {
    const parsed = parseReviewStageUserFeedbackListV1({
      version: "review_stage_user_feedback_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      items: [
        { feedbackId: "bad" },
        {
          feedbackId: "fb-ok",
          status: "registered",
          category: "bug",
          severity: "high",
          title: "버그",
          detail: "오류",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]?.feedbackId).toBe("fb-ok");
  });
});
