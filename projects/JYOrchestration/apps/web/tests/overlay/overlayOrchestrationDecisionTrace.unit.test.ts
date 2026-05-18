import { describe, expect, it } from "vitest";
import {
  buildOverlayOrchestrationDecisionTrace,
  parseOverlayOrchestrationDecisionTraceFromUnknown,
} from "@/lib/overlay/overlayOrchestrationDecisionTrace";

describe("buildOverlayOrchestrationDecisionTrace", () => {
  it("records role, capabilities and knowledge scopes", () => {
    const t = buildOverlayOrchestrationDecisionTrace({
      roleKey: "ui-designer",
      capabilities: ["llm_chat", "slot_orchestration"],
      knowledgeScopes: ["platform_catalog"],
      selectionReason: "role_resolved",
    });
    expect(t.selectedRoleKey).toBe("ui-designer");
    expect(t.matchedCapabilities).toContain("llm_chat");
    expect(t.matchedKnowledgeScopes).toContain("platform_catalog");
    expect(t.selectionReason).toBe("role_resolved");
  });

  it("defaults missing fields safely", () => {
    const t = buildOverlayOrchestrationDecisionTrace({
      roleKey: "",
      capabilities: [],
      knowledgeScopes: [],
    });
    expect(t.selectedRoleKey).toBe("unknown");
    expect(t.selectionReason).toBe("role_resolved");
    expect(t.matchedCapabilities).toEqual([]);
    expect(t.matchedKnowledgeScopes).toEqual([]);
  });

  it("filters empty strings from arrays", () => {
    const t = buildOverlayOrchestrationDecisionTrace({
      roleKey: "planner",
      capabilities: ["", "llm_chat", "  "],
      knowledgeScopes: ["platform_catalog", ""],
    });
    expect(t.matchedCapabilities).toEqual(["llm_chat"]);
    expect(t.matchedKnowledgeScopes).toEqual(["platform_catalog"]);
  });
});

describe("parseOverlayOrchestrationDecisionTraceFromUnknown", () => {
  it("round-trips a built trace", () => {
    const built = buildOverlayOrchestrationDecisionTrace({
      roleKey: "ui-designer",
      capabilities: ["llm_chat"],
      knowledgeScopes: ["platform_catalog"],
    });
    const parsed = parseOverlayOrchestrationDecisionTraceFromUnknown(built);
    expect(parsed).toEqual(built);
  });

  it("returns null when selectedRoleKey is missing", () => {
    expect(
      parseOverlayOrchestrationDecisionTraceFromUnknown({
        selectedRoleKey: "",
        selectionReason: "r",
      })
    ).toBeNull();
    expect(parseOverlayOrchestrationDecisionTraceFromUnknown(null)).toBeNull();
    expect(parseOverlayOrchestrationDecisionTraceFromUnknown("x")).toBeNull();
  });
});
