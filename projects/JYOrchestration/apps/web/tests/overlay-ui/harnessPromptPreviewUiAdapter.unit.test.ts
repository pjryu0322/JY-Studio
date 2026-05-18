import { describe, expect, it } from "vitest";

import { buildHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/buildHarnessPromptAssemblyPreview";
import { compareHarnessPromptPreview } from "@/lib/harness/promptAssembly/compareHarnessPromptPreview";
import { emptyHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import {
  HARNESS_PROMPT_PREVIEW_DISCLAIMER,
  buildHarnessPromptPreviewVM,
  harnessPromptSectionTypeLabel,
} from "@/lib/overlay-ui/harnessPromptPreviewUiAdapter";

describe("harnessPromptPreviewUiAdapter", () => {
  it("exposes Korean section type labels", () => {
    expect(harnessPromptSectionTypeLabel("role_contract")).toBe("역할 계약");
    expect(harnessPromptSectionTypeLabel("memory_context")).toBe("기억 맥락");
    expect(harnessPromptSectionTypeLabel("knowledge_context")).toBe("지식 맥락");
    expect(harnessPromptSectionTypeLabel("current_request")).toBe("현재 요청");
  });

  it("returns hasData=false on null preview and surfaces disclaimer", () => {
    const vm = buildHarnessPromptPreviewVM({ preview: null });
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(HARNESS_PROMPT_PREVIEW_DISCLAIMER);
    expect(vm.disclaimer).toContain("실제 LLM 호출에 사용된 프롬프트가 아니라");
    expect(vm.modeLabel).toBe("dry-run");
  });

  it("returns hasData=false for empty preview (no sections)", () => {
    const empty = emptyHarnessPromptAssemblyPreview("none");
    const vm = buildHarnessPromptPreviewVM({ preview: empty });
    expect(vm.hasData).toBe(false);
    expect(vm.warnings).toContain("none");
  });

  it("builds section rows with Korean labels and overflow risk badge", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      overlayIdentity: {
        roleKey: "planner",
        perspective: "system",
        provider: "openai",
        capabilities: ["plan"],
      },
      overlayContextBudget: {
        estimatedInputTokens: 5000,
        estimatedOutputTokens: 500,
        budgetPolicy: "extended",
        overflowRisk: "high",
      },
      userRequest: "사용자 입력",
    });
    const vm = buildHarnessPromptPreviewVM({ preview });
    expect(vm.hasData).toBe(true);
    expect(vm.overflowRiskLabel).toBe("높음");
    expect(vm.overflowRiskTone).toBe("warning");
    const roleRow = vm.sectionRows.find((r) => r.type === "role_contract");
    expect(roleRow?.typeLabel).toBe("역할 계약");
    expect(roleRow?.estimatedCostLabel).toContain("추정 비용 ~");
  });

  it("exposes diff VM with Korean missing/extra labels", () => {
    const preview = emptyHarnessPromptAssemblyPreview();
    const diff = compareHarnessPromptPreview({ existingPromptText: "abc", preview });
    const vm = buildHarnessPromptPreviewVM({ preview, diff });
    expect(vm.diff.hasData).toBe(true);
    expect(vm.diff.existingPromptLengthLabel).toBe("3자");
    expect(vm.diff.previewLengthLabel).toBe("0자");
    expect(vm.diff.missingSectionLabels.some((l) => l === "역할 계약")).toBe(true);
  });

  it("clips long section content into preview snippet", () => {
    const preview = buildHarnessPromptAssemblyPreview({
      userRequest: "사".repeat(2000),
    });
    const vm = buildHarnessPromptPreviewVM({ preview });
    const req = vm.sectionRows.find((r) => r.type === "current_request");
    expect(req).toBeDefined();
    expect(req?.contentPreview.length).toBeLessThanOrEqual(200);
  });
});
