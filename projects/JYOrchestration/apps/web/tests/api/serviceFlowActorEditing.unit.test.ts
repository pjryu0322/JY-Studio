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

  it("appendCandidateActorToFlow — actors + step secondary relation", () => {
    const flow = {
      createdAt: now,
      updatedAt: now,
      actors: [{ id: "a1", name: "사용자", kind: "human" as const, description: "" }],
      steps: [
        {
          id: "s1",
          order: 1,
          title: "검토",
          purpose: "검토",
          primaryActorId: "a1",
          secondaryActorIds: [] as string[],
          approved: true,
          updatedAt: now,
        },
      ],
    };
    const next = appendCandidateActorToFlow({
      flow,
      nowIso: now,
      draft: {
        name: "검토자",
        actorType: "human",
        description: "승인 검토",
        role: "검토",
        automation: "manual",
        relatedStepIds: ["s1"],
      },
    });
    expect(next.actors?.length).toBe(2);
    const candidate = next.actors?.find((a) => a.name === "검토자");
    expect(candidate?.status).toBe("candidate");
    expect(next.steps?.[0]?.secondaryActorIds).toContain(candidate!.id);
    expect(next.lastProposalDecision).toBe("STRUCTURED_ACTOR_ADD");
    expect(candidate?.description).not.toMatch(/관련 단계:/);
  });
});
