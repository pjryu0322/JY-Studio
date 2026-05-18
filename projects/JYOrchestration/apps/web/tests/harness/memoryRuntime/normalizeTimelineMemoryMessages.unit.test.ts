import { describe, expect, it } from "vitest";

import { normalizeTimelineMemoryMessages } from "@/lib/harness/memoryRuntime/internal/timelineMemoryInputs";

describe("normalizeTimelineMemoryMessages", () => {
  it("returns empty for empty/null inputs", () => {
    expect(normalizeTimelineMemoryMessages([])).toEqual([]);
    expect(normalizeTimelineMemoryMessages(undefined)).toEqual([]);
    expect(normalizeTimelineMemoryMessages([null, undefined])).toEqual([]);
  });

  it("drops noise / short / status-only messages", () => {
    const out = normalizeTimelineMemoryMessages([
      "SUCCESS",
      "OK",
      "undefined",
      "null",
      "{}",
      "[]",
      "[object Object]",
      "HTTP 200",
      "hi",
      "valid memory message text",
    ]);
    expect(out).toEqual(["valid memory message text"]);
  });

  it("dedupes identical messages (case insensitive)", () => {
    const out = normalizeTimelineMemoryMessages([
      "We need microservice architecture review",
      "we need microservice architecture review",
      "We need microservice architecture review",
    ]);
    expect(out).toEqual(["We need microservice architecture review"]);
  });

  it("preserves Korean messages above the min length", () => {
    const out = normalizeTimelineMemoryMessages([
      "짧음",
      "안녕하세요 메모리 테스트 문장입니다",
      "사용자가 마이크로서비스 아키텍처 변경을 요청했습니다",
    ]);
    expect(out).toEqual([
      "안녕하세요 메모리 테스트 문장입니다",
      "사용자가 마이크로서비스 아키텍처 변경을 요청했습니다",
    ]);
  });

  it("collapses internal whitespace", () => {
    const out = normalizeTimelineMemoryMessages(["  multiple   spaces   here please  "]);
    expect(out).toEqual(["multiple spaces here please"]);
  });

  it("preserves insertion order of accepted messages", () => {
    const out = normalizeTimelineMemoryMessages([
      "first valid message body",
      "OK",
      "second valid message body",
      "third valid message body",
    ]);
    expect(out).toEqual([
      "first valid message body",
      "second valid message body",
      "third valid message body",
    ]);
  });
});
