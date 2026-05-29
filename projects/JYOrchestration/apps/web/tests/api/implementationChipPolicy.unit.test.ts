import { describe, expect, it } from "vitest";
import {
  dedupeImplementationChips,
  deriveImplementationBoardInterviewChips,
  deriveTaskListDetailInterviewChips,
  filterImplementationChipsForMessageContext,
} from "@/lib/prototype/implementationChipPolicy";
import { buildImplementationExecutionBoard } from "@/lib/prototype/implementationExecutionBoard";
import {
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_EXECUTION_BOARD_CHIP,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/requirements/implementationUxLabels";
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
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("implementationChipPolicy", () => {
  it("dedupe preserves first occurrence order", () => {
    expect(
      dedupeImplementationChips([
        IMPLEMENTATION_GENERATION_REQUEST_CHIP,
        IMPLEMENTATION_GENERATION_REQUEST_CHIP,
        "",
        IMPLEMENTATION_ENV_SETTINGS_LABEL,
      ]),
    ).toEqual([IMPLEMENTATION_GENERATION_REQUEST_CHIP, IMPLEMENTATION_ENV_SETTINGS_LABEL]);
  });

  it("execution_board context removes 작업목록 보기 and 구현 작업 보드", () => {
    const filtered = filterImplementationChipsForMessageContext({
      chips: [
        IMPLEMENTATION_GENERATION_REQUEST_CHIP,
        TASK_LIST_VIEW_CHIP,
        IMPLEMENTATION_EXECUTION_BOARD_CHIP,
        IMPLEMENTATION_ENV_SETTINGS_LABEL,
      ],
      context: "execution_board",
    });
    expect(filtered).not.toContain(TASK_LIST_VIEW_CHIP);
    expect(filtered).not.toContain(IMPLEMENTATION_EXECUTION_BOARD_CHIP);
    expect(filtered).toContain(IMPLEMENTATION_GENERATION_REQUEST_CHIP);
  });

  it("task_list_detail context removes 작업목록 보기 only", () => {
    const filtered = filterImplementationChipsForMessageContext({
      chips: [TASK_LIST_VIEW_CHIP, IMPLEMENTATION_EXECUTION_BOARD_CHIP],
      context: "task_list_detail",
    });
    expect(filtered).not.toContain(TASK_LIST_VIEW_CHIP);
    expect(filtered).toContain(IMPLEMENTATION_EXECUTION_BOARD_CHIP);
  });

  it("initial board interview chips are 생성요청 and 환경설정 only", () => {
    const board = buildImplementationExecutionBoard({
      projectId: "p1",
      taskList: sampleTaskList(),
      nowIso: NOW,
    });
    const chips = deriveImplementationBoardInterviewChips({ board, envOk: true });
    expect(chips).toEqual([IMPLEMENTATION_GENERATION_REQUEST_CHIP, IMPLEMENTATION_ENV_SETTINGS_LABEL]);
  });

  it("task list detail chips include 구현 작업 보드 not 작업목록 보기", () => {
    const chips = deriveTaskListDetailInterviewChips({ envOk: true });
    expect(chips).toContain(IMPLEMENTATION_EXECUTION_BOARD_CHIP);
    expect(chips).not.toContain(TASK_LIST_VIEW_CHIP);
  });
});
