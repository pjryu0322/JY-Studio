import { describe, expect, it } from "vitest";

import {
  HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT,
  HARNESS_APPLY_READINESS_MAX_SAMPLE_LIMIT,
  evaluateHarnessPromptApplyReadiness,
} from "@/lib/harness/promptAssembly/evaluateHarnessPromptApplyReadiness";
import type { HarnessPromptAssemblyPreview, HarnessPromptPreviewDiff } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";

function stablePreview(opts: {
  overflowRisk?: HarnessPromptAssemblyPreview["overflowRisk"];
  warnings?: readonly string[];
}): HarnessPromptAssemblyPreview {
  return {
    mode: "dry_run",
    sections: [
      {
        id: "role_contract",
        type: "role_contract",
        title: "역할 계약",
        content: "Role: planner",
        source: "overlayIdentity",
        includeReason: "role_resolved",
        priority: 0,
        estimatedCost: 30,
      },
    ],
    totalEstimatedCost: 30,
    overflowRisk: opts.overflowRisk ?? "low",
    warnings: opts.warnings ?? [],
  };
}

function diff(opts: {
  existingPromptLength?: number;
  previewLength?: number;
  missingSectionTypes?: readonly HarnessPromptPreviewDiff["missingSectionTypes"][number][];
}): HarnessPromptPreviewDiff {
  return {
    existingPromptLength: opts.existingPromptLength ?? 100,
    previewLength: opts.previewLength ?? 80,
    sectionCount: 4,
    missingSectionTypes: opts.missingSectionTypes ?? [],
    extraSectionTypes: [],
    warnings: [],
  };
}

describe("evaluateHarnessPromptApplyReadiness", () => {
  it("returns not_ready with empty entries", () => {
    const r = evaluateHarnessPromptApplyReadiness({ entries: [] });
    expect(r.mode).toBe("dry_run_readiness");
    expect(r.level).toBe("not_ready");
    expect(r.sampledEntryCount).toBe(0);
    expect(r.previewEntryCount).toBe(0);
    expect(r.findings.some((f) => f.code === "no_sample")).toBe(true);
  });

  it("returns not_ready when no entry has preview", () => {
    const r = evaluateHarnessPromptApplyReadiness({
      entries: [{}, {}, {}],
    });
    expect(r.level).toBe("not_ready");
    expect(r.sampledEntryCount).toBe(3);
    expect(r.previewEntryCount).toBe(0);
    expect(r.findings.some((f) => f.code === "no_preview")).toBe(true);
  });

  it("returns not_ready when missingSectionRate >= 0.5", () => {
    const r = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 4 }, (_, i) => ({
        harnessPromptAssemblyPreview: stablePreview({}),
        harnessPromptPreviewDiff: diff({
          missingSectionTypes: i < 3 ? ["role_contract"] : [],
        }),
      })),
    });
    expect(r.missingSectionRate).toBe(0.75);
    expect(r.level).toBe("not_ready");
    expect(r.findings.some((f) => f.code === "missing_section_rate_high")).toBe(true);
  });

  it("returns watch when warningRate is between 0.3 and 0.7", () => {
    const r = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 10 }, (_, i) => ({
        harnessPromptAssemblyPreview: stablePreview({
          warnings: i < 4 ? ["some warning"] : [],
        }),
        harnessPromptPreviewDiff: diff({}),
      })),
    });
    expect(r.warningRate).toBe(0.4);
    expect(r.level).toBe("watch");
    expect(r.findings.some((f) => f.code === "warning_rate_watch")).toBe(true);
  });

  it("returns watch when highOverflowRiskRate is between 0.2 and 0.5", () => {
    const r = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 10 }, (_, i) => ({
        harnessPromptAssemblyPreview: stablePreview({
          overflowRisk: i < 3 ? "high" : "low",
        }),
        harnessPromptPreviewDiff: diff({}),
      })),
    });
    expect(r.highOverflowRiskRate).toBe(0.3);
    expect(r.level).toBe("watch");
    expect(r.findings.some((f) => f.code === "overflow_risk_high_rate_watch")).toBe(true);
  });

  it("returns ready_candidate for stable previews", () => {
    const r = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 10 }, () => ({
        harnessPromptAssemblyPreview: stablePreview({}),
        harnessPromptPreviewDiff: diff({}),
      })),
    });
    expect(r.level).toBe("ready_candidate");
    expect(r.previewEntryCount).toBe(10);
    expect(r.missingSectionRate).toBe(0);
    expect(r.warningRate).toBe(0);
  });

  it("respects sampleLimit and uses the most recent N entries", () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      harnessPromptAssemblyPreview: stablePreview({}),
      harnessPromptPreviewDiff: diff({ existingPromptLength: i + 1 }),
    }));
    const r = evaluateHarnessPromptApplyReadiness({ entries, sampleLimit: 5 });
    expect(r.sampledEntryCount).toBe(5);
    // last 5 lengths: 26..30 → avg = 28 (floor)
    expect(r.averageExistingPromptLength).toBe(28);
  });

  it("clamps sampleLimit to safe bounds", () => {
    const r1 = evaluateHarnessPromptApplyReadiness({ entries: [], sampleLimit: -3 });
    expect(r1.sampledEntryCount).toBe(0);
    const big = Array.from({ length: 200 }, () => ({
      harnessPromptAssemblyPreview: stablePreview({}),
      harnessPromptPreviewDiff: diff({}),
    }));
    const r2 = evaluateHarnessPromptApplyReadiness({ entries: big, sampleLimit: 99999 });
    expect(r2.sampledEntryCount).toBeLessThanOrEqual(HARNESS_APPLY_READINESS_MAX_SAMPLE_LIMIT);
  });

  it("uses default sample limit when not provided", () => {
    const entries = Array.from({ length: HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT + 5 }, () => ({
      harnessPromptAssemblyPreview: stablePreview({}),
      harnessPromptPreviewDiff: diff({}),
    }));
    const r = evaluateHarnessPromptApplyReadiness({ entries });
    expect(r.sampledEntryCount).toBe(HARNESS_APPLY_READINESS_DEFAULT_SAMPLE_LIMIT);
  });

  it("does not include findings beyond cap", () => {
    // 모든 임계 동시 위반 → not_ready 다중 finding
    const entries = Array.from({ length: 10 }, () => ({
      harnessPromptAssemblyPreview: stablePreview({
        overflowRisk: "high",
        warnings: ["w"],
      }),
      harnessPromptPreviewDiff: diff({
        missingSectionTypes: ["role_contract", "memory_context"],
      }),
    }));
    const r = evaluateHarnessPromptApplyReadiness({ entries });
    expect(r.level).toBe("not_ready");
    expect(r.findings.length).toBeLessThanOrEqual(8);
    expect(r.missingSectionRate).toBe(1);
    expect(r.highOverflowRiskRate).toBe(1);
    expect(r.warningRate).toBe(1);
  });
});
