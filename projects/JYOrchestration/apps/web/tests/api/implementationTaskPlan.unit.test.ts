import { describe, expect, it, vi } from "vitest";
import {
  buildCursorWorkItemsFromImplementationTaskPlan,
  evaluateCursorExecutionRequestGate,
  formatCursorExecutionBlockedMessage,
} from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildImplementationTaskPlan,
  buildImplementationTaskPlanSummaryMessage,
  evaluateImplementationTaskPlanReadiness,
} from "@/lib/prototype/implementationTaskPlan";
import { tryHandlePrototypeExecutionChip } from "@/lib/prototype/prototypeExecutionImplementationChips";
import { buildConfirmImplementationTaskPlanResult } from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import {
  appendPromptTimeline,
  buildPrototypeExecutionOrchestrationPersistPatch,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

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
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items[0]?.title).toContain("녹취");
    expect(plan.items[0]?.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(plan.items[0]?.securityChecks.length).toBeGreaterThan(0);
    expect(plan.items[0]?.cursorPromptDraft).toContain("Cursor 작업 지시");
    expect(plan.readiness.ready).toBe(true);
  });
});

describe("buildCursorWorkItemsFromImplementationTaskPlan", () => {
  it("builds cursor work items from implementation task plan", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["발화자 분석"],
      envOk: false,
      designOk: true,
    });
    const items = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    expect(items).toHaveLength(plan.items.length);
    expect(items[0]?.taskId).toBe(plan.items[0]?.id);
    expect(items[0]?.prompt).toBe(plan.items[0]?.cursorPromptDraft);
    expect(items[0]?.blocked).toBe(true);
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
    expect(gate.missing.length).toBeGreaterThan(0);
    expect(formatCursorExecutionBlockedMessage(gate.missing)).toContain("아직 Cursor 실행 요청");
  });

  it("allows cursor execution when plan and environment are ready", () => {
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
    expect(result.plan.items.length).toBeGreaterThan(0);
    expect(result.workItems.length).toBe(result.plan.items.length);
    expect(result.chatPatch.messages.length).toBeGreaterThan(0);
    expect(result.orchestrationPatch.promptTimeline.length).toBe(1);
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
    const summary = buildImplementationTaskPlanSummaryMessage(plan, { envOk: true, designOk: true });
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
    expect(parsed.implementationTaskPlanV1?.items.length).toBe(plan.items.length);
    expect(parsed.cursorWorkItemsV1?.length).toBe(workItems.length);
    expect(evaluateImplementationTaskPlanReadiness({
      plan: parsed.implementationTaskPlanV1,
      envOk: true,
      designOk: true,
    }).ready).toBe(true);
  });
});
