import { describe, expect, it } from "vitest";
import { buildQuickDesignResultMessage, QUICK_DESIGN_TOOLTIP } from "@/lib/requirements/quickDesignLabels";
import {
  SERVICE_DEFINITION_AREA_LABEL,
  SERVICE_DEFINITION_PROGRESS_LABEL,
  SERVICE_PLANNING_TEAM_AREAS_PHRASE,
  serviceDefinitionSlotPathLabel,
} from "@/lib/requirements/servicePlanningUserLabels";
import { buildOrchestrationSlotSummarySections } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";

describe("servicePlanningUserLabels", () => {
  it("uses 서비스 정의 in Quick Design user-facing copy", () => {
    expect(QUICK_DESIGN_TOOLTIP).toContain(SERVICE_PLANNING_TEAM_AREAS_PHRASE);
    expect(QUICK_DESIGN_TOOLTIP).not.toContain("기획·분석");

    const message = buildQuickDesignResultMessage({ memberDrafts: [], assumptions: [] });
    expect(message).toContain(SERVICE_PLANNING_TEAM_AREAS_PHRASE);
    expect(message).not.toContain("기획·분석·설계·디자인");
    expect(message).not.toContain("기획 슬롯");
    expect(message).not.toContain("기획 후보");
  });

  it("labels planner slot section as 서비스 정의 in slot summary grid", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "테스트",
    });
    const state = initialOrchestrationStateFromDefinitions(definitions, "2026-01-01T00:00:00.000Z");
    const sections = buildOrchestrationSlotSummarySections(definitions, state);
    expect(sections.some((s) => s.sectionTitle === SERVICE_DEFINITION_AREA_LABEL)).toBe(true);
    expect(sections.some((s) => s.sectionTitle === "기획")).toBe(false);
  });

  it("builds slot path labels without 기획 prefix", () => {
    expect(serviceDefinitionSlotPathLabel("주 사용자")).toBe("서비스 정의 > 주 사용자");
    expect(SERVICE_DEFINITION_PROGRESS_LABEL).toBe("서비스 정의 진행도");
  });
});
