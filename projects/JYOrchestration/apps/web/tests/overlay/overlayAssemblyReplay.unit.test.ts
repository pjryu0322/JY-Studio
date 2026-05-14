import { describe, expect, it } from "vitest";

import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("Overlay PromptTrace 6단계 replay (assemblyPlan / pruningCandidates)", () => {
  const baseRow = {
    createdAt: "2026-05-01T00:00:00.000Z",
    action: "requirementsChatOrchestration",
    stage: "ideation",
    source: "llm" as const,
  };

  it("round-trips overlayContextAssemblyPlan via parseRequirementsStateJson + extract", () => {
    const row = {
      ...baseRow,
      overlayContextAssemblyPlan: [
        {
          type: "memory",
          source: "project",
          priority: 10,
          includeReason: "role_memory_scope",
          estimatedCost: 50,
          pruningCandidate: false,
        },
        {
          type: "knowledge",
          source: "role-default:planner",
          priority: 20,
          includeReason: "role_knowledge_hint",
          estimatedCost: 60,
          pruningCandidate: true,
        },
        {
          type: "role",
          source: "planner",
          priority: 0,
          includeReason: "role_resolved",
          estimatedCost: 5,
          pruningCandidate: false,
        },
        {
          type: "unknown",
          source: "bad",
          priority: 1,
          includeReason: "x",
          estimatedCost: 1,
          pruningCandidate: false,
        },
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const entry = parsed.promptTimeline?.[0];
    const x = extractOverlayPromptTraceMetadata(entry!);
    const types = x.overlayContextAssemblyPlan?.map((p) => p.type) ?? [];
    expect(types).toEqual(["memory", "knowledge"]);
    expect(x.overlayContextAssemblyPlan?.[1].pruningCandidate).toBe(true);
  });

  it("round-trips overlayPruningCandidates and drops invalid rows", () => {
    const row = {
      ...baseRow,
      overlayPruningCandidates: [
        { source: "promptTimeline", reason: "overflow_high_timeline", estimatedReduction: 42 },
        { source: "", reason: "missing", estimatedReduction: 10 },
        { source: "x", reason: "", estimatedReduction: 10 },
        { source: "y", reason: "overflow_high_workspace", estimatedReduction: -1 },
        "garbage",
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayPruningCandidates?.map((c) => c.source)).toEqual(["promptTimeline", "y"]);
    expect(x.overlayPruningCandidates?.[1].estimatedReduction).toBe(0);
  });

  it("absent fields stay undefined (no breaking change to replay)", () => {
    const parsed = parseRequirementsStateJson({ promptTimeline: [baseRow] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayContextAssemblyPlan).toBeUndefined();
    expect(x.overlayPruningCandidates).toBeUndefined();
    expect(x.overlayPrioritizedContextRefs).toBeUndefined();
    expect(x.overlayPolicyDriftWarnings).toBeUndefined();
  });

  it("round-trips overlayPrioritizedContextRefs (sorting metadata only)", () => {
    const row = {
      ...baseRow,
      overlayPrioritizedContextRefs: [
        { type: "role", source: "planner", reason: "role_resolved", priority: 0 },
        { type: "policy", source: "planner", reason: "policy_hint_role", priority: 5 },
        { type: "memory", source: "project", reason: "role_memory_scope", priority: 10 },
        { type: "timeline", source: "promptTimeline", reason: "promptTrace_overlay_enabled", priority: 30 },
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayPrioritizedContextRefs?.map((r) => r.type)).toEqual([
      "role",
      "policy",
      "memory",
      "timeline",
    ]);
  });

  it("round-trips overlayPolicyDriftWarnings and drops invalid rows", () => {
    const row = {
      ...baseRow,
      overlayPolicyDriftWarnings: [
        {
          code: "OVERLAY_DRIFT_NO_MEMORY_SCOPE",
          severity: "info",
          message: "memory scope 없음",
          source: "diagnostic",
          enforcement: "not_applied",
        },
        { code: "BAD", severity: "info", message: "", source: "diagnostic", enforcement: "not_applied" },
        {
          code: "OVERLAY_DRIFT_NO_REQUIRED_ITEM",
          severity: "info",
          message: "required 없음",
          source: "unknown",
          enforcement: "not_applied",
        },
        "garbage",
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    const codes = (x.overlayPolicyDriftWarnings ?? []).map((w) => w.code);
    expect(codes).toContain("OVERLAY_DRIFT_NO_MEMORY_SCOPE");
    expect(codes).toContain("OVERLAY_DRIFT_NO_REQUIRED_ITEM");
    expect(codes).not.toContain("BAD");
    for (const w of x.overlayPolicyDriftWarnings ?? []) {
      expect(w.enforcement).toBe("not_applied");
    }
  });

  it("drops invalid includeMode but preserves valid plan items", () => {
    const row = {
      ...baseRow,
      overlayContextAssemblyPlan: [
        {
          type: "memory",
          source: "project",
          priority: 10,
          includeReason: "role_memory_scope",
          estimatedCost: 50,
          pruningCandidate: false,
          includeMode: "recommended",
        },
        {
          type: "workspace",
          source: "design.canvas",
          priority: 40,
          includeReason: "workspace_screen_key",
          estimatedCost: 18,
          pruningCandidate: true,
          includeMode: "bogus",
        },
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayContextAssemblyPlan?.[0].includeMode).toBe("recommended");
    expect(x.overlayContextAssemblyPlan?.[1].includeMode).toBe("optional");
  });
});
