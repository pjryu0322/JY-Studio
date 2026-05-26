import { describe, expect, it } from "vitest";
import {
  PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE,
  PLANNING_RESET_CLEARED_IMPLEMENTATION_TRACE_ACTION,
  appendPlanningResetClearedImplementationTrace,
  clearDerivedImplementationStateFromRequirementsJson,
  filterImplementationPromptTimeline,
  isImplementationSingleChatMessage,
  resetDerivedImplementationStateFromRequirementsJson,
  resetImplementationSingleChatMessages,
} from "@/lib/requirements/resetDerivedImplementationState";
import { IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE } from "@/lib/prototype/implementationOrchestrationSummary";
import {
  buildImplementationConversationResetStateJson,
  buildRequirementsConversationResetStateJson,
} from "@/lib/requirements/requirementsWorkspaceHelpers";
import { IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/prototype/implementationOrchestrationSummary";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

const nowIso = "2026-05-25T12:00:00.000Z";

function msg(partial: Partial<RequirementsMessage> & Pick<RequirementsMessage, "id" | "content">): RequirementsMessage {
  return {
    id: partial.id,
    role: partial.role ?? "ai",
    speakerId: partial.speakerId ?? "prototype_build",
    speakerName: partial.speakerName ?? "AI",
    speakerType: partial.speakerType ?? "AI",
    visibility: partial.visibility ?? "PUBLIC",
    messageType: partial.messageType ?? "NOTICE",
    content: partial.content,
    createdAt: partial.createdAt ?? nowIso,
    meta: { stage: "REQUIREMENTS", ...partial.meta },
  };
}

describe("resetDerivedImplementationState", () => {
  it("clears implementation derived state when planning is reset", () => {
    const base: RequirementsStateJson = {
      originalProjectDescription: "원문 설명",
      openIssues: "이슈",
      implementationSeedV1: { version: "implementation_seed_v1" } as never,
      implementationWorkPlanDraftV1: { version: "implementation_work_plan_draft_v1" } as never,
      implementationTaskPlanV1: { version: "implementation_task_plan_v1" } as never,
      implementationSlotsV1: { version: "implementation_slots_v1" } as never,
      cursorWorkItemsV1: [{ id: "w1" } as never],
      codeAgentWipExecutionV1: { version: "code_agent_wip_execution_v1" } as never,
      prototypeExecutionSingleChatV1: {
        messages: [{ id: "m1", role: "user", content: "hi" } as never],
        slots: [],
        answers: {},
      },
      promptTimeline: [
        {
          stage: "implementation",
          stageGroup: "구현",
          workspaceScreenKey: "prototype_execution",
          action: "implementation_work_plan_draft_generated",
          source: "system",
          responseText: "impl",
          createdAt: nowIso,
          orchestrationTraceGroup: "implementation_orchestration",
        },
      ],
    };

    const reset = buildRequirementsConversationResetStateJson(base, nowIso);

    expect(reset.implementationSeedV1).toBeNull();
    expect(reset.implementationWorkPlanDraftV1).toBeNull();
    expect(reset.implementationTaskPlanV1).toBeNull();
    expect(reset.implementationSlotsV1).toBeNull();
    expect(reset.cursorWorkItemsV1).toBeNull();
    expect(reset.codeAgentWipExecutionV1).toBeNull();
    expect(reset.prototypeExecutionSingleChatV1).toBeNull();
    expect(reset.originalProjectDescription).toBe("원문 설명");
    expect(reset.openIssues).toBe("이슈");
    expect(
      reset.promptTimeline?.some((e) => e.action === PLANNING_RESET_CLEARED_IMPLEMENTATION_TRACE_ACTION),
    ).toBe(true);
    expect(
      reset.promptTimeline?.some((e) => e.action === "implementation_work_plan_draft_generated"),
    ).toBe(false);
  });

  it("clears implementation single chat messages when planning is reset", () => {
    const bootstrap = msg({
      id: "impl-boot",
      content: "구현 진입",
      meta: {
        stage: "REQUIREMENTS",
        internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
        serviceDesignStage: "implementation",
      },
    });
    const roleCheck = msg({
      id: "impl-role",
      content: "역할별 점검",
      meta: {
        stage: "REQUIREMENTS",
        internalType: IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE,
        serviceDesignStage: "implementation",
      },
    });
    const planning = msg({
      id: "plan-msg",
      content: "기획 메모",
      meta: { stage: "REQUIREMENTS", serviceDesignStage: "feature-planning" },
    });

    const filtered = resetImplementationSingleChatMessages({
      messages: [bootstrap, roleCheck, planning],
      slots: [],
      answers: {},
    });

    expect(filtered?.messages.map((m) => m.id)).toEqual(["plan-msg"]);
    expect(isImplementationSingleChatMessage(bootstrap)).toBe(true);
    expect(isImplementationSingleChatMessage(roleCheck)).toBe(true);
    expect(isImplementationSingleChatMessage(planning)).toBe(false);
  });

  it("strips implementation project artifacts while keeping planning artifacts", () => {
    const cleared = clearDerivedImplementationStateFromRequirementsJson({
      projectArtifacts: [
        {
          id: "plan",
          type: "feature-spec",
          title: "기능 정의서",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "feature-planning",
          content: "body",
        },
        {
          id: "impl",
          type: "implementation-seed",
          title: "Seed",
          createdAt: nowIso,
          createdBy: "ai",
          sourceStage: "implementation",
          content: "seed",
        },
      ],
      implementationSeedV1: { version: "implementation_seed_v1" } as never,
    });
    expect(cleared.projectArtifacts?.map((a) => a.id)).toEqual(["plan"]);
    expect(cleared.implementationSeedV1).toBeNull();
  });

  it("exposes resetDerivedImplementationStateFromRequirementsJson alias", () => {
    expect(resetDerivedImplementationStateFromRequirementsJson).toBe(
      clearDerivedImplementationStateFromRequirementsJson,
    );
  });

  it("clears implementation timeline traces when planning is reset", () => {
    const timeline = filterImplementationPromptTimeline([
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
        action: "planning_implementation_seed_evaluated",
        source: "system",
        responseText: "type=planning_implementation_seed_evaluated",
        createdAt: nowIso,
      },
    ]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.action).toBe("quick_design_confirmed");
  });

  it("keeps environment-related project meta when planning is reset", () => {
    const base: RequirementsStateJson = {
      originalProjectDescription: "설명 유지",
      seededFromPreProjectChat: true,
      openIssues: "open",
      priorityFeatures: "prio",
      implementationSeedV1: { version: "implementation_seed_v1" } as never,
    };
    const reset = buildRequirementsConversationResetStateJson(base, nowIso);
    expect(reset.originalProjectDescription).toBe("설명 유지");
    expect(reset.seededFromPreProjectChat).toBe(true);
    expect(reset.openIssues).toBe("open");
    expect(reset.priorityFeatures).toBe("prio");
    expect(reset.implementationSeedV1).toBeNull();
  });

  it("keeps planning slots and artifacts when only implementation is reset", () => {
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
      implementationSeedV1: { version: "implementation_seed_v1" } as never,
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
          action: "implementation_seed_evaluated",
          source: "system",
          responseText: "impl",
          createdAt: nowIso,
        },
      ],
    };

    const reset = buildImplementationConversationResetStateJson(base, nowIso);

    expect(reset.projectArtifacts?.length).toBe(1);
    expect(reset.singleChatOrchestrationV1).toBeTruthy();
    expect(reset.implementationSeedV1).toBeNull();
    expect(reset.promptTimeline?.some((e) => e.action === "implementation_seed_evaluated")).toBe(false);
    expect(reset.promptTimeline?.some((e) => e.action === "quick_design_confirmed")).toBe(true);
  });

  it("shows reset warning that implementation derived data will be cleared but environment settings remain", () => {
    expect(PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("구현 준비 데이터");
    expect(PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("구현 작업안");
    expect(PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("구현 Seed");
    expect(PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("Code Agent");
    expect(PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("환경설정");
    expect(PLANNING_RESET_CONVERSATION_CONFIRM_MESSAGE).toContain("Git/Code Agent");
  });

  it("dedupes planning reset cleared implementation trace", () => {
    const first = appendPlanningResetClearedImplementationTrace([], nowIso);
    const second = appendPlanningResetClearedImplementationTrace(first, nowIso);
    expect(second.filter((e) => e.action === PLANNING_RESET_CLEARED_IMPLEMENTATION_TRACE_ACTION)).toHaveLength(1);
  });

  it("merge patch clears derived implementation fields explicitly", () => {
    const base: RequirementsStateJson = {
      singleChatOrchestrationV1: null,
      implementationSeedV1: { version: "implementation_seed_v1" } as never,
    };
    const cleared = clearDerivedImplementationStateFromRequirementsJson(base);
    expect(cleared.implementationSeedV1).toBeNull();
  });
});
