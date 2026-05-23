import { describe, expect, it } from "vitest";
import { sanitizeUnsupportedFuturePromise } from "@/lib/conversation-core/futurePromiseGuard";

describe("sanitizeUnsupportedFuturePromise", () => {
  it("removes unsupported future promise closing phrases", () => {
    expect(
      sanitizeUnsupportedFuturePromise("본문\n\n다음에는 제가 비교안/초안/정리안을 만들겠습니다.")
    ).toBe("본문");

    expect(
      sanitizeUnsupportedFuturePromise("본문\n프로젝트 승격 또는 초안 JSON 준비를 위한 다음 행동을 진행하겠습니다.")
    ).toBe("본문");
  });

  it("does not remove actual comparison content", () => {
    const text = "비교안\nA안: 빠른 MVP\nB안: 확장형";
    expect(sanitizeUnsupportedFuturePromise(text)).toBe(text);
  });
});
