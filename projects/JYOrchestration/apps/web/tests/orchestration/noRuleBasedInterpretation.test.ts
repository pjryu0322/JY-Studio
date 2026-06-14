import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  });
});
