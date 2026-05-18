import { describe, expect, it } from "vitest";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

describe("extractOverlayPromptTraceMetadata", () => {
  it("extracts identity, policy hints, and policy warnings; ignores malformed warnings", () => {
    const row = {
      overlayIdentity: {
        roleKey: "planner",
        perspective: "planning",
        provider: "openai",
        capabilities: ["llm_chat"],
      },
      overlayPolicyHints: {
        knowledgeHintsEnabled: true,
        contextAssemblyEnabled: true,
        overlayTraceEnabled: true,
        cursorCapabilityAllowed: false,
        cursorCapabilityEnforcement: "not_applied",
      },
      overlayPolicyWarnings: [
        {
          code: "TEST_WARN",
          severity: "info",
          message: "hello",
          source: "singlechat",
          enforcement: "not_applied",
        },
        { bogus: true },
      ],
    };
    const x = extractOverlayPromptTraceMetadata(row);
    expect(x.overlayIdentity?.roleKey).toBe("planner");
    expect(x.overlayPolicyHints?.overlayTraceEnabled).toBe(true);
    expect(x.overlayPolicyWarnings?.length).toBe(1);
    expect(x.overlayPolicyWarnings?.[0]?.code).toBe("TEST_WARN");
  });

  it("returns empty overlayPolicyWarnings when all rows are invalid", () => {
    const x = extractOverlayPromptTraceMetadata({
      overlayPolicyWarnings: [{ enforcement: "block" }, { code: "X", severity: "warning" }],
    });
    expect(x.overlayPolicyWarnings).toBeUndefined();
  });

  it("extracts overlayIdentity together with hints and warnings", () => {
    const x = extractOverlayPromptTraceMetadata({
      overlayIdentity: {
        roleKey: "architect",
        perspective: "architecture",
        provider: "openai",
        capabilities: ["llm_chat"],
      },
      overlayPolicyHints: {
        knowledgeHintsEnabled: false,
        contextAssemblyEnabled: true,
        overlayTraceEnabled: true,
        cursorCapabilityAllowed: false,
        cursorCapabilityEnforcement: "not_applied",
      },
      overlayPolicyWarnings: [
        {
          code: "Z",
          severity: "info",
          message: "z",
          source: "singlechat",
          enforcement: "not_applied",
        },
      ],
    });
    expect(x.overlayIdentity?.roleKey).toBe("architect");
    expect(x.overlayPolicyHints?.overlayTraceEnabled).toBe(true);
    expect(x.overlayPolicyWarnings?.length).toBe(1);
  });

  it("replays overlay 5단계 optional metadata (selection/budget/conflict/decision trace)", () => {
    const x = extractOverlayPromptTraceMetadata({
      overlaySelectedContextRefs: [
        { type: "role", source: "planner", reason: "role_resolved", priority: 0 },
        { type: "memory", source: "platform", reason: "role_memory_scope", priority: 10 },
        { type: "bogus", source: "x", reason: "x", priority: 1 },
      ],
      overlayContextBudget: {
        budgetPolicy: "balanced",
        overflowRisk: "medium",
        estimatedInputTokens: 1234,
        estimatedOutputTokens: 256,
      },
      overlayConflictWarnings: [
        {
          code: "OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT",
          severity: "warning",
          category: "storage",
          message: "ok",
        },
      ],
      overlayOrchestrationDecisionTrace: {
        selectedRoleKey: "planner",
        selectionReason: "role_resolved",
        matchedCapabilities: ["llm_chat"],
        matchedKnowledgeScopes: ["platform_catalog"],
      },
    });
    expect(x.overlaySelectedContextRefs?.length).toBe(2);
    expect(x.overlayContextBudget?.budgetPolicy).toBe("balanced");
    expect(x.overlayConflictWarnings?.[0]?.code).toBe("OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT");
    expect(x.overlayOrchestrationDecisionTrace?.selectedRoleKey).toBe("planner");
  });
});
