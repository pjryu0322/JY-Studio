import { describe, expect, it } from "vitest";

import { buildHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/buildHarnessPromptAssemblyPreview";
import { compareHarnessPromptPreview } from "@/lib/harness/promptAssembly/compareHarnessPromptPreview";
import { emptyHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";

describe("compareHarnessPromptPreview", () => {
  it("computes existingPromptLength / previewLength", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      userRequest: "사용자 요청 텍스트입니다",
      overlayIdentity: {
        roleKey: "planner",
        perspective: "system",
        provider: "openai",
        capabilities: ["plan"],
      },
    });
    const diff = compareHarnessPromptPreview({
      existingPromptText: "기존 프롬프트 본문 예시",
      preview,
    });
    expect(diff.existingPromptLength).toBe("기존 프롬프트 본문 예시".length);
    expect(diff.previewLength).toBeGreaterThan(0);
    expect(diff.sectionCount).toBe(preview.sections.length);
  });

  it("detects missing standard section types", () => {
    const preview = emptyHarnessPromptAssemblyPreview();
    const diff = compareHarnessPromptPreview({ existingPromptText: "hi", preview });
    expect(diff.missingSectionTypes.length).toBeGreaterThanOrEqual(1);
    expect(diff.missingSectionTypes).toContain("role_contract");
    expect(diff.warnings.some((w) => w.includes("누락"))).toBe(true);
  });

  it("does not flag missing when all standard sections present", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      overlayIdentity: {
        roleKey: "r",
        perspective: "p",
        provider: "openai",
        capabilities: [],
      },
      overlayAssemblyPlan: [
        { type: "memory", source: "m", priority: 0, includeReason: "x", estimatedCost: 10, pruningCandidate: false, includeMode: "required" },
        { type: "knowledge", source: "k", priority: 0, includeReason: "x", estimatedCost: 10, pruningCandidate: false, includeMode: "required" },
        { type: "workspace", source: "w", priority: 0, includeReason: "x", estimatedCost: 10, pruningCandidate: false, includeMode: "required" },
      ],
      userRequest: "request body",
    });
    const diff = compareHarnessPromptPreview({ existingPromptText: "x".repeat(500), preview });
    expect(diff.missingSectionTypes).toEqual([]);
  });

  it("emits length-delta warning when preview is much larger/smaller than existing", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      userRequest: "x".repeat(800),
      overlayIdentity: {
        roleKey: "r",
        perspective: "p",
        provider: "openai",
        capabilities: [],
      },
    });
    const diffSmall = compareHarnessPromptPreview({ existingPromptText: "tiny", preview });
    expect(diffSmall.warnings.some((w) => w.includes("길이가 큰 폭"))).toBe(true);
  });

  it("handles null existing prompt gracefully", () => {
    const preview = emptyHarnessPromptAssemblyPreview();
    const diff = compareHarnessPromptPreview({ existingPromptText: null, preview });
    expect(diff.existingPromptLength).toBe(0);
    expect(diff.previewLength).toBe(0);
  });
});
