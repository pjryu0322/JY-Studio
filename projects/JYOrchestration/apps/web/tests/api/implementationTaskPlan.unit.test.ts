import { describe, expect, it, vi } from "vitest";
import {
  buildCursorWorkItemsFromImplementationTaskList,
  buildCursorWorkItemsFromImplementationTaskPlan,
  evaluateCursorExecutionRequestGate,
  formatCursorExecutionBlockedMessage,
} from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskExecutionHints } from "@/lib/prototype/implementationExecutionHints";
import {
  evaluateCursorWorkItemQuality,
  CURSOR_WORK_ITEM_MIN_QUALITY_SCORE,
} from "@/lib/prototype/implementationCursorPromptQuality";
import {
  buildCursorPromptDraft,
  buildImplementationTaskPlan,
  buildImplementationTaskPlanFromTaskList,
  evaluateImplementationTaskPlanReadiness,
} from "@/lib/prototype/implementationTaskPlan";
import { buildImplementationTaskPlanSummaryMessage } from "@/lib/prototype/implementationTaskPlanSummary";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
import {
  buildConfirmImplementationTaskPlanResult,
  buildImplementationCursorGateContext,
  evaluateImplementationCursorGate,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import {
  buildImplementationSeedFromPlanning,
  IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
} from "@/lib/requirements/implementationSeed";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import { buildImplementationSlotsFromContext } from "@/lib/prototype/implementationSlots";
import {
  appendPromptTimeline,
  buildImplementationTaskPlanTimelineEntry,
  buildPrototypeExecutionOrchestrationPersistPatch,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

describe("buildImplementationTaskExecutionHints", () => {
  it("builds platform execution hints for JYOrchestration maintenance", () => {
    const hints = buildImplementationTaskExecutionHints({
      taskTitle: "화면 API 연동",
      sourceArtifactTypes: ["api-spec", "screen-spec"],
      projectArtifacts: [],
      targetRepoKind: "platform",
    });
    expect(hints.candidateDirectories.length).toBeGreaterThan(0);
    expect(hints.candidateTests.length).toBeGreaterThan(0);
    expect(hints.testCommands.some((c) => c.includes("pnpm test"))).toBe(true);
    expect(hints.forbiddenPaths.some((p) => p.includes("package.json"))).toBe(true);
    expect(hints.forbiddenPaths.some((p) => p.includes("JYGallery"))).toBe(true);
  });

  it("builds generated-project hints without platform source paths", () => {
    const hints = buildImplementationTaskExecutionHints({
      taskTitle: "화면 API 연동",
      sourceArtifactTypes: ["api-spec", "screen-spec"],
      projectArtifacts: [],
      targetRepoKind: "generated_project",
    });
    expect(hints.candidateDirectories.every((d) => !d.includes("JYOrchestration"))).toBe(true);
    expect(hints.candidateFiles).toEqual([]);
    expect(hints.forbiddenPaths.some((p) => p.includes("package.json"))).toBe(true);
    expect(hints.forbiddenPaths.every((p) => !p.includes("JYOrchestration"))).toBe(true);
    expect(hints.testCommands.every((c) => !c.includes("cd projects"))).toBe(true);
  });
});

describe("buildCursorPromptDraft", () => {
  it("builds rich cursor prompt draft with required sections", () => {
    const hints = buildImplementationTaskExecutionHints({
      taskTitle: "녹취 업로드",
      sourceArtifactTypes: ["feature-spec"],
      projectArtifacts: [],
      targetRepoKind: "platform",
    });
    const prompt = buildCursorPromptDraft({
      title: "녹취 업로드",
      description: "녹취 업로드 구현",
      artifactLabels: ["기능 정의서"],
      acceptanceCriteria: ["피드백 제공"],
      securityChecks: ["파일 크기 제한"],
      reviewChecks: ["실패 처리"],
      executionHints: hints,
    });
    expect(prompt).toContain("## 1. 작업 목적");
    expect(prompt).toContain("## 4. 예상 수정 위치");
    expect(prompt).toContain("## 8. 테스트 명령");
    expect(prompt).toContain("## 10. 금지사항");
    expect(prompt).toContain("projects/JYOrchestration 외 수정 금지");
    expect(prompt.length).toBeGreaterThan(400);
  });
});

describe("buildImplementationTaskPlan", () => {
  it("builds implementation task plan from artifacts and member proposals", () => {
    const artifacts: ProjectArtifact[] = [
      {
        id: "a1",
        type: "feature-spec",
        title: "녹취 업로드",
        content: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        createdBy: "ai",
        sourceStage: "feature-planning",
      },
    ];
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: artifacts,
      envOk: true,
      designOk: true,
      nowIso: "2026-05-19T00:00:00.000Z",
    });
    expect(plan.version).toBe("implementation_task_plan_v1");
    expect(plan.items[0]?.executionHints.testCommands.length).toBeGreaterThan(0);
    expect(plan.items[0]?.cursorPromptDraft).toContain("## 1. 작업 목적");
    expect(plan.readiness.ready).toBe(true);
  });
});

function makeTaskListForPlan(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-001",
        title: "높은 우선순위 개발 작업",
        description: "dev high",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "DEV-002",
        title: "중간 우선순위 개발 작업",
        description: "dev medium",
        taskType: "api",
        ownerRole: "developer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "DEV-003",
        title: "낮은 우선순위 개발 작업",
        description: "dev low",
        taskType: "feature",
        ownerRole: "developer",
        priority: "low",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "REV-001",
        title: "검수 작업",
        description: "review",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "DEV-004",
        title: "차단된 개발 작업(제외)",
        description: "dev blocked",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "blocked",
      },
    ],
    roleSummary: { developer: 4, designer: 0, reviewer: 1, security: 0, scm: 0 },
  };
}

describe("buildImplementationTaskPlanFromTaskList", () => {
  it("creates items for developer ready tasks only and maps priority", () => {
    const plan = buildImplementationTaskPlanFromTaskList({
      projectId: "p1",
      taskList: makeTaskListForPlan(),
      envOk: true,
      designOk: true,
      nowIso: "2026-05-28T00:00:00.000Z",
    });
    const ids = plan.items.map((i) => i.id);
    expect(ids).toEqual(["DEV-001", "DEV-002", "DEV-003"]);
    expect(plan.items[0]?.priority).toBe("P0");
    expect(plan.items[1]?.priority).toBe("P1");
    expect(plan.items[2]?.priority).toBe("P2");
  });

  it("has readiness ready when envOk/designOk are true", () => {
    const plan = buildImplementationTaskPlanFromTaskList({
      projectId: "p1",
      taskList: makeTaskListForPlan(),
      envOk: true,
      designOk: true,
    });
    expect(plan.readiness.ready).toBe(true);
    expect(plan.items.every((i) => i.status === "ready")).toBe(true);
  });

  it("blocks readiness when envOk is false and includes env-related missing", () => {
    const plan = buildImplementationTaskPlanFromTaskList({
      projectId: "p1",
      taskList: makeTaskListForPlan(),
      envOk: false,
      designOk: true,
    });
    expect(plan.readiness.ready).toBe(false);
    expect(plan.readiness.missing.join(" ")).toContain("AI 개발 도구");
  });

  it("includes checks and execution hints", () => {
    const plan = buildImplementationTaskPlanFromTaskList({
      projectId: "p1",
      taskList: makeTaskListForPlan(),
      envOk: true,
      designOk: true,
    });
    const item = plan.items[0]!;
    expect(item.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(item.reviewChecks.length).toBeGreaterThan(0);
    expect(item.securityChecks.length).toBeGreaterThan(0);
    expect(item.cursorPromptDraft).toContain("## 1. 작업 목적");
    expect(item.executionHints.testCommands.length).toBeGreaterThan(0);
  });
});

describe("buildCursorWorkItemsFromImplementationTaskPlan", () => {
  it("includes test commands and forbidden paths in cursor work items", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["발화자 분석"],
      envOk: true,
      designOk: true,
    });
    const items = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    expect(items[0]?.testCommands.length).toBeGreaterThan(0);
    expect(items[0]?.forbiddenPaths.length).toBeGreaterThan(0);
    expect(items[0]?.qualityGate.score).toBeGreaterThanOrEqual(CURSOR_WORK_ITEM_MIN_QUALITY_SCORE);
    expect(items[0]?.qualityGate.promptReady).toBe(true);
  });
});

describe("evaluateCursorWorkItemQuality", () => {
  it("blocks cursor execution when work item prompt quality is low", () => {
    const low = evaluateCursorWorkItemQuality({
      id: "w1",
      taskId: "t1",
      title: "bad",
      prompt: "short",
      requiredFilesHint: [],
      expectedOutput: [],
      testCommands: [],
      forbiddenPaths: [],
      blocked: false,
      blockers: [],
      qualityGate: { promptReady: false, missing: [], score: 0 },
    });
    expect(low.promptReady).toBe(false);
    expect(low.score).toBeLessThan(CURSOR_WORK_ITEM_MIN_QUALITY_SCORE);
  });
});

describe("cursor execution readiness gate", () => {
  it("blocks cursor execution request when task plan is incomplete", () => {
    const gate = evaluateCursorExecutionRequestGate({
      plan: null,
      workItems: null,
      envOk: false,
      designOk: false,
    });
    expect(gate.allowed).toBe(false);
    expect(formatCursorExecutionBlockedMessage(gate.missing)).toContain("아직 코드 에이전트 WIP 작업 요청");
  });

  it("allows cursor execution when plan, environment, and prompt quality are ready", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["요약 생성"],
      envOk: true,
      designOk: true,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const gate = evaluateCursorExecutionRequestGate({ plan, workItems, envOk: true, designOk: true });
    expect(gate.allowed).toBe(true);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    const fullGate = evaluateImplementationCursorGate(
      buildImplementationCursorGateContext(
        { implementationTaskPlanV1: plan, cursorWorkItemsV1: workItems, implementationSlotsV1: slots },
        { envOk: true, designOk: true },
      ),
    );
    expect(fullGate.allowed).toBe(true);
  });

  it("allows WIP gate with cursorWorkItems only and no taskPlan or slots", () => {
    const workItems = buildCursorWorkItemsFromImplementationTaskList({
      projectId: "p-wip-only",
      taskList: {
        version: "implementation_task_list_v1",
        projectId: "p-wip-only",
        createdAt: "2026-05-30T00:00:00.000Z",
        updatedAt: "2026-05-30T00:00:00.000Z",
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
            acceptanceCriteria: ["ok"],
            status: "ready",
          },
        ],
        roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
      },
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    const gate = evaluateImplementationCursorGate(
      buildImplementationCursorGateContext(
        {
          implementationTaskPlanV1: null,
          cursorWorkItemsV1: workItems,
          implementationSlotsV1: null,
        },
        { envOk: false, designOk: false },
        { projectId: "p-wip-only" },
      ),
    );
    expect(gate.allowed).toBe(true);
    expect(gate.missing).not.toContain("구현 task plan 없음");
    expect(gate.missing.some((m) => m.includes("구현 슬롯"))).toBe(false);
  });
});

function seedReadyForTaskPlan(now: string) {
  const definitions = buildDynamicServicePlanningSlotDefinitions({
    projectName: "demo",
    projectDescription: "demo",
  });
  const base = initialOrchestrationStateFromDefinitions(definitions, now);
  const slots = { ...base.slots };
  for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
    if (!key || !slots[key]) continue;
    slots[key] = {
      ...slots[key],
      status: "confirmed",
      value: "confirmed slot value for seed gate",
      updatedAt: now,
    };
  }
  const orchestration = { ...base, slots };
  const seed = buildImplementationSeedFromPlanning({
    projectId: "p1",
    orchestration,
    definitions,
    lifecycleStatus: "confirmed",
    nowIso: now,
  });
  return { orchestration, definitions, seed };
}

describe("buildConfirmImplementationTaskPlanResult", () => {
  it("returns created patch with task plan and cursor work items", () => {
    const now = "2026-05-19T02:00:00.000Z";
    const { orchestration, definitions, seed } = seedReadyForTaskPlan(now);
    const artifacts: ProjectArtifact[] = [
      {
        id: "a1",
        type: "fast_prototype_plan",
        title: "프로토타입 기획안",
        content: "# plan",
        createdAt: now,
        createdBy: "ai",
        sourceStage: "IDEATION",
      },
    ];
    const draftGen = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson: { singleChatOrchestrationV1: orchestration, implementationSeedV1: seed },
      projectId: "p1",
      projectArtifacts: artifacts,
      orchestration,
      slotDefinitions: definitions,
      implementationSeedV1: seed,
      envOk: true,
      designOk: true,
    });
    expect(draftGen.kind).toBe("created");
    if (draftGen.kind !== "created") return;

    const result = buildConfirmImplementationTaskPlanResult({
      projectId: "p1",
      requirementsStateJson: { prototypeExecutionSingleChatV1: { messages: draftGen.messages } },
      projectArtifacts: [],
      featureDraftTitles: ["업로드"],
      implementationWorkPlanDraftV1: draftGen.draft,
      envOk: true,
      designOk: true,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.plan.items[0]?.executionHints).toBeDefined();
    expect(result.workItems[0]?.qualityGate.promptReady).toBe(true);
    const summaryMsg = [...result.chatPatch.messages].reverse().find((m) =>
      m.content.includes("구현 슬롯 준비 상태:"),
    );
    expect(summaryMsg?.content).toContain("구현 task:");
    expect(summaryMsg?.content).toContain("구현 슬롯 준비 상태:");
    expect(result.orchestrationPatch.implementationSlotsV1.slots.length).toBeGreaterThan(0);
    expect(
      result.orchestrationPatch.promptTimeline.some((e) => e.action === "implementation_slots_built"),
    ).toBe(true);
  });
});

describe("implementation work plan chip routing", () => {
  it("routes work plan confirm label through stage action mapping (not fallback)", () => {
    expect(mapImplementationChipToAction("구현 작업안 확정")).toBe("CONFIRM_IMPLEMENTATION_WORK_PLAN");
    // Stage-action-only labels must not be handled by fallback chip handler.
    expect(
      tryHandlePrototypeExecutionChip("구현 작업안 확정", {
        openEnvSettings: vi.fn(),
        focusComposerForScopeEdit: vi.fn(),
        showRoleCheckDetails: vi.fn(),
        showScmCheckDetails: vi.fn(),
        showEnvironmentCheckDetails: vi.fn(),
        generateImplementationWorkPlanDraft: vi.fn(),
        confirmImplementationTaskPlan: vi.fn(),
        requestCodeAgentWipWork: vi.fn(),
        viewWipChanges: vi.fn(),
        requestRefactor: vi.fn(),
        requestAdditionalEdit: vi.fn(),
        approveDeveloperResult: vi.fn(),
        discardWipWork: vi.fn(),
        requestScmOfficialCommit: vi.fn(),
        reviewDbIntegrationNeed: vi.fn(),
        generateDataModelDraft: vi.fn(),
        confirmMockImplementationMode: vi.fn(),
        prepareImplementationExecution: vi.fn(),
        confirmExecution: vi.fn(),
        refreshStatus: vi.fn(),
        returnToPlanningStage: vi.fn(),
        showToast: vi.fn(),
        canConfirmImplementationTaskPlan: () => true,
        canRequestCodeAgentWipWork: () => true,
        canApproveDeveloperResult: () => true,
        canRequestScmOfficialCommit: () => true,
        canConfirmExecution: () => true,
      }),
    ).toBe(false);
  });
});

describe("prompt timeline cursor prompt quality trace", () => {
  it("adds cursor prompt quality trace to prompt timeline", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["검수"],
      envOk: true,
      designOk: true,
      nowIso: "2026-05-19T02:00:00.000Z",
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const entry = buildImplementationTaskPlanTimelineEntry({
      plan,
      workItems,
      envOk: true,
      designOk: true,
    });
    expect(entry.responseText).toContain("implementation_cursor_prompt_quality");
    expect(entry.responseText).toContain("promptReadyCount=");
    expect(entry.responseText).toContain("qualityScores=");
    expect(entry.responseText).toContain("testCommands=");
  });
});

describe("requirements state json task plan persistence", () => {
  it("persists implementationTaskPlanV1 and cursorWorkItemsV1 in requirements state json", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["검수 화면"],
      envOk: true,
      designOk: true,
      nowIso: "2026-05-19T01:00:00.000Z",
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const summary = buildImplementationTaskPlanSummaryMessage(plan, {
      workItems,
      envOk: true,
      designOk: true,
    });
    const merged = buildPrototypeExecutionOrchestrationPersistPatch(
      {},
      {
        chat: { messages: [summary], slots: [], answers: {}, currentSlotKey: null },
        implementationTaskPlanV1: plan,
        cursorWorkItemsV1: workItems,
        promptTimeline: appendPromptTimeline([], {
          stage: "implementation",
          action: "implementation_task_plan",
          source: "system",
          createdAt: plan.createdAt,
        }),
      },
    );
    const parsed = parseRequirementsStateJson(merged);
    expect(parsed.implementationTaskPlanV1?.items[0]?.executionHints.testCommands.length).toBeGreaterThan(0);
    expect(parsed.cursorWorkItemsV1?.[0]?.testCommands.length).toBeGreaterThan(0);
    expect(parsed.cursorWorkItemsV1?.[0]?.qualityGate.score).toBeGreaterThan(0);
    expect(
      evaluateImplementationTaskPlanReadiness({
        plan: parsed.implementationTaskPlanV1,
        envOk: true,
        designOk: true,
      }).ready,
    ).toBe(true);
  });
});
