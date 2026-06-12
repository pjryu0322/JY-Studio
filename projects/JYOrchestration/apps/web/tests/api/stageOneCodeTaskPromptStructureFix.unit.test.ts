import { describe, expect, it } from "vitest";
import { formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";
const PID = "p-stage1-structure";

function minimalMeetingList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      {
        taskId: "DEV-F",
        title: "화면 프레임/앱 Shell 구성",
        description: "Shell",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: ["a", "b", "c"],
        sourceRefs: [],
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("stage 1 CodeTask prompt structure", () => {
  it("lists integration orchestration separately from executable CodeTasks", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    expect(text).toContain("- 실행 CodeTask:");
    expect(text).toContain("- Integration Orchestration Task: 있음");
    expect(text).toContain("## Integration Orchestration Task");
    expect(text).toContain("## Integration Orchestration Branch");
    expect(text).toContain("## 실행 CodeTask 목록");
    expect(text).not.toContain("## CodeTask 목록");
    expect(text).toContain("sampleData 최종 연결 책임");
    expect(text).not.toMatch(new RegExp(`### \\d+\\..*${INTEGRATION_WIRING_CODE_TASK_ID}`));
    const execSection = text.split("## 실행 CodeTask 목록")[1]?.split("## Integration Orchestration Task 상세")[0] ?? "";
    expect(execSection).not.toContain(INTEGRATION_WIRING_CODE_TASK_ID);
  });

  it("does not list integration in executable branch group order", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: minimalMeetingList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: minimalMeetingList(),
      promptContextMap: null,
    });
    const branchSummary = text.split("## Branch Plan 요약")[1]?.split("## Branch Group")[0] ?? "";
    expect(branchSummary).toContain("실행 CodeTask branch group 순서");
    expect(branchSummary).not.toMatch(/5\.\s*integration/);
    expect(text).toContain("## Integration Orchestration Branch");
  });
});
