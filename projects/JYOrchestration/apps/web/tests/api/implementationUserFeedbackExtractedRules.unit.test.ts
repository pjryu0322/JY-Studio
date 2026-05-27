import { describe, expect, it } from "vitest";
import {
  buildImplementationUserFeedbackPatch,
  normalizeAndDedupeImplementationExtractedRules,
} from "@/lib/prototype/implementationUserFeedback";

describe("normalizeAndDedupeImplementationExtractedRules", () => {
  it("drops empty label/value and normalizes confidence", () => {
    const out = normalizeAndDedupeImplementationExtractedRules([
      { label: "  ", value: "x", confidence: "high" },
      { label: "허용 파일", value: "mp3", confidence: "invalid" as "high" },
      { label: "허용 파일", value: "mp3", confidence: "high" },
    ]);
    expect(out).toEqual([{ label: "허용 파일", value: "mp3", confidence: "medium" }]);
  });
});

describe("buildImplementationUserFeedbackPatch extractedRulesOverride", () => {
  it("uses override rules in patch", () => {
    const patch = buildImplementationUserFeedbackPatch({
      text: "업로드 파일은 mp3, wav만 허용하고 임시파일은 처리 후 삭제해줘",
      sourceMessageId: "msg-1",
      extractedRulesOverride: [
        { label: "허용 파일 형식", value: "mp3, wav", confidence: "high" },
        { label: "임시파일 처리", value: "처리 후 삭제", confidence: "high" },
      ],
    });
    expect(patch.extractedRules).toEqual([
      { label: "허용 파일 형식", value: "mp3, wav", confidence: "high" },
      { label: "임시파일 처리", value: "처리 후 삭제", confidence: "high" },
    ]);
  });
});
