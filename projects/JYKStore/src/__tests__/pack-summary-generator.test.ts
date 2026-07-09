import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveShortDescription } from "../lib/pack-summary-generator.ts";

describe("deriveShortDescription", () => {
  it("uses the first sentence from description", () => {
    const summary = deriveShortDescription({
      name: "TOAST UI Grid",
      description: "A powerful data grid for web apps. It supports sorting and filtering.",
    });
    assert.equal(summary, "A powerful data grid for web apps.");
  });

  it("normalizes line breaks and extra spaces", () => {
    const summary = deriveShortDescription({
      name: "Sample Pack",
      description: "첫 줄 요약입니다.\n\n두 번째 줄은 무시됩니다.",
    });
    assert.equal(summary, "첫 줄 요약입니다.");
  });

  it("falls back when description is too short", () => {
    const summary = deriveShortDescription({
      name: "카카오 인증",
      description: "짧음",
    });
    assert.equal(summary, "카카오 인증 관련 제품·솔루션 지식팩입니다.");
    assert.ok(summary.length >= 10 && summary.length <= 160);
  });

  it("truncates long text within 160 characters", () => {
    const long = "가".repeat(200);
    const summary = deriveShortDescription({
      name: "Long Pack",
      description: long,
    });
    assert.ok(summary.length <= 160);
    assert.ok(summary.length >= 10);
  });
});
