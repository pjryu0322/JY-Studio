import { describe, expect, it } from "vitest";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  clearImplementationConversationOnlyFromRequirementsJson,
  isImplementationSingleChatMessage,
} from "@/lib/requirements/resetDerivedImplementationState";
import { IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/prototype/implementationOrchestrationSummary";

describe("implementationConversationOnlyReset", () => {
  it("clears implementation chat messages only and keeps CodeTask plan", () => {
    const base = {
      implementationCodeTaskPlanV1: {
        version: "implementation_code_task_plan_v1",
        projectId: "p1",
        tasks: [{ id: "ct-1", title: "Task", status: "pending" }],
      },
      implementationWorkingQueueV1: {
        version: "implementation_working_queue_v1",
        projectId: "p1",
        items: [
          {
            id: "wq-1",
            projectId: "p1",
            title: "t",
            description: "d",
            rawUserMessage: "d",
            affectedArea: "unknown",
            status: "pending",
            riskLevel: "medium",
            createdAt: "2026-06-15T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z",
          },
        ],
        updatedAt: "2026-06-15T00:00:00.000Z",
      },
      implementationPreviewRuntimeV1: { previewUrl: "https://example.com/preview" },
      prototypeExecutionSingleChatV1: {
        version: "prototype_execution_single_chat_v1",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "fix ui",
            createdAt: "2026-06-15T00:00:00.000Z",
            meta: { serviceDesignStage: "implementation" },
          },
          {
            id: "m2",
            role: "user",
            content: "planning",
            createdAt: "2026-06-15T00:00:00.000Z",
            meta: {},
          },
        ],
      },
      promptTimeline: [
        {
          action: "implementation_bootstrap_lead_developer_summary",
          createdAt: "2026-06-15T00:00:00.000Z",
          stage: "implementation",
        },
      ],
    } as RequirementsStateJson;

    const next = clearImplementationConversationOnlyFromRequirementsJson(base, {
      nowIso: "2026-06-15T01:00:00.000Z",
      projectId: "p1",
    });

    expect(next.implementationCodeTaskPlanV1?.tasks?.length).toBe(1);
    expect(next.implementationWorkingQueueV1?.items?.length).toBe(1);
    expect(next.implementationPreviewRuntimeV1).toEqual(base.implementationPreviewRuntimeV1);
    const kept = next.prototypeExecutionSingleChatV1?.messages ?? [];
    expect(kept.every((m) => !isImplementationSingleChatMessage(m))).toBe(true);
    expect(kept.some((m) => m.content === "planning")).toBe(true);
    expect(
      next.promptTimeline?.some((e) => e.action === "implementation_conversation_reset_completed"),
    ).toBe(true);
  });

  it("does not null implementation seed on conversation-only reset", () => {
    const base = {
      implementationSeedV1: { version: "implementation_seed_v1", projectId: "p1" },
      prototypeExecutionSingleChatV1: {
        version: "prototype_execution_single_chat_v1",
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "ok",
            createdAt: "2026-06-15T00:00:00.000Z",
            meta: { internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE },
          },
        ],
      },
    } as RequirementsStateJson;
    const next = clearImplementationConversationOnlyFromRequirementsJson(base, {
      nowIso: "2026-06-15T01:00:00.000Z",
      projectId: "p1",
    });
    expect(next.implementationSeedV1).toBeTruthy();
    expect(next.implementationCodeTaskPlanV1).toBe(base.implementationCodeTaskPlanV1);
  });
});
