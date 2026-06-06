import { describe, expect, it } from "vitest";
import {
  buildRequirementsConversationResetStateJson,
  planningWorkspaceHasResettableContent,
  resolveWorkspaceDeliverableAssets,
  resolveWorkspaceProjectArtifacts,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("requirementsConversationReset", () => {
  it("clears artifacts, canvas sources, and orchestration on conversation reset", () => {
    const base: RequirementsStateJson = {
      deliverableAssets: [{ id: "d1", projectId: "p1", type: "full_plan", title: "요약", version: 1, content: "x", createdAt: nowIso }],
      projectArtifacts: [
        {
          id: "a1",
          type: "summary",
          title: "프로젝트 요약서",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "IDEATION",
          content: "body",
        },
      ],
      serviceFlowV1: { steps: [], createdAt: nowIso, updatedAt: nowIso } as RequirementsStateJson["serviceFlowV1"],
      featurePlanningSlotsV1: { version: 1, slots: [{ slotName: "f1", slotDescription: "d", legacy: false }], updatedAt: nowIso } as RequirementsStateJson["featurePlanningSlotsV1"],
      fastPlanDraftV1: { status: "draft", generatedAt: nowIso, flowId: "fast_plan_draft", memberRuns: [], memberDrafts: [], assumptions: [], source: "current_conversation_and_slots" },
      singleChatOrchestrationV1: { slotDefinitionsHash: "h", slots: {}, updatedAt: nowIso } as RequirementsStateJson["singleChatOrchestrationV1"],
    };

    const reset = buildRequirementsConversationResetStateJson(base, nowIso);

    expect(reset.deliverableAssets).toEqual([]);
    expect(reset.projectArtifacts).toEqual([]);
    expect(reset.serviceFlowV1).toBeNull();
    expect(reset.featurePlanningSlotsV1).toBeNull();
    expect(reset.fastPlanDraftV1).toBeNull();
    expect(reset.singleChatOrchestrationV1).toBeNull();
    expect(reset.implementationSeedV1).toBeNull();
    expect(reset.prototypeExecutionSingleChatV1).toBeNull();
    expect(reset.promptTimeline?.some((e) => e.action === "planning_reset_cleared_implementation_derivatives")).toBe(
      true,
    );
  });

  it("resolveWorkspaceDeliverableAssets honors empty local array after reset", () => {
    const local: RequirementsStateJson = { deliverableAssets: [] };
    const persisted = [
      { id: "old", projectId: "p1", type: "full_plan" as const, title: "old", version: 1, content: "x", createdAt: nowIso },
    ];
    expect(resolveWorkspaceDeliverableAssets({ localState: local, persisted })).toEqual([]);
  });

  it("resolveWorkspaceProjectArtifacts honors empty local array after reset", () => {
    const local: RequirementsStateJson = { projectArtifacts: [] };
    const persisted = [
      {
        id: "old",
        type: "summary" as const,
        title: "프로젝트 요약서",
        createdAt: nowIso,
        createdBy: "ai" as const,
        sourceStage: "IDEATION" as const,
        content: "x",
      },
    ];
    expect(resolveWorkspaceProjectArtifacts({ localState: local, persisted })).toEqual([]);
  });

  it("planning reset state includes explicit null runtime keys for local override", () => {
    const reset = buildRequirementsConversationResetStateJson(
      {
        codeTaskExecutionRunsV1: [{ version: "code_task_execution_run_v1" } as never],
        taskCursorExecutionV1: { version: "task_cursor_execution_v1" } as never,
      },
      nowIso,
    );
    expect(Object.prototype.hasOwnProperty.call(reset, "codeTaskExecutionRunsV1")).toBe(true);
    expect(reset.codeTaskExecutionRunsV1).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(reset, "taskCursorExecutionV1")).toBe(true);
    expect(reset.taskCursorExecutionV1).toBeNull();

    const persisted: RequirementsStateJson = {
      codeTaskExecutionRunsV1: [{ version: "code_task_execution_run_v1" } as never],
      taskCursorExecutionV1: { version: "task_cursor_execution_v1" } as never,
    };
    const merged: RequirementsStateJson = { ...persisted, ...reset };
    expect(merged.codeTaskExecutionRunsV1).toBeNull();
    expect(merged.taskCursorExecutionV1).toBeNull();
  });

  it("planningWorkspaceHasResettableContent is true when slots exist without chat messages", () => {
    expect(
      planningWorkspaceHasResettableContent({
        messageCount: 0,
        state: { singleChatOrchestrationV1: { slotDefinitionsHash: "h", slots: {}, updatedAt: nowIso } as never },
      }),
    ).toBe(true);
    expect(planningWorkspaceHasResettableContent({ messageCount: 0, state: {} })).toBe(false);
  });
});
