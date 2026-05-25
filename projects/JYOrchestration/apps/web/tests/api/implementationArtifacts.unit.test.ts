import { describe, expect, it } from "vitest";
import { defaultArtifactHubStageFilter } from "@/lib/prototype/artifactHubStage";
import { buildArtifactHubView, groupArtifactHubEntriesForDisplay } from "@/lib/prototype/artifactHubView";
import {
  buildDerivedImplementationArtifacts,
  derivedHubEntryToDeliverableAsset,
  derivedImplementationArtifactToHubEntry,
} from "@/lib/prototype/implementationArtifacts";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationSlotsFromContext } from "@/lib/prototype/implementationSlots";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { buildInitialCodeAgentWipExecution, buildStubCodeAgentWipCommit } from "@/lib/prototype/codeAgentWipExecution";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

describe("buildDerivedImplementationArtifacts", () => {
  it("builds derived implementation artifacts from task plan and code agent state", () => {
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
    const wipBase = buildInitialCodeAgentWipExecution({ projectId: "p1", plan, workItems });
    const wip = {
      ...wipBase,
      commits: [buildStubCodeAgentWipCommit({ wip: wipBase, plan, workItems })],
      status: "developer_reviewing" as const,
    };

    const derived = buildDerivedImplementationArtifacts({
      projectId: "p1",
      implementationTaskPlanV1: plan,
      implementationSlotsV1: slots,
      cursorWorkItemsV1: workItems,
      codeAgentWipExecutionV1: wip,
    });

    const types = derived.map((d) => d.type);
    expect(types).toContain("implementation-task-plan");
    expect(types).toContain("code-agent-work-instruction");
    expect(types).toContain("wip-result-report");
    expect(types).toContain("review-criteria-summary");
    expect(types).toContain("security-criteria-summary");
  });
});

describe("buildArtifactHubView", () => {
  const artifacts: ProjectArtifact[] = [
    {
      id: "f1",
      type: "feature-spec",
      title: "기능",
      content: "# 기능",
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "ai",
      sourceStage: "feature-planning",
    },
  ];

  it("opens artifact hub with implementation filter in implementation mode", () => {
    const state = parseRequirementsStateJson({
      projectArtifacts: artifacts,
      implementationTaskPlanV1: buildImplementationTaskPlan({
        projectId: "p1",
        projectArtifacts: artifacts,
        featureDraftTitles: ["기능"],
        envOk: true,
        designOk: true,
      }),
    });
    const view = buildArtifactHubView({ mode: "implementation", state, projectId: "p1", projectArtifacts: artifacts });
    expect(view.defaultStageFilter).toBe("implementation");
    expect(defaultArtifactHubStageFilter("implementation")).toBe("implementation");
    expect(view.implementationPrimary.length).toBeGreaterThan(0);
  });

  it("separates implementation artifacts from planning reference artifacts", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: artifacts,
      featureDraftTitles: ["기능"],
      envOk: true,
      designOk: true,
    });
    const view = buildArtifactHubView({
      mode: "implementation",
      state: parseRequirementsStateJson({ projectArtifacts: artifacts, implementationTaskPlanV1: plan }),
      projectId: "p1",
      projectArtifacts: artifacts,
    });
    const sections = groupArtifactHubEntriesForDisplay(view, "implementation").sections;
    expect(sections.some((s) => s.title === "구현 산출물")).toBe(true);
    expect(sections.some((s) => s.title === "참조 기획 산출물")).toBe(true);
    expect(view.implementationPrimary.every((e) => e.hubSection === "implementation-primary")).toBe(true);
    expect(view.planningReference.every((e) => e.hubSection === "planning-reference")).toBe(true);
  });

  it("keeps planning artifact hub behavior unchanged in planning mode", () => {
    const view = buildArtifactHubView({
      mode: "planning",
      state: parseRequirementsStateJson({ projectArtifacts: artifacts }),
      projectId: "p1",
      projectArtifacts: artifacts,
    });
    expect(view.defaultStageFilter).toBe("planning");
    expect(view.implementationPrimary).toHaveLength(0);
    expect(view.planningPrimary.length).toBeGreaterThan(0);
  });
});

describe("derived implementation artifact viewer", () => {
  it("opens derived implementation artifact in viewer", () => {
    const entry = derivedImplementationArtifactToHubEntry({
      id: "x",
      type: "implementation-task-plan",
      stage: "implementation",
      title: "구현 작업안",
      body: "# test",
      source: [],
      status: "ready",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const asset = derivedHubEntryToDeliverableAsset(entry, "p1");
    expect(asset?.content).toContain("# test");
    expect(asset?.title).toBe("구현 작업안");
  });
});
