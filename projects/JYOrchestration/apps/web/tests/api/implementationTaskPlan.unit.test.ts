import { describe, expect, it, vi } from "vitest";
import {
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
  evaluateImplementationTaskPlanReadiness,
} from "@/lib/prototype/implementationTaskPlan";
import { buildImplementationTaskPlanSummaryMessage } from "@/lib/prototype/implementationTaskPlanSummary";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import { buildConfirmImplementationTaskPlanResult } from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import {
  appendPromptTimeline,
  buildImplementationTaskPlanTimelineEntry,
  buildPrototypeExecutionOrchestrationPersistPatch,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

describe("buildImplementationTaskExecutionHints", () => {
  it("builds execution hints for implementation task", () => {
    const hints = buildImplementationTaskExecutionHints({
      taskTitle: "화면 API 연동",
      sourceArtifactTypes: ["api-spec", "screen-spec"],
      projectArtifacts: [],
    });
    expect(hints.candidateDirectories.length).toBeGreaterThan(0);
    expect(hints.candidateTests.length).toBeGreaterThan(0);
    expect(hints.testCommands.some((c) => c.includes("pnpm test"))).toBe(true);
    expect(hints.forbiddenPaths.some((p) => p.includes("package.json"))).toBe(true);
    expect(hints.forbiddenPaths.some((p) => p.includes("JYGallery"))).toBe(true);
  });
});

describe("buildCursorPromptDraft", () => {
  it("builds rich cursor prompt draft with required sections", () => {
    const hints = buildImplementationTaskExecutionHints({
      taskTitle: "녹취 업로드",
      sourceArtifactTypes: ["feature-spec"],
      projectArtifacts: [],
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
    expect(formatCursorExecutionBlockedMessage(gate.missing)).toContain("아직 Cursor 실행 요청");
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
  });
});

describe("buildConfirmImplementationTaskPlanResult", () => {
  it("returns created patch with task plan and cursor work items", () => {
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: "p1",
      requirementsStateJson: {},
      projectArtifacts: [],
      featureDraftTitles: ["업로드"],
      envOk: true,
      designOk: true,
    });
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    expect(result.plan.items[0]?.executionHints).toBeDefined();
    expect(result.workItems[0]?.qualityGate.promptReady).toBe(true);
    expect(result.chatPatch.messages[0]?.content).toContain("구현 task:");
  });
});

describe("implementation work plan chip routing", () => {
  it("handles implementation work plan confirm by generating task plan", () => {
    const confirm = vi.fn();
    tryHandlePrototypeExecutionChip("구현 작업안 확정", {
      openEnvSettings: vi.fn(),
      openArtifactHub: vi.fn(),
      focusComposerForScopeEdit: vi.fn(),
      confirmImplementationTaskPlan: confirm,
      requestCursorExecution: vi.fn(),
      prepareImplementationExecution: vi.fn(),
      confirmExecution: vi.fn(),
      refreshStatus: vi.fn(),
      showToast: vi.fn(),
      canConfirmImplementationTaskPlan: () => true,
      canRequestCursorExecution: () => true,
      canConfirmExecution: () => true,
    });
    expect(confirm).toHaveBeenCalledOnce();
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
