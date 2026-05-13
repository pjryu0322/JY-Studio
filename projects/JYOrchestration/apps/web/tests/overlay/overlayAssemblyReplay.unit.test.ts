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
  });
});
