import { describe, expect, it } from "vitest";
import {
  appendCandidateActorToFlow,
} from "@/lib/requirements/serviceFlowActorEditing";
import {
  applyCandidateActorStepRelations,
  buildActorRelatedStepViews,
  buildStepActorAssignmentViews,
  computeStepAssignmentDiffLines,
  formatStepActorAssignmentLine,
} from "@/lib/requirements/serviceFlowActorStepMapping";
import { syncServiceFlowToOrchestrationSlots } from "@/lib/requirements/serviceFlowOrchestrationSync";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

const now = "2026-05-19T12:00:00.000Z";

function miniFlow(): RequirementsServiceFlowV1 {
  return {
    createdAt: now,
    updatedAt: now,
    actors: [
      { id: "a1", name: "사용자", kind: "human", description: "" },
      { id: "a2", name: "시스템", kind: "system", description: "" },
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
      {
        id: "s2",
        order: 2,
        title: "정리",
        purpose: "정리",
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: true,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowActorStepMapping", () => {
  it("A — Actor 저장 시 step secondary relation 생성", () => {
    const next = appendCandidateActorToFlow({
      flow: miniFlow(),
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
    const candidate = next.actors?.find((a) => a.name === "검토자");
    expect(candidate?.status).toBe("candidate");
    const step = next.steps?.find((s) => s.id === "s1");
    expect(step?.secondaryActorIds).toContain(candidate!.id);
    expect(next.lastStructuredActorMutation?.affectedStepIds).toEqual(["s1"]);
    expect(next.lastStructuredActorMutation?.mutationSource).toBe("actor_drawer");
  });

  it("B — projection rebuild 이후 step relation 유지", () => {
    const flow = appendCandidateActorToFlow({
      flow: miniFlow(),
      nowIso: now,
      draft: {
        name: "검토자",
        actorType: "human",
        description: "",
        role: "",
        automation: "manual",
        relatedStepIds: ["s2"],
      },
    });
    const candidateId = flow.actors!.find((a) => a.status === "candidate")!.id;
    const defs = [
      {
        slotKey: "planning.flow.serviceFlow",
        label: "서비스 흐름",
        sectionTitle: "흐름",
        capabilities: ["serviceFlow"],
      },
    ] as const;
    const orch = initialOrchestrationStateFromDefinitions(defs, now);
    const sync = syncServiceFlowToOrchestrationSlots({
      flow,
      definitions: defs,
      orchestration: orch,
    });
    expect(sync).toBeTruthy();
    const step = flow.steps?.find((s) => s.id === "s2");
    expect(step?.secondaryActorIds).toContain(candidateId);
  });

  it("C — candidate actor diff 반영", () => {
    const base = miniFlow();
    const alt = appendCandidateActorToFlow({
      flow: base,
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
    const lines = computeStepAssignmentDiffLines(base, alt);
    expect(lines.some((l) => l.includes("검토자"))).toBe(true);
    expect(lines.some((l) => l.includes("업로드"))).toBe(true);
  });

  it("D — step viewer actor 표시", () => {
    const flow = appendCandidateActorToFlow({
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
    const views = buildStepActorAssignmentViews(flow);
    const s1 = views.find((v) => v.stepId === "s1");
    expect(s1?.primaryActorName).toContain("사용자");
    expect(s1?.candidateActorNames).toContain("검토자");
    const line = formatStepActorAssignmentLine(s1!);
    expect(line).toMatch(/후보:\s*검토자/);

    const actorViews = buildActorRelatedStepViews(flow, flow.actors!.find((a) => a.name === "검토자")!.id);
    expect(actorViews[0]?.stepTitle).toBe("업로드");
    expect(actorViews[0]?.role).toBe("candidate");
  });

  it("applyCandidateActorStepRelations — primary 유지", () => {
    const flow = miniFlow();
    const next = applyCandidateActorStepRelations({
      flow,
      actorId: "actor-candidate-1",
      relatedStepIds: ["s1"],
      nowIso: now,
    });
    const s1 = next.steps?.find((s) => s.id === "s1");
    expect(s1?.primaryActorId).toBe("a1");
    expect(s1?.secondaryActorIds).toContain("actor-candidate-1");
  });
});
