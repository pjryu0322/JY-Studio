import { describe, expect, it } from "vitest";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { formatCodeTaskPromptDraft, formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import { matchCodeTaskFeaturePromptKind } from "@/lib/prototype/codeTaskPromptFeatureTemplates";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";
const PID = "p-m21";

function codeTask(title: string, parentId = "DEV-1"): ImplementationCodeTaskV1 {
  return {
    codeTaskId: `CT-${title}`,
    parentTaskId: parentId,
    title,
    description: "",
    changeType: "component",
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    candidateFileHints: [],
    priority: "P1",
    status: "ready",
  };
}

function listWithTasks(tasks: ImplementationTaskListV1["tasks"]): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks,
    roleSummary: { developer: tasks.length, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("P3-M21 planning draft specificity", () => {
  it("screen input task does not use mock data template", () => {
    const kind = matchCodeTaskFeaturePromptKind({
      title: "입력 화면 화면 구현",
      description: "화면 UI",
      requirements: [],
      changeType: "component",
      parentTitle: "입력 화면",
    });
    expect(kind).toBe("screen_input");
    const draft = formatCodeTaskPromptDraft({
      codeTask: codeTask("입력 화면 화면 구현"),
      parentTask: {
        taskId: "DEV-1",
        title: "입력 화면",
        description: "",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [],
        sourceRefs: [],
      },
    });
    expect(draft).not.toContain("mock data 또는 fixture helper");
    expect(draft).toContain("회의 파일 업로드/선택 진입점");
  });

  it("feature flow roles are concrete without generic_role warning in resolver", () => {
    expect(resolveCodeTaskSpecificRole({ codeTaskTitle: "시작 기능 구현" }).roleKind).toBe("feature_start");
    expect(resolveCodeTaskSpecificRole({ codeTaskTitle: "업무 입력 기능 구현" }).roleKind).toBe("feature_input");
    expect(resolveCodeTaskSpecificRole({ codeTaskTitle: "처리 중 기능 구현" }).roleKind).toBe("feature_processing");
    expect(resolveCodeTaskSpecificRole({ codeTaskTitle: "결과 확인 기능 구현" }).roleKind).toBe("feature_result");
    const start = resolveCodeTaskSpecificRole({ codeTaskTitle: "시작 기능 구현" });
    expect(start.warnings).not.toContain("generic_role");
    expect(start.role).toMatch(/회의 분석 작업을 시작/);
  });

  it("bundle markdown keeps headings on separate lines", () => {
    const list = listWithTasks([
      {
        taskId: "DEV-1",
        title: "입력 화면",
        description: "",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [],
        sourceRefs: [],
      },
    ]);
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const text = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: list,
      promptContextMap: null,
      templateId: "meeting-workspace",
    });
    expect(text).toMatch(/# CodeTask 1단계 프롬프트 초안\n\n## 프로젝트 구현 준비 요약/);
    expect(text).not.toContain("관련 템플릿: 관련 템플릿 영역:");
    expect(text).not.toMatch(/meeting-workspace.*반응형 3열 SaaS.*###/s);
  });

  it("permission task with screens is not ready when states missing from empty map", () => {
    const list = listWithTasks([
      {
        taskId: "DEV-P",
        title: "권한 없음 안내",
        description: "",
        taskType: "feature",
        ownerRole: "developer",
        priority: "medium",
        status: "ready",
        dependencies: [],
        acceptanceCriteria: [],
        sourceRefs: [],
      },
    ]);
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const permTask = plan.tasks.find((t) => /권한/i.test(t.title))!;
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: { implementationTaskListV1: list },
      nowIso: NOW,
    });
    const ctx = map.contexts[permTask.codeTaskId]!;
    expect(ctx.featureContext.relatedScreens.length).toBeGreaterThan(0);
    expect(ctx.quality.ready).toBe(true);
  });
});
