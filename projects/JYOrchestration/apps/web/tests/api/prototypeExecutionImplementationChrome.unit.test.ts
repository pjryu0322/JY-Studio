import { describe, expect, it } from "vitest";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationSlotsFromContext } from "@/lib/prototype/implementationSlots";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { buildArtifactHubView } from "@/lib/prototype/artifactHubView";
import { buildImplementationSlotsInterviewUi } from "@/lib/prototype/prototypeExecutionImplementationChrome";
import { IMPLEMENTATION_MODE_PRIMARY_MEMBERS } from "@/lib/requirements/modeOrchestrationConfig";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("prototypeExecutionImplementationChrome", () => {
  it("uses implementation slot readiness for toolbar badge percent", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["업로드"],
      envOk: true,
      designOk: true,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const slots = buildImplementationSlotsFromContext({
      projectId: "p1",
      projectArtifacts: [],
      implementationTaskPlanV1: plan,
      cursorWorkItemsV1: workItems,
      envOk: true,
      designOk: true,
      envCursorBadge: "ok",
    });
    const ui = buildImplementationSlotsInterviewUi({
      implementationSlotsV1: slots,
      onQuickExecution: () => {},
    });
    expect(ui.readinessPercent).toBeGreaterThan(0);
    expect(ui.orchestrationSlotSections?.length).toBeGreaterThan(0);
    expect(ui.slotCellHints?.["구현 범위"]).toContain("확정");
  });

  it("reports implementation AI member count as four primary members", () => {
    expect(IMPLEMENTATION_MODE_PRIMARY_MEMBERS.length).toBe(4);
  });

  it("builds implementation artifact hub view with derived and reference entries", () => {
    const state = parseRequirementsStateJson({
      projectArtifacts: [
        {
          id: "f1",
          type: "feature-spec",
          title: "기능",
          content: "x",
          createdAt: "2026-01-01T00:00:00.000Z",
          createdBy: "ai",
          sourceStage: "feature-planning",
        },
      ],
      implementationTaskPlanV1: buildImplementationTaskPlan({
        projectId: "p1",
        projectArtifacts: [],
        featureDraftTitles: ["기능"],
        envOk: true,
        designOk: true,
      }),
    });
    const view = buildArtifactHubView({ mode: "implementation", state, projectId: "p1" });
    expect(view.implementationPrimary.length).toBeGreaterThan(0);
    expect(view.planningReference.some((e) => e.artifactType === "feature-spec")).toBe(true);
  });
});
