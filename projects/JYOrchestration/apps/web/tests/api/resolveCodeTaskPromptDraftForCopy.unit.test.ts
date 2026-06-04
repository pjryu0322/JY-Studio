import { describe, expect, it } from "vitest";
import {
  CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE,
  resolveCodeTaskPromptDraftForCopy,
} from "@/lib/prototype/resolveCodeTaskPromptDraftForCopy";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";

function taskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "DEV-1",
        title: "로그인",
        description: "로그인 화면",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: ["로그인"],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("resolveCodeTaskPromptDraftForCopy", () => {
  it("succeeds for mode all without targetRepository", () => {
    const list = taskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const result = resolveCodeTaskPromptDraftForCopy({
      projectId: "p1",
      codeTaskPlan: plan,
      taskList: list,
      codeTaskPromptContextMapV1: null,
      mode: "all",
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toContain("# CodeTask 1단계 프롬프트 초안");
    expect(result.prompt).toContain(`전체 CodeTask: ${plan.tasks.length}개`);
    expect(result.prompt).not.toContain("GitHub");
  });

  it("fails when code task plan is missing", () => {
    const result = resolveCodeTaskPromptDraftForCopy({
      projectId: "p1",
      codeTaskPlan: null,
      taskList: null,
      mode: "all",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(CODE_TASK_PROMPT_DRAFT_NOT_READY_MESSAGE);
  });

  it("fails for single mode without codeTaskId", () => {
    const list = taskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const result = resolveCodeTaskPromptDraftForCopy({
      projectId: "p1",
      codeTaskPlan: plan,
      taskList: list,
      mode: "single",
    });
    expect(result.ok).toBe(false);
  });

  it("succeeds for single mode with valid codeTaskId", () => {
    const list = taskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const id = plan.tasks[0]!.codeTaskId;
    const result = resolveCodeTaskPromptDraftForCopy({
      projectId: "p1",
      codeTaskPlan: plan,
      taskList: list,
      mode: "single",
      codeTaskId: id,
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toContain(id);
  });
});
