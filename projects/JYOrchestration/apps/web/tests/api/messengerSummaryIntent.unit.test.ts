import { describe, expect, it } from "vitest";
import { formatMessengerAiSummaryBlock, isMessengerSummaryRequest } from "@/lib/messenger/messengerSummaryIntent";

describe("isMessengerSummaryRequest", () => {
  it("detects summary chat requests", () => {
    expect(isMessengerSummaryRequest("요약해줘")).toBe(true);
    expect(isMessengerSummaryRequest("AI요약 정리해줘")).toBe(true);
    expect(isMessengerSummaryRequest("지금까지 정리해줘")).toBe(true);
    expect(isMessengerSummaryRequest("대화 요약해줘")).toBe(true);
    expect(isMessengerSummaryRequest("회의록처럼 정리해줘")).toBe(true);
  });

  it("does not match normal brainstorm utterances", () => {
    expect(isMessengerSummaryRequest("녹취파일 변환 방법이 고민이야")).toBe(false);
    expect(isMessengerSummaryRequest("")).toBe(false);
  });
});

describe("formatMessengerAiSummaryBlock", () => {
  it("wraps summary with fixed heading", () => {
    expect(formatMessengerAiSummaryBlock("현재 아이디어\n- A")).toBe("【AI 요약 정리】\n\n현재 아이디어\n- A");
  });
});
