import { describe, expect, it } from "vitest";
import { dedupeSentences, normalizeQuestionSentence, sentencesOverlap } from "@/lib/requirements/serviceFlowMessageDedupe";
import { mergeServiceFlowUserFacingMessage } from "@/lib/requirements/serviceFlowAnalyzeValidation";

describe("serviceFlowMessageDedupe", () => {
  it("normalizeQuestionSentence — 다음: 접두·물음표 제거", () => {
    expect(normalizeQuestionSentence("다음: 액터를 설명해주세요?")).toBe("액터를 설명해주세요");
  });

  it("sentencesOverlap — 동일 질문", () => {
    expect(sentencesOverlap("액터를 설명해주세요", "다음: 액터를 설명해주세요?")).toBe(true);
  });

  it("mergeServiceFlowUserFacingMessage — assistant+nextQuestion 중복 제거", () => {
    const merged = mergeServiceFlowUserFacingMessage(
      "다음: 액터를 설명해주세요",
      "액터를 설명해주세요",
    );
    expect(merged).not.toMatch(/액터를 설명해주세요[\s\S]*액터를 설명해주세요/);
    expect(merged.split("액터를 설명해주세요").length - 1).toBeLessThanOrEqual(1);
  });

  it("dedupeSentences — 중복 라인 제거", () => {
    expect(dedupeSentences(["다음: A", "A", "B"])).toEqual(["다음: A", "B"]);
  });
});
