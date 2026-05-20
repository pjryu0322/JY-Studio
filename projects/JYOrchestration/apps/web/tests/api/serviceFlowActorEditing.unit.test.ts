import { describe, expect, it } from "vitest";
import {
  appendCandidateActorToFlow,
  nextActorEditingPhase,
} from "@/lib/requirements/serviceFlowActorEditing";

const now = "2026-05-19T00:00:00.000Z";

describe("serviceFlowActorEditing", () => {
  it("nextActorEditingPhase — open → save → confirmed", () => {
    let p = nextActorEditingPhase("IDLE", "open");
    expect(p).toBe("ENTER_EDIT");
    p = nextActorEditingPhase(p, "edit");
    expect(p).toBe("EDITING");
    p = nextActorEditingPhase(p, "save");
    expect(p).toBe("SAVE_PENDING");
    p = nextActorEditingPhase(p, "recompute_ok");
    expect(p).toBe("CONFIRMED");
  });

  it("appendCandidateActorToFlow — 실제 actors mutation", () => {
    const flow = {
      createdAt: now,
      updatedAt: now,
      actors: [{ id: "a1", name: "사용자", kind: "human" as const, description: "" }],
      steps: [],
    };
    const next = appendCandidateActorToFlow({
      flow,
      draft: {
        name: "검토자",
        actorType: "human",
        description: "승인 검토",
        role: "검토",
        automation: "manual",
        relatedStepIds: [],
      },
    });
    expect(next.actors?.length).toBe(2);
    expect(next.actors?.some((a) => a.name === "검토자")).toBe(true);
    expect(next.lastProposalDecision).toBe("STRUCTURED_ACTOR_ADD");
  });
});
