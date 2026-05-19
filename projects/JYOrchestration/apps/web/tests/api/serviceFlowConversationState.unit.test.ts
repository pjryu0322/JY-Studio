import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  quickRepliesForConversationState,
  resolveServiceFlowConversationState,
  withServiceFlowConversationState,
} from "@/lib/requirements/serviceFlowConversationState";

const now = "2026-05-19T00:00:00.000Z";

describe("serviceFlowConversationState", () => {
  it("resolveServiceFlowConversationState — stored state 우선", () => {
    const flow: RequirementsServiceFlowV1 = {
      createdAt: now,
      updatedAt: now,
      actors: [],
      steps: [],
      conversationState: "REVIEW",
    };
    expect(resolveServiceFlowConversationState(flow)).toBe("REVIEW");
  });

  it("withServiceFlowConversationState — REVIEW profile", () => {
    const flow: RequirementsServiceFlowV1 = {
      createdAt: now,
      updatedAt: now,
      actors: [],
      steps: [],
    };
    const next = withServiceFlowConversationState(flow, "REVIEW");
    expect(next.conversationState).toBe("REVIEW");
    expect(quickRepliesForConversationState("REVIEW")).toContain("흐름 상세 검토");
  });
});
