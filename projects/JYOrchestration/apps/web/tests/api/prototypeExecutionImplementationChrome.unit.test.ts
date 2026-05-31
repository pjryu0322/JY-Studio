import { describe, expect, it } from "vitest";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationSlotsFromContext } from "@/lib/prototype/implementationSlots";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { buildArtifactHubView } from "@/lib/prototype/artifactHubView";
import {
  buildImplementationSlotsInterviewUi,
  overlayImplementationInterviewUiWithTaskExecutionProgress,
  resolveImplementationTaskExecutionProgress,
} from "@/lib/prototype/prototypeExecutionImplementationChrome";
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

  it("overlays task execution progress on toolbar badge when board has tasks", () => {
    const base = buildImplementationSlotsInterviewUi({
      implementationSlotsV1: null,
      onQuickExecution: () => {},
    });
    const board = {
      summary: {
        totalTasks: 14,
        completedTasks: 1,
        inProgressTasks: 0,
        failedTasks: 0,
        blockedTasks: 0,
      },
      taskRows: [],
      integratedSteps: [],
    } as ImplementationExecutionBoardV1;

    const progress = resolveImplementationTaskExecutionProgress({ board });
    expect(progress).toEqual({ covered: 1, total: 14, readinessPercent: 7 });

    const overlaid = overlayImplementationInterviewUiWithTaskExecutionProgress(base, { board });
    expect(overlaid.covered).toBe(1);
    expect(overlaid.total).toBe(14);
    expect(overlaid.readinessPercent).toBe(7);
    expect(overlaid.progressCountKind).toBe("tasks");
    expect(overlaid.statusCounts).toBeNull();
  });

  it("counts in-progress task in toolbar progress numerator", () => {
    const board = {
      summary: {
        totalTasks: 14,
        completedTasks: 0,
        inProgressTasks: 1,
        failedTasks: 0,
        blockedTasks: 0,
      },
      taskRows: [],
      integratedSteps: [],
    } as ImplementationExecutionBoardV1;

    expect(resolveImplementationTaskExecutionProgress({ board })).toEqual({
      covered: 1,
      total: 14,
      readinessPercent: 7,
    });
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
