import { describe, expect, it } from "vitest";
import type { RequirementsStateJson, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { buildProjectCanvasHubCatalog } from "@/lib/requirements/projectCanvasHub";
import { buildAlternativeProposalPayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

const now = "2026-05-19T00:00:00.000Z";

function miniFlow(steps: string[]): RequirementsServiceFlowV1 {
  const actors = [
    { id: "a1", name: "사용자", kind: "human" as const, description: "" },
    { id: "a2", name: "시스템", kind: "system" as const, description: "" },
  ];
  return {
    createdAt: now,
    updatedAt: now,
    actors,
    steps: steps.map((title, i) => ({
      id: `s${i + 1}`,
      title,
      purpose: title,
      order: i + 1,
      primaryActorId: "a1",
      secondaryActorIds: [],
      approved: false,
      updatedAt: now,
    })),
  };
}

describe("projectCanvasHub", () => {
  it("buildProjectCanvasHubCatalog — 상태 Viewer 항목만 (산출물 제외)", () => {
    const baseline = miniFlow(["업로드", "정리"]);
    const alt = miniFlow(["업로드", "검토", "확정"]);
    const payload = buildAlternativeProposalPayload({
      baselineFlow: baseline,
      alternativeFlow: alt,
      proposalId: "hub-alt-1",
    });
    const flow: RequirementsServiceFlowV1 = {
      ...alt,
      alternativeProposalPayload: payload,
      proposalVariantMode: "ALTERNATIVE",
    };
    const state: RequirementsStateJson = {
      serviceFlowV1: flow,
      requirementsOrchestrationStageV1: "SERVICE_FLOW_REVIEW",
    };
    const catalog = buildProjectCanvasHubCatalog({ state, serviceFlow: flow });
    const types = catalog.map((c) => c.type);
    expect(types).toContain("service-flow");
    expect(types).toContain("alternative-flow");
    expect(types).toContain("baseline-flow");
    expect(types).not.toContain("deliverable");
    expect(catalog.every((c) => !("openTarget" in c))).toBe(true);
  });

  it("항목 type별 고유 id", () => {
    const flow = miniFlow(["A", "B"]);
    const catalog = buildProjectCanvasHubCatalog({
      state: { serviceFlowV1: flow },
      serviceFlow: flow,
    });
    const ids = new Set(catalog.map((c) => c.id));
    expect(ids.size).toBe(catalog.length);
  });
});
