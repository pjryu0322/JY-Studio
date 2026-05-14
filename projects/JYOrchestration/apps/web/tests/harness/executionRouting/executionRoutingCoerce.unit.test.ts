import { describe, expect, it } from "vitest";

import {
  coerceExecutionRoutingMetadata,
  parseExecutionRoutingPlanFromUnknown,
} from "@/lib/harness/executionRouting/executionRoutingCoerce";

describe("executionRoutingCoerce", () => {
  it("returns null for null/non-object/wrong mode", () => {
    expect(parseExecutionRoutingPlanFromUnknown(null)).toBeNull();
    expect(parseExecutionRoutingPlanFromUnknown("string")).toBeNull();
    expect(parseExecutionRoutingPlanFromUnknown(123)).toBeNull();
    expect(parseExecutionRoutingPlanFromUnknown({})).toBeNull();
    expect(parseExecutionRoutingPlanFromUnknown({ mode: "apply", items: [] })).toBeNull();
  });

  it("parses valid plan and clips roleKey/stage", () => {
    const raw = {
      mode: "dry_run",
      roleKey: "planner",
      workspaceStage: "prototype-build",
      items: [
        {
          roleKey: "planner",
          capability: "planning",
          provider: "openai",
          enabled: true,
          reason: "role_policy_recommended:openai",
        },
      ],
      findings: [],
    };
    const parsed = parseExecutionRoutingPlanFromUnknown(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe("dry_run");
    expect(parsed?.roleKey).toBe("planner");
    expect(parsed?.workspaceStage).toBe("prototype-build");
    expect(parsed?.items.length).toBe(1);
    expect(parsed?.items[0]?.enabled).toBe(true);
  });

  it("falls back invalid provider to 'unknown' but keeps the row", () => {
    const parsed = parseExecutionRoutingPlanFromUnknown({
      mode: "dry_run",
      items: [
        {
          roleKey: "planner",
          capability: "planning",
          provider: "weird-provider",
          enabled: false,
          reason: "x",
        },
      ],
    });
    expect(parsed?.items.length).toBe(1);
    expect(parsed?.items[0]?.provider).toBe("unknown");
  });

  it("drops items missing required fields", () => {
    const parsed = parseExecutionRoutingPlanFromUnknown({
      mode: "dry_run",
      items: [
        { capability: "planning", provider: "openai", enabled: true, reason: "x" },
        { roleKey: "planner", provider: "openai", enabled: true, reason: "x" },
        { roleKey: "planner", capability: "planning", provider: "openai", enabled: true },
        { roleKey: "planner", capability: "not-a-cap", provider: "openai", enabled: true, reason: "x" },
      ],
    });
    expect(parsed?.items.length).toBe(0);
  });

  it("drops findings missing required fields or with invalid severity", () => {
    const parsed = parseExecutionRoutingPlanFromUnknown({
      mode: "dry_run",
      items: [],
      findings: [
        { code: "OK", severity: "info", message: "msg" },
        { code: "BAD", severity: "panic", message: "msg" },
        { code: "", severity: "info", message: "msg" },
        { severity: "info", message: "msg" },
        { code: "X", severity: "warning" },
      ],
    });
    expect(parsed?.findings.length).toBe(1);
    expect(parsed?.findings[0]?.code).toBe("OK");
  });

  it("coerceExecutionRoutingMetadata returns empty object when missing", () => {
    expect(coerceExecutionRoutingMetadata(null)).toEqual({});
    expect(coerceExecutionRoutingMetadata(undefined)).toEqual({});
    expect(coerceExecutionRoutingMetadata({})).toEqual({});
  });

  it("coerceExecutionRoutingMetadata returns parsed plan when present", () => {
    const out = coerceExecutionRoutingMetadata({
      executionRoutingPlan: {
        mode: "dry_run",
        roleKey: "developer",
        items: [
          {
            roleKey: "developer",
            capability: "code_generation",
            provider: "cursor",
            enabled: true,
            reason: "r",
          },
        ],
        findings: [],
      },
    });
    expect(out.executionRoutingPlan).toBeDefined();
    expect(out.executionRoutingPlan?.items.length).toBe(1);
  });
});
