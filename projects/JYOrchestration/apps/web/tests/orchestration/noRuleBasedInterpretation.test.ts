import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildMinimalPreviewFeedbackFallback } from "@/lib/prototype/implementationPreviewFeedbackTypes";

describe("no rule-based preview feedback interpretation in product path", () => {
  it("implementationWorkingQueuePreviewFeedback has no regex heuristics", () => {
    const path = resolve(
      process.cwd(),
      "src/lib/prototype/implementationWorkingQueuePreviewFeedback.ts",
    );
    const src = readFileSync(path, "utf8");
    expect(src).not.toMatch(/\/.*\/\.test\(/);
    expect(src).not.toMatch(/buildPreviewFeedbackQueueDescription/);
    expect(src).not.toMatch(/inferPreviewFeedbackTargetLine/);
  });

  it("operational send uses LLM client for preview path", () => {
    const path = resolve(
      process.cwd(),
      "src/lib/prototype/implementationWorkingQueueOperationalSend.ts",
    );
    const src = readFileSync(path, "utf8");
    expect(src).toContain("postImplementationPreviewFeedbackAnalyze");
    expect(src).toContain("postImplementationWorkingQueueIntentResolve");
    expect(src).not.toContain("isImplementationSupplementRequest");
    expect(src).not.toContain("parseWorkingQueueControlIntent");
    expect(src).not.toContain("implementationWorkingQueueApprovalIntent");
    const exportFn = src.slice(src.indexOf("export async function resolveImplementationWorkingQueueOperationalSend"));
    expect(exportFn.indexOf("hasPreviewRegionCaptureAttachment")).toBeLessThan(
      exportFn.indexOf("shouldHandleImplementationWorkingQueueChat"),
    );
  });

  it("service supplement helper does not call keyword classifier", () => {
    const path = resolve(process.cwd(), "src/lib/prototype/implementationWorkingQueueService.ts");
    const src = readFileSync(path, "utf8");
    expect(src).not.toContain("inferWorkingQueueAffectedArea");
    expect(src).not.toContain("inferWorkingQueueRiskLevel");
  });

  it("LLM failure fallback preserves user text only", () => {
    const fb = buildMinimalPreviewFeedbackFallback("스크립트 탭에 클릭이벤트를 적용해줘");
    expect(fb.title).toBe("Preview 캡처 기반 보완요청");
    expect(fb.description).toContain("클릭");
    expect(fb.affectedArea).toBe("unknown");
    expect(fb.riskLevel).toBe("medium");
  });
});
