import { describe, expect, it } from "vitest";
import {
  applyAssignmentEditToFlow,
  computeAssignmentDiffLines,
  confirmActorInFlow,
  removeSecondaryActorFromStep,
  setStepPrimaryActor,
} from "@/lib/requirements/serviceFlowActorAssignment";
import { appendCandidateActorToFlow } from "@/lib/requirements/serviceFlowActorEditing";
import { syncServiceFlowToOrchestrationSlots } from "@/lib/requirements/serviceFlowOrchestrationSync";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T12:00:00.000Z";

function miniFlow(): RequirementsServiceFlowV1 {
  return {
    createdAt: now,
    updatedAt: now,
    actors: [
      { id: "a1", name: "사용자", kind: "human", description: "", status: "confirmed" },
      { id: "a2", name: "시스템", kind: "system", description: "", status: "confirmed" },
    ],
    steps: [
      {
        id: "s1",
        order: 1,
        title: "업로드",
        purpose: "업로드",
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: true,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowActorAssignment", () => {
  it("A — candidate → confirmed 승격", () => {
    const withCandidate = appendCandidateActorToFlow({
      flow: miniFlow(),
      nowIso: now,
      draft: {
        name: "검토자",
        actorType: "human",
        description: "",
        role: "",
        automation: "manual",
        relatedStepIds: ["s1"],
      },
    });
    const cid = withCandidate.actors!.find((a) => a.name === "검토자")!.id;
    const next = confirmActorInFlow({ flow: withCandidate, actorId: cid, nowIso: now });
    expect(next.actors!.find((a) => a.id === cid)?.status).toBe("confirmed");
  });

  it("B — primary reassignment", () => {
    const base = appendCandidateActorToFlow({
      flow: miniFlow(),
      nowIso: now,
      draft: {
        name: "검토자",
        actorType: "human",
        description: "",
        role: "",
        automation: "manual",
        relatedStepIds: ["s1"],
      },
    });
    const cid = base.actors!.find((a) => a.name === "검토자")!.id;
    const next = setStepPrimaryActor({
      flow: base,
      stepId: "s1",
      actorId: cid,
      replacePrimaryConfirmed: true,
      nowIso: now,
    });
    expect(next.steps?.[0]?.primaryActorId).toBe(cid);
    expect(next.actors!.find((a) => a.id === cid)?.status).toBe("confirmed");
  });

  it("C — secondary remove", () => {
    const withSec = appendCandidateActorToFlow({
      flow: miniFlow(),
      nowIso: now,
      draft: {
        name: "보조",
        actorType: "human",
        description: "",
        role: "",
        automation: "manual",
        relatedStepIds: ["s1"],
      },
    });
    const sid = withSec.actors!.find((a) => a.name === "보조")!.id;
    const next = removeSecondaryActorFromStep({ flow: withSec, stepId: "s1", actorId: sid, nowIso: now });
    expect(next.steps?.[0]?.secondaryActorIds).not.toContain(sid);
  });

  it("D — assignment diff 반영", () => {
    const base = miniFlow();
    const alt = setStepPrimaryActor({
      flow: base,
      stepId: "s1",
      actorId: "a2",
      replacePrimaryConfirmed: true,
      nowIso: now,
    });
    const lines = computeAssignmentDiffLines(base, alt);
    expect(lines.some((l) => l.includes("주 담당"))).toBe(true);
  });

  it("E — projection rebuild consistency", () => {
    const flow = applyAssignmentEditToFlow({
      flow: miniFlow(),
      nowIso: now,
      draft: {
        stepId: "s1",
        primaryActorId: "a2",
        secondaryActorIds: ["a1"],
        confirmActorIds: [],
        replacePrimaryConfirmed: true,
      },
    });
    expect(flow.lastProposalDecision).toBe("STRUCTURED_ACTOR_ASSIGN");
    expect(flow.lastAssignmentMutation?.assignmentAction).toBe("set_primary");
    expect(flow.steps?.[0]?.primaryActorId).toBe("a2");
    expect(flow.steps?.[0]?.secondaryActorIds).toContain("a1");

    const defs = [
      {
        slotKey: "planning.flow.serviceFlow",
        label: "서비스 흐름",
        sectionTitle: "흐름",
        capabilities: ["serviceFlow"],
      },
    ] as const;
    const orch = initialOrchestrationStateFromDefinitions(defs, now);
    const sync = syncServiceFlowToOrchestrationSlots({ flow, definitions: defs, orchestration: orch });
    if (sync) {
      expect(sync.slotSyncTriggered).toBe(true);
    }
  });
});
