import { describe, expect, it } from "vitest";

import {
  MEMORY_RUNTIME_REFERENCE_MAX,
  buildMemoryRuntimePlan,
} from "@/lib/harness/memoryRuntime/buildMemoryRuntimePlan";

const NOW = new Date("2026-05-14T00:00:00Z").getTime();

describe("buildMemoryRuntimePlan", () => {
  it("returns a dry_run plan with the policy roleKey", () => {
    const plan = buildMemoryRuntimePlan({ roleKey: "AI_PLANNER", now: NOW });
    expect(plan.mode).toBe("dry_run");
    expect(plan.roleKey).toBe("AI_PLANNER");
    expect(plan.references).toEqual([]);
    expect(plan.findings.some((f) => f.code === "no_candidates")).toBe(true);
  });

  it("includes overlay used memory refs and timeline references", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "planner",
      now: NOW,
      overlayMetadata: {
        overlayContextAssembly: {
          usedRole: null,
          usedMemoryRefs: [
            { scope: "project", ref: "requirementsStateJson:goal" },
            { scope: "session", ref: "ChatMessage:dialogueExcerpt" },
          ],
          usedKnowledgePacks: [],
          usedStage: null,
          tokenBudgetHint: null,
        },
      },
      recentTimelineEntries: [
        { text: "사용자 목표는 협업 강화입니다.", source: "MessengerPromptTimelineLog#3", at: NOW - 60 * 1000 },
      ],
      workingContext: { workspaceScreenKey: "/workspace/ideation", recentUserText: "ux 흐름 정리" },
    });
    expect(plan.references.length).toBeGreaterThan(0);
    const ids = plan.references.map((r) => r.memoryId);
    expect(ids.some((id) => id.startsWith("overlay:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("timeline:"))).toBe(true);
    expect(ids.some((id) => id.startsWith("working:"))).toBe(true);
  });

  it("is deterministic for the same inputs", () => {
    const input = {
      roleKey: "architect",
      now: NOW,
      recentTimelineEntries: [
        { text: "microservice transition required", source: "MessengerPromptTimelineLog#1", at: NOW - 60 * 1000 },
        { text: "schema refactor proposed", source: "MessengerPromptTimelineLog#2", at: NOW - 120 * 1000 },
      ],
      workingContext: { workspaceScreenKey: "/workspace/architect", recentUserText: "" },
    };
    const a = buildMemoryRuntimePlan(input);
    const b = buildMemoryRuntimePlan(input);
    expect(a.references.map((r) => r.memoryId)).toEqual(b.references.map((r) => r.memoryId));
  });

  it("dedupes references by memoryId across sources", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "planner",
      now: NOW,
      recentTimelineEntries: [
        { text: "duplicate text", source: "duplicate_source", memoryId: "duplicate_id", at: NOW },
        { text: "duplicate text", source: "duplicate_source", memoryId: "duplicate_id", at: NOW },
      ],
    });
    const seen = new Set(plan.references.map((r) => r.memoryId));
    expect(seen.size).toBe(plan.references.length);
  });

  it("detects directional conflict and demotes freshness to stale", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "architect",
      now: NOW,
      projectContext: { directionalKeywords: ["microservice"] },
      recentTimelineEntries: [
        { text: "system is currently a monolith with shared DB", source: "decision-log", at: NOW - 60 * 1000 },
      ],
    });
    const stale = plan.references.filter((r) => r.freshness === "stale");
    expect(stale.length).toBeGreaterThan(0);
    expect(plan.findings.some((f) => f.code === "stale_memory_detected")).toBe(true);
  });

  it("caps references to MEMORY_RUNTIME_REFERENCE_MAX", () => {
    const entries = Array.from({ length: MEMORY_RUNTIME_REFERENCE_MAX * 2 }, (_, i) => ({
      text: `unique text ${i}`,
      source: `src-${i}`,
      memoryId: `mem-${i}`,
      at: NOW - i * 1000,
    }));
    const plan = buildMemoryRuntimePlan({ roleKey: "planner", now: NOW, recentTimelineEntries: entries });
    expect(plan.references.length).toBeLessThanOrEqual(MEMORY_RUNTIME_REFERENCE_MAX);
  });

  it("emits role_policy_missing finding when role does not match", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "unknown_role_xyz",
      now: NOW,
      recentTimelineEntries: [{ text: "sample text", source: "src", at: NOW }],
    });
    expect(plan.findings.some((f) => f.code === "role_policy_missing")).toBe(true);
  });

  it("emits scope_imbalance finding when only one scope appears with ≥3 refs", () => {
    const plan = buildMemoryRuntimePlan({
      roleKey: "planner",
      now: NOW,
      recentTimelineEntries: [
        { text: "entry a", source: "ChatMessage", memoryId: "a", at: NOW },
        { text: "entry b", source: "ChatMessage", memoryId: "b", at: NOW },
        { text: "entry c", source: "ChatMessage", memoryId: "c", at: NOW },
      ],
    });
    // No working context provided, no overlay refs → only session scope from ChatMessage
    expect(plan.findings.some((f) => f.code === "scope_imbalance")).toBe(true);
  });
});
