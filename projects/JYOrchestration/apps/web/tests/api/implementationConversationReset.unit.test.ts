import { describe, expect, it } from "vitest";
import { buildImplementationConversationResetStateJson } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const nowIso = "2026-05-25T12:00:00.000Z";

describe("buildImplementationConversationResetStateJson", () => {
  it("clears implementation session state but keeps planning artifacts and orchestration", () => {
    const base: RequirementsStateJson = {
      projectArtifacts: [
        {
          id: "a1",
          type: "feature-spec",
          title: "기능 정의서",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "feature-planning",
          content: "body",
        },
      ],
      singleChatOrchestrationV1: { slotDefinitionsHash: "h", slots: {}, updatedAt: nowIso } as RequirementsStateJson["singleChatOrchestrationV1"],
      artifactOrchestrationV1: { requiredTypes: ["feature-spec"], ready: true } as RequirementsStateJson["artifactOrchestrationV1"],
      prototypeExecutionSingleChatV1: {
        messages: [{ id: "m1", role: "user", content: "hello" } as never],
        slots: [],
        answers: {},
        currentSlotKey: null,
      },
      implementationWorkPlanDraftV1: { version: "implementation_work_plan_draft_v1" } as never,
      implementationSeedV1: { version: "implementation_seed_v1" } as never,
      implementationTaskPlanV1: { version: "implementation_task_plan_v1" } as never,
      prototypeWorkspaceTimelineCardsV1: [{ id: "c1", kind: "plan_ready", at: 1, runId: "r1" }],
      promptTimeline: [
        {
          stage: "requirements",
          stageGroup: "기획",
          workspaceScreenKey: "requirements",
          action: "quick_design_confirmed",
          source: "system",
          responseText: "planning",
          createdAt: nowIso,
        },
        {
          stage: "implementation",
          stageGroup: "구현",
          workspaceScreenKey: "prototype_execution",
          action: "implementation_work_plan_draft_generated",
          source: "system",
          responseText: "implementation",
          createdAt: nowIso,
          orchestrationTraceGroup: "implementation_orchestration",
        },
      ],
    };

    const reset = buildImplementationConversationResetStateJson(base, nowIso);

    expect(reset.projectArtifacts?.length).toBe(1);
    expect(reset.singleChatOrchestrationV1).toBeTruthy();
    expect(reset.artifactOrchestrationV1).toBeTruthy();
    expect(reset.prototypeExecutionSingleChatV1).toBeNull();
    expect(reset.implementationWorkPlanDraftV1).toBeNull();
    expect(reset.implementationSeedV1).toBeNull();
    expect(reset.implementationTaskPlanV1).toBeNull();
    expect(reset.prototypeWorkspaceTimelineCardsV1).toBeNull();
    expect(reset.promptTimeline?.some((e) => e.action === "implementation_work_plan_draft_generated")).toBe(
      false,
    );
    expect(reset.promptTimeline ?? []).toHaveLength(0);
    expect(reset.implementationTaskListV1).toBeNull();
    expect(reset.taskCursorExecutionV1).toBeNull();
  });

  it("clears promptTimeline and runtime execution state for drawer logs", () => {
    const base: RequirementsStateJson = {
      promptTimeline: [
        {
          stage: "requirements",
          stageGroup: "기획",
          workspaceScreenKey: "requirements",
          action: "quick_design_confirmed",
          source: "system",
          responseText: "planning",
          createdAt: nowIso,
        },
        {
          stage: "implementation",
          stageGroup: "구현",
          workspaceScreenKey: "prototype_execution",
          action: "task_cursor_api_started",
          source: "platform",
          orchestrationTraceGroup: "task_cursor_execution",
          responseText: "taskId=DEV-1 status=cursor_running",
          createdAt: nowIso,
        },
      ],
    };

    const reset = buildImplementationConversationResetStateJson(base, nowIso);

    expect(reset.promptTimeline ?? []).toHaveLength(0);
  });
});
