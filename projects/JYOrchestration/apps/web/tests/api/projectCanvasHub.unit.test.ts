import { describe, expect, it } from "vitest";
import type { RequirementsStateJson, RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildProjectCanvasHubCatalog,
  featurePlanningToDeliverablePreview,
} from "@/lib/requirements/projectCanvasHub";
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
  it("buildProjectCanvasHubCatalog — orchestration state 기준 (messageId 아님)", () => {
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
    const titles = catalog.map((c) => c.title);
    expect(titles).toContain("현재 서비스 흐름");
    expect(titles.some((t) => /후보|협업/.test(t))).toBe(true);
    expect(catalog.every((c) => c.id.startsWith("canvas-"))).toBe(true);
    expect(catalog.some((c) => c.openTarget.kind === "alternative-canvas")).toBe(true);
  });

  it("featurePlanningToDeliverablePreview — 기능 정의 hub viewer id", () => {
    const preview = featurePlanningToDeliverablePreview(
      {
        version: 1,
        generatedAt: now,
        updatedAt: now,
        slots: [
          {
            slotKey: "core",
            slotName: "핵심 기능",
            slotDescription: "업로드 후 요약",
            legacy: false,
          },
        ],
      },
      "proj-1",
    );
    expect(preview.id).toBe("canvas-feature-planning-preview");
    expect(preview.content).toContain("핵심 기능");
  });
});
