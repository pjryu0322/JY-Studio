import { describe, expect, it } from "vitest";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";
const PID = "p-m22";

function list(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "SCR-IN",
        title: "입력 화면",
        description: "",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [
          "주요 UI 영역이 표시된다.",
          "샘플 데이터 기준으로 화면 상태를 확인할 수 있다.",
        ],
        sourceRefs: [],
      },
      {
        taskId: "SCR-AD",
        title: "관리 화면",
        description: "",
        taskType: "screen",
        ownerRole: "developer",
        priority: "medium",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("P3-M22 planning draft output polish", () => {
  it("bundle includes common verification section and updated summary", () => {
    const taskList = list();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationTaskListV1: taskList },
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList,
      promptContextMap: map,
    });
    expect(text).toContain("## 공통 검증 기준");
    expect(text).toContain("package.json scripts");
    expect(text).toContain("- ready CodeTask:");
    expect(text).toContain("- warning CodeTask:");
    const perTaskBlocks = text.split("### ").slice(1);
    for (const block of perTaskBlocks) {
      expect(block).not.toContain("대상 저장소 루트에서 package.json");
      expect(block).not.toContain("동일 기능 회귀 없음");
    }
  });

  it("screen input requirements omit mock-centric acceptance from seed list", () => {
    const taskList = list();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const inputTask = plan.tasks.find((t) => /입력\s*화면/i.test(t.title))!;
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationTaskListV1: taskList },
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList,
      promptContextMap: map,
    });
    const section = text.slice(text.indexOf(inputTask.title));
    expect(section).not.toContain("샘플 데이터 기준으로 화면 상태를 확인할 수 있다.");
    expect(section).toContain("회의 파일 업로드/선택 진입점");
  });

  it("admin screen has optional_screen_scope warning and ready can stay true", () => {
    const role = resolveCodeTaskSpecificRole({ codeTaskTitle: "관리 화면 화면 구현", parentTaskTitle: "관리 화면" });
    expect(role.warnings).toContain("optional_screen_scope");
    const taskList = list();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const adminTask = plan.tasks.find((t) => /관리\s*화면/i.test(t.title))!;
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationTaskListV1: taskList },
      nowIso: NOW,
    });
    const ctx = map.contexts[adminTask.codeTaskId]!;
    expect(ctx.quality.ready).toBe(true);
    expect(ctx.quality.warnings).toContain("optional_screen_scope");
    const text = formatCodeTaskPromptDraftBundle({ codeTaskPlan: plan, taskList, promptContextMap: map });
    expect(text).toMatch(/warning CodeTask: [1-9]/);
  });
});
