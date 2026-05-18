import { describe, expect, it } from "vitest";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { OVERLAY_CONFLICT_WARNINGS_MAX } from "@/lib/overlay/overlayConflictDetection";

describe("Overlay PromptTrace 5단계 replay (selection/budget/conflict/decision)", () => {
  const baseRow = {
    createdAt: "2026-02-01T00:00:00.000Z",
    action: "requirementsChatOrchestration",
    stage: "ideation",
    source: "llm" as const,
  };

  it("round-trips overlaySelectedContextRefs through parseRequirementsStateJson + extract", () => {
    const row = {
      ...baseRow,
      overlaySelectedContextRefs: [
        { type: "role", source: "planner", reason: "role_resolved", priority: 0 },
        { type: "memory", source: "project", reason: "role_memory_scope", priority: 10 },
        { type: "knowledge", source: "role-default:planner", reason: "role_knowledge_hint", priority: 20 },
        { type: "timeline", source: "promptTimeline", reason: "promptTrace_overlay_enabled", priority: 30 },
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const entry = parsed.promptTimeline?.[0];
    expect(entry?.overlaySelectedContextRefs?.length).toBe(4);
    const x = extractOverlayPromptTraceMetadata(entry!);
    expect(x.overlaySelectedContextRefs?.map((r) => r.type)).toEqual([
      "role",
      "memory",
      "knowledge",
      "timeline",
    ]);
  });

  it("round-trips overlayContextBudget metadata", () => {
    const row = {
      ...baseRow,
      overlayContextBudget: {
        budgetPolicy: "balanced",
        overflowRisk: "medium",
        estimatedInputTokens: 1500,
        estimatedOutputTokens: 450,
      },
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayContextBudget?.budgetPolicy).toBe("balanced");
    expect(x.overlayContextBudget?.overflowRisk).toBe("medium");
    expect(x.overlayContextBudget?.estimatedInputTokens).toBe(1500);
  });

  it("round-trips overlayConflictWarnings and drops invalid rows", () => {
    const row = {
      ...baseRow,
      overlayConflictWarnings: [
        {
          code: "OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT",
          severity: "warning",
          category: "storage",
          message: "ok",
        },
        { code: "", severity: "warning", category: "storage", message: "missing-code" },
        { code: "X", severity: "weird", category: "storage", message: "bad-severity" },
        { code: "Y", severity: "warning", category: "bogus", message: "bad-category" },
      ],
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayConflictWarnings?.map((w) => w.code)).toEqual([
      "OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT",
    ]);
  });

  it("caps overlayConflictWarnings to OVERLAY_CONFLICT_WARNINGS_MAX", () => {
    const oversized = new Array(OVERLAY_CONFLICT_WARNINGS_MAX + 8).fill({
      code: "OVERLAY_CONFLICT_X",
      severity: "info",
      category: "architecture",
      message: "m",
    });
    const parsed = parseRequirementsStateJson({
      promptTimeline: [{ ...baseRow, overlayConflictWarnings: oversized }],
    });
    expect(parsed.promptTimeline?.[0]?.overlayConflictWarnings?.length).toBe(
      OVERLAY_CONFLICT_WARNINGS_MAX
    );
  });

  it("round-trips overlayOrchestrationDecisionTrace and drops rows without role key", () => {
    const row = {
      ...baseRow,
      overlayOrchestrationDecisionTrace: {
        selectedRoleKey: "planner",
        selectionReason: "role_resolved",
        matchedCapabilities: ["llm_chat", "slot_orchestration"],
        matchedKnowledgeScopes: ["platform_catalog"],
      },
    };
    const parsed = parseRequirementsStateJson({ promptTimeline: [row] });
    const x = extractOverlayPromptTraceMetadata(parsed.promptTimeline?.[0]!);
    expect(x.overlayOrchestrationDecisionTrace?.selectedRoleKey).toBe("planner");
    expect(x.overlayOrchestrationDecisionTrace?.matchedCapabilities).toContain("llm_chat");

    const blank = parseRequirementsStateJson({
      promptTimeline: [
        {
          ...baseRow,
          overlayOrchestrationDecisionTrace: {
            selectedRoleKey: "",
            selectionReason: "",
            matchedCapabilities: [],
            matchedKnowledgeScopes: [],
          },
        },
      ],
    });
    expect(blank.promptTimeline?.[0]?.overlayOrchestrationDecisionTrace).toBeUndefined();
  });
});
