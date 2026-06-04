import { describe, expect, it } from "vitest";
import {
  buildImplementationStatusToastDedupeKey,
  isRoutineImplementationStatusChatContent,
  shouldSuppressImplementationStatusMessage,
} from "@/lib/prototype/implementationStatusChatPolicy";

describe("implementationStatusChatPolicy", () => {
  it("suppresses repeated GitHub verify failure chat content", () => {
    expect(
      shouldSuppressImplementationStatusMessage({
        content: "GitHub commit 확인 실패",
      }),
    ).toBe(true);
    expect(isRoutineImplementationStatusChatContent("AI 개발자 · GitHub commit 확인 실패")).toBe(
      true,
    );
  });

  it("suppresses auto quality gate passed routine message", () => {
    const content = "검수 자동 점검이 완료되었습니다.\n다음 작업";
    expect(shouldSuppressImplementationStatusMessage({ content })).toBe(true);
  });

  it("dedupes github verify toast key", () => {
    expect(buildImplementationStatusToastDedupeKey("GitHub commit 확인 실패")).toBe(
      "toast:github_commit_verify",
    );
  });

  it("allows user-facing blocking errors", () => {
    expect(
      shouldSuppressImplementationStatusMessage({
        content: "환경설정에서 Cursor API 토큰이 없어 실행할 수 없습니다.",
      }),
    ).toBe(false);
  });
});
