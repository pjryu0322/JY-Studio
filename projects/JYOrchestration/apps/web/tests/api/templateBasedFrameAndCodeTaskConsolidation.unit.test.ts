import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  IMPLEMENTATION_CODE_TASK_CONSOLIDATION_LLM_GUIDELINES,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { buildCodeTaskLlmRefinementUserPrompt } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import { buildCodeTaskLlmRefinementBatchUserPrompt } from "@/lib/prototype/implementationCodeTaskPlanLlmBatchRefinement";
import {
  attachTemplateContextToSeed,
  DEV_FRAME_TASK_ID,
  resolveSelectedPrototypeTemplateForPlanning,
} from "@/lib/requirements/implementationPrototypeTemplateContext";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  buildImplementationTaskListFromSeed,
  type ImplementationTaskListV1,
  type ImplementationTaskV1,
} from "@/lib/requirements/implementationTaskList";
import { formatImplementationPrepCompleteSummaryLines } from "@/lib/requirements/quickDesignConfirmImplementationPrep";

const NOW = "2026-06-01T12:00:00.000Z";

function meetingSeed(overrides: Partial<ImplementationSeedV1> = {}): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [],
    screenImplementationItems: [
      {
        id: "s1",
        screenName: "회의록 목록",
        accessibleActors: ["user"],
        actions: ["녹취 업로드", "STT 변환"],
        visibleData: [],
        editableData: [],
        states: ["로딩"],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [
      {
        name: "로딩 상태 표시",
        appliesTo: ["전체"],
        description: "화면 로딩 UI",
        required: true,
      },
    ],
    dataModelSeed: { entities: ["Meeting"], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
    assumptions: [],
    gaps: [],
    ...overrides,
  };
}

function developerTask(input: Partial<ImplementationTaskV1> & Pick<ImplementationTaskV1, "taskId" | "taskType" | "title">): ImplementationTaskV1 {
  return {
    description: input.title,
    ownerRole: "developer",
    priority: "high",
    dependencies: [],
    acceptanceCriteria: [`${input.title} 완료`],
    status: "ready",
    ...input,
  };
}

describe("template-based frame and codetask consolidation", () => {
  it("recommends meeting-workspace template from planning context", () => {
    const seed = meetingSeed();
    const selected = resolveSelectedPrototypeTemplateForPlanning({
      projectName: "회의록 STT 서비스",
      projectDescription: "녹취 업로드와 화자분리",
      seed,
    });
    expect(selected.templateId).toBe("meeting-workspace");
    expect(selected.layoutContract).toContain("회의 분석 워크스페이스");
    expect(selected.source).toBe("recommended");
  });

  it("falls back to dashboard when recommendation context is empty", () => {
    const seed = meetingSeed({
      screenImplementationItems: [],
      processImplementationItems: [],
      commonDetailFeatures: [],
      dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
    });
    const selected = resolveSelectedPrototypeTemplateForPlanning({ seed });
    expect(selected.templateId).toBe("dashboard");
    expect(selected.source).toBe("fallback");
  });

  it("creates DEV-FRAME-001 with template contract and no mock dependency", () => {
    const seed = attachTemplateContextToSeed({
      seed: meetingSeed(),
      templateContext: resolveSelectedPrototypeTemplateForPlanning({
        projectName: "회의록",
        seed: meetingSeed(),
      }),
    });
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const frame = taskList.tasks.find((t) => t.taskId === DEV_FRAME_TASK_ID);
    expect(frame?.taskType).toBe("frame");
    expect(frame?.dependencies).toEqual([]);
    expect(frame?.description).toContain(seed.templateContext!.templateNameKo);
    expect(frame?.description).toContain("템플릿 레이아웃 계약");
    expect(frame?.dependencies).not.toContain("DEV-MOCK-001");
    const screen = taskList.tasks.find((t) => t.taskId.startsWith("DEV-SCREEN"));
    expect(screen?.dependencies).toContain(DEV_FRAME_TASK_ID);
    expect(screen?.dependencies).toContain("DEV-MOCK-001");
    const loadingCommon = taskList.tasks.find((t) => t.taskId.startsWith("DEV-COMMON"));
    expect(loadingCommon?.dependencies).toContain(DEV_FRAME_TASK_ID);
    expect(loadingCommon?.dependencies).toContain("DEV-MOCK-001");
    const mockIdx = taskList.tasks.findIndex((t) => t.taskId === "DEV-MOCK-001");
    const commonIdx = taskList.tasks.findIndex((t) => t.taskId.startsWith("DEV-COMMON"));
    expect(mockIdx).toBeGreaterThan(0);
    expect(commonIdx).toBeGreaterThan(mockIdx);
  });

  it("creates one frame CodeTask for DEV-FRAME-001", () => {
    const seed = attachTemplateContextToSeed({
      seed: meetingSeed(),
      templateContext: resolveSelectedPrototypeTemplateForPlanning({ seed: meetingSeed() }),
    });
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const frameCodeTasks = plan.tasks.filter((t) => t.parentTaskId === DEV_FRAME_TASK_ID);
    expect(frameCodeTasks).toHaveLength(1);
    expect(frameCodeTasks[0]?.title).toContain("앱 Shell/공통 화면 프레임");
  });

  it("consolidates feature task into one heuristic CodeTask without separate tests task", () => {
    const taskList: ImplementationTaskListV1 = {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed",
      tasks: [
        developerTask({ taskId: "DEV-FEATURE-001", taskType: "feature", title: "주문 기능 구현" }),
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const parentTasks = plan.tasks.filter((t) => t.parentTaskId === "DEV-FEATURE-001");
    expect(parentTasks.length).toBeLessThanOrEqual(2);
    expect(parentTasks.some((t) => /tests/i.test(t.title))).toBe(false);
    expect(parentTasks.some((t) => /integration/i.test(t.title))).toBe(false);
    expect(parentTasks[0]?.verificationHints.some((h) => h.length > 0)).toBe(true);
  });

  it("includes consolidation guidelines in LLM refinement prompts", () => {
    const taskList: ImplementationTaskListV1 = {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed",
      tasks: [developerTask({ taskId: "DEV-FEATURE-001", taskType: "feature", title: "기능" })],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const userPrompt = buildCodeTaskLlmRefinementUserPrompt({
      projectId: "p1",
      taskList,
      heuristicPlan: plan,
    });
    expect(IMPLEMENTATION_CODE_TASK_CONSOLIDATION_LLM_GUIDELINES.join("\n")).toContain(
      "CodeTask를 너무 작게 쪼개지 말 것",
    );
    expect(userPrompt).toContain("CodeTask를 너무 작게 쪼개지 말 것");
    expect(userPrompt).toContain("UI/state/integration/tests는 기본적으로 하나의 CodeTask 내부 하위 작업으로 통합");

    const batchPrompt = buildCodeTaskLlmRefinementBatchUserPrompt({
      projectId: "p1",
      batch: {
        batchId: "b1",
        batchIndex: 0,
        parentTaskIds: ["DEV-FEATURE-001"],
        codeTaskIds: plan.tasks.map((t) => t.codeTaskId),
        heuristicTasks: [...plan.tasks],
      },
      taskList,
    });
    expect(batchPrompt).toContain("CodeTask를 너무 작게 쪼개지 말 것");
  });

  it("formats prep complete summary with template and counts", () => {
    const seed = attachTemplateContextToSeed({
      seed: meetingSeed(),
      templateContext: resolveSelectedPrototypeTemplateForPlanning({ seed: meetingSeed() }),
    });
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const lines = formatImplementationPrepCompleteSummaryLines({
      templateContext: seed.templateContext,
      taskList,
      codeTaskPlan: plan,
      workItemCount: plan.tasks.length,
    });
    expect(lines.join("\n")).toContain("확정 템플릿:");
    expect(lines.join("\n")).toContain("회의 분석 워크스페이스");
    expect(lines.join("\n")).toContain("화면 프레임/앱 Shell: 1개");
    expect(lines.join("\n")).toContain("CodeTask:");
  });
});
