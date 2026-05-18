import { describe, expect, it } from "vitest";

import { evaluateHarnessPromptApplyReadiness } from "@/lib/harness/promptAssembly/evaluateHarnessPromptApplyReadiness";
import {
  HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER,
  buildHarnessPromptApplyReadinessVM,
  harnessPromptApplyReadinessLevelLabel,
  harnessPromptApplyReadinessLevelTone,
  harnessPromptApplyReadinessSeverityLabel,
} from "@/lib/overlay-ui/harnessPromptApplyReadinessUiAdapter";
import type { HarnessPromptAssemblyPreview, HarnessPromptPreviewDiff } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";

function preview(opts: {
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

describe("harnessPromptApplyReadinessUiAdapter", () => {
  it("exposes Korean level labels and tones", () => {
    expect(harnessPromptApplyReadinessLevelLabel("not_ready")).toBe("준비 부족");
    expect(harnessPromptApplyReadinessLevelLabel("watch")).toBe("관찰 필요");
    expect(harnessPromptApplyReadinessLevelLabel("ready_candidate")).toBe("적용 후보");
    expect(harnessPromptApplyReadinessLevelTone("ready_candidate")).toBe("positive");
    expect(harnessPromptApplyReadinessLevelTone("watch")).toBe("info");
    expect(harnessPromptApplyReadinessLevelTone("not_ready")).toBe("warning");
  });

  it("returns hasData=false on null report with disclaimer", () => {
    const vm = buildHarnessPromptApplyReadinessVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(HARNESS_PROMPT_APPLY_READINESS_DISCLAIMER);
    expect(vm.disclaimer).toContain("실제 적용 결과가 아니라");
    expect(vm.levelLabel).toBe("준비 부족");
    expect(vm.missingSectionRateLabel).toBe("ㅡ");
  });

  it("rejects reports with wrong mode field", () => {
    const vm = buildHarnessPromptApplyReadinessVM({
      mode: "not_dry_run" as unknown as "dry_run_readiness",
      level: "ready_candidate",
      sampledEntryCount: 10,
      previewEntryCount: 10,
      missingSectionRate: 0,
      highOverflowRiskRate: 0,
      warningRate: 0,
      averageExistingPromptLength: 0,
      averagePreviewLength: 0,
      findings: [],
    });
    expect(vm.hasData).toBe(false);
  });

  it("renders rate labels as percentage", () => {
    const report = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 4 }, (_, i) => ({
        harnessPromptAssemblyPreview: preview({}),
        harnessPromptPreviewDiff: diff({
          missingSectionTypes: i < 3 ? ["role_contract"] : [],
        }),
      })),
    });
    const vm = buildHarnessPromptApplyReadinessVM(report);
    expect(vm.missingSectionRateLabel).toBe("75%");
    expect(vm.warningRateLabel).toBe("0%");
    expect(vm.levelLabel).toBe("준비 부족");
  });

  it("composes a single-line summaryText", () => {
    const report = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 5 }, () => ({
        harnessPromptAssemblyPreview: preview({}),
        harnessPromptPreviewDiff: diff({}),
      })),
    });
    const vm = buildHarnessPromptApplyReadinessVM(report);
    expect(vm.summaryText).toContain("Harness 적용 준비도:");
    expect(vm.summaryText).toContain("샘플 5개");
    expect(vm.summaryText).toContain("Preview 5개");
  });

  it("maps finding severities to Korean labels", () => {
    expect(harnessPromptApplyReadinessSeverityLabel("info")).toBe("안내");
    expect(harnessPromptApplyReadinessSeverityLabel("warning")).toBe("주의");
    const report = evaluateHarnessPromptApplyReadiness({ entries: [] });
    const vm = buildHarnessPromptApplyReadinessVM(report);
    expect(vm.findings.some((f) => f.severityLabel === "주의")).toBe(true);
  });

  it("formats average lengths or ㅡ when 0", () => {
    const stable = evaluateHarnessPromptApplyReadiness({
      entries: Array.from({ length: 3 }, () => ({
        harnessPromptAssemblyPreview: preview({}),
        harnessPromptPreviewDiff: diff({ existingPromptLength: 1234, previewLength: 567 }),
      })),
    });
    const vm = buildHarnessPromptApplyReadinessVM(stable);
    expect(vm.averageExistingPromptLengthLabel).toContain("자");
    expect(vm.averagePreviewLengthLabel).toContain("자");

    const empty = evaluateHarnessPromptApplyReadiness({ entries: [] });
    const vmEmpty = buildHarnessPromptApplyReadinessVM(empty);
    expect(vmEmpty.averageExistingPromptLengthLabel).toBe("ㅡ");
  });
});
