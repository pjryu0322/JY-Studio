import { describe, expect, it } from "vitest";
import {
  buildImplementationActionExecutedTimelineEntry,
  buildImplementationActionRouteTimelineEntries,
} from "@/lib/prototype/implementationIntentTimeline";

const classification = {
  intentType: "orchestration_action" as const,
  suggestedActionId: "CREATE_WORK_PLAN" as const,
  confidence: 0.88,
  executionIntent: "explicit_execute" as const,
  actionInvocationStrength: "explicit" as const,
  extractedRules: [],
  requiresPreActionPatch: false,
  shouldExecuteAction: true,
  targetAction: "CREATE_WORK_PLAN" as const,
  routerSource: "rule" as const,
};

describe("implementation intent timeline", () => {
  it("records action executed with router metadata", () => {
    const entry = buildImplementationActionExecutedTimelineEntry({
      actionId: "CREATE_WORK_PLAN",
      classification,
    });
    expect(entry.action).toBe("implementation_action_executed");
    expect(entry.responseText).toContain("actionId=CREATE_WORK_PLAN");
    expect(entry.responseText).toContain("routerSource=rule");
    expect(entry.responseText).toContain("confidence=0.88");
  });

  it("builds routed and executed pair", () => {
    const entries = buildImplementationActionRouteTimelineEntries({
      actionId: "CREATE_WORK_PLAN",
      classification,
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe("implementation_intent_routed");
    expect(entries[1]?.action).toBe("implementation_action_executed");
  });
});
