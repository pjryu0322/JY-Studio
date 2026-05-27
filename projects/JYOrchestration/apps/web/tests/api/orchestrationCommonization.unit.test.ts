import { describe, expect, it } from "vitest";
import { buildArtifactHubBundle } from "@/lib/requirements/artifactHubBundle";
import { buildWorkspacePlanningOrchestrationView } from "@/lib/requirements/buildWorkspacePlanningOrchestrationView";
import {
  isImplementationTimelineResetAction,
  isRecommendationTimelineAction,
  promptTimelineUserSummary,
} from "@/lib/requirements/promptTimelineActionCatalog";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import {
  isInternalOrchestrationUserText,
  sanitizeUserFacingOrchestrationText,
} from "@/lib/ui/userFacingOrchestrationText";
import {
  summarizeImplementationSeedForUser,
} from "@/lib/requirements/implementationStateUserSummary";

describe("promptTimelineState", () => {
  it("appends timeline entries with cap", () => {
    const base = Array.from({ length: 120 }, (_, i) => ({
      stage: "ideation",
      action: `a${i}`,
      source: "system",
      createdAt: new Date().toISOString(),
    }));
    const next = appendPromptTimeline(base, {
      stage: "ideation",
      action: "quick_design_confirmed",
      source: "system",
      createdAt: new Date().toISOString(),
    });
    expect(next).toHaveLength(120);
    expect(next[next.length - 1]?.action).toBe("quick_design_confirmed");
  });
});

describe("promptTimelineActionCatalog", () => {
  it("maps known actions to user-facing summaries", () => {
    expect(promptTimelineUserSummary("quick_design_confirmed_implementation_seed_auto_built")).toContain(
      "구현 준비정보",
    );
    expect(isRecommendationTimelineAction("quick_design_draft_created")).toBe(true);
    expect(isImplementationTimelineResetAction("implementation_turn_analyzed")).toBe(true);
  });
});

describe("userFacingOrchestrationText", () => {
  it("filters internal orchestration metadata", () => {
    expect(isInternalOrchestrationUserText("맥락 예산")).toBe(true);
    expect(sanitizeUserFacingOrchestrationText("맥락 예산 압축 정책")).toBe("");
    expect(sanitizeUserFacingOrchestrationText("회의록 자동화 요청")).toBe("회의록 자동화 요청");
  });
});

describe("buildArtifactHubBundle", () => {
  it("returns catalog view and orchestration together", () => {
    const bundle = buildArtifactHubBundle({
      mode: "planning",
      state: {},
      projectId: "p1",
    });
    expect(bundle.catalog).toEqual(expect.any(Array));
    expect(bundle.view.mode).toBe("planning");
    expect(bundle.orchestration.totalCount).toBe(bundle.catalog.length);
  });
});

describe("buildWorkspacePlanningOrchestrationView", () => {
  it("builds slot progress and artifact hub read model", () => {
    const view = buildWorkspacePlanningOrchestrationView({
      state: {},
      projectId: "p1",
      projectName: "데모",
      projectDescription: "회의록 서비스",
    });
    expect(view.slotDefs.length).toBeGreaterThan(0);
    expect(view.orchestrationUiState).toBeDefined();
    expect(view.planningArtifactHub.view.mode).toBe("planning");
  });
});

describe("implementationStateUserSummary", () => {
  it("summarizes implementation seed for users", () => {
    const summary = summarizeImplementationSeedForUser({
      lifecycleStatus: "candidate",
      readiness: { ready: false, score: 0.5, missing: ["scope"] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as never);
    expect(summary.summary).toContain("구현 준비정보");
    expect(summary.unresolvedItems.some((l) => l.includes("scope"))).toBe(true);
  });
});
