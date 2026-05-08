import { describe, expect, it } from "vitest";
import {
  buildWorkspaceAiSlotDefinitionPreview,
  catalogIdToSlotOwnerAgents,
  slotPreviewRowsForCatalogMember,
} from "@/lib/workspace-ai/workspaceAiCatalogSlotPreview";

describe("workspaceAiCatalogSlotPreview", () => {
  it("ideation은 planner 슬롯만 매핑", () => {
    expect(catalogIdToSlotOwnerAgents("ideation")).toEqual(["planner"]);
    const defs = buildWorkspaceAiSlotDefinitionPreview();
    const rows = slotPreviewRowsForCatalogMember("ideation", defs);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.label.length > 0)).toBe(true);
  });

  it("actor_flow는 분석가 계열 owner", () => {
    expect(catalogIdToSlotOwnerAgents("actor_flow")).toContain("service-designer");
    expect(catalogIdToSlotOwnerAgents("actor_flow")).toContain("domain-expert");
  });
});
