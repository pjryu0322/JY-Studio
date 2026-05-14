import { describe, expect, it } from "vitest";

import {
  coerceMemoryRuntimeMetadata,
  parseMemoryRuntimePlanFromUnknown,
} from "@/lib/harness/memoryRuntime/memoryRuntimeCoerce";

const VALID_REF = {
  memoryId: "test-id",
  scope: "project",
  summary: "summary text",
  freshness: "fresh",
  selectedReason: "test",
  selectedBy: "tester",
  estimatedImportance: 42,
};

describe("parseMemoryRuntimePlanFromUnknown", () => {
  it("returns null for non-object inputs", () => {
    expect(parseMemoryRuntimePlanFromUnknown(null)).toBeNull();
    expect(parseMemoryRuntimePlanFromUnknown("string")).toBeNull();
    expect(parseMemoryRuntimePlanFromUnknown(42)).toBeNull();
    expect(parseMemoryRuntimePlanFromUnknown([])).toBeNull();
  });

  it("returns null when mode is not dry_run", () => {
    expect(
      parseMemoryRuntimePlanFromUnknown({ mode: "apply", references: [], findings: [] })
    ).toBeNull();
  });

  it("parses a minimal valid plan", () => {
    const parsed = parseMemoryRuntimePlanFromUnknown({
      mode: "dry_run",
      roleKey: "planner",
      references: [VALID_REF],
      findings: [{ code: "ok", severity: "info", message: "ok message" }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe("dry_run");
    expect(parsed?.roleKey).toBe("planner");
    expect(parsed?.references).toHaveLength(1);
    expect(parsed?.findings).toHaveLength(1);
  });

  it("drops only references missing required fields and falls back invalid scope/freshness", () => {
    const parsed = parseMemoryRuntimePlanFromUnknown({
      mode: "dry_run",
      references: [
        { ...VALID_REF, memoryId: "valid-1" },
        { ...VALID_REF, memoryId: "bad-scope", scope: "invalid_scope" },
        { ...VALID_REF, memoryId: "bad-freshness", freshness: "weird" },
        { ...VALID_REF, memoryId: "" },
        null,
      ],
    });
    expect(parsed?.references).toHaveLength(3);
    // H4.5: invalid scope/freshness는 보수적 fallback으로 흡수.
    const fallbackScope = parsed?.references.find((r) => r.memoryId === "bad-scope");
    expect(fallbackScope?.scope).toBe("working");
    const fallbackFreshness = parsed?.references.find((r) => r.memoryId === "bad-freshness");
    expect(fallbackFreshness?.freshness).toBe("aging");
  });

  it("normalizes estimatedImportance to 0..100 non-negative int", () => {
    const parsed = parseMemoryRuntimePlanFromUnknown({
      mode: "dry_run",
      references: [
        { ...VALID_REF, memoryId: "neg", estimatedImportance: -10 },
        { ...VALID_REF, memoryId: "big", estimatedImportance: 9999 },
        { ...VALID_REF, memoryId: "nan", estimatedImportance: Number.NaN },
      ],
    });
    expect(parsed?.references[0]?.estimatedImportance).toBe(0);
    expect(parsed?.references[1]?.estimatedImportance).toBe(100);
    expect(parsed?.references[2]?.estimatedImportance).toBe(0);
  });

  it("caps references and findings via internal limits", () => {
    const tooMany = Array.from({ length: 200 }, (_, i) => ({ ...VALID_REF, memoryId: `id-${i}` }));
    const tooManyFindings = Array.from({ length: 50 }, (_, i) => ({
      code: `f-${i}`,
      severity: "info" as const,
      message: "msg",
    }));
    const parsed = parseMemoryRuntimePlanFromUnknown({
      mode: "dry_run",
      references: tooMany,
      findings: tooManyFindings,
    });
    expect(parsed?.references.length).toBeLessThanOrEqual(64);
    expect(parsed?.findings.length).toBeLessThanOrEqual(16);
  });
});

describe("coerceMemoryRuntimeMetadata", () => {
  it("returns empty object when raw has no memoryRuntimePlan", () => {
    expect(coerceMemoryRuntimeMetadata({})).toEqual({});
    expect(coerceMemoryRuntimeMetadata(null)).toEqual({});
  });

  it("attaches a valid plan only", () => {
    const out = coerceMemoryRuntimeMetadata({
      memoryRuntimePlan: { mode: "dry_run", roleKey: "planner", references: [VALID_REF], findings: [] },
    });
    expect(out.memoryRuntimePlan?.references).toHaveLength(1);
  });

  it("rejects invalid plan and returns empty object", () => {
    const out = coerceMemoryRuntimeMetadata({ memoryRuntimePlan: { mode: "apply", references: [] } });
    expect(out).toEqual({});
  });
});
