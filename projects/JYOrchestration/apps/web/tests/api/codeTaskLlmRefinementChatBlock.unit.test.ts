import { describe, expect, it } from "vitest";
import {
  isCodeTaskTotalCountSummaryLine,
  splitMessageContentForCodeTaskLlmRefinementBlock,
} from "@/lib/requirements/codeTaskLlmRefinementChatBlock";

describe("codeTaskLlmRefinementChatBlock", () => {
  it("detects total line", () => {
    expect(isCodeTaskTotalCountSummaryLine("- 전체 CodeTask: 15개")).toBe(true);
    expect(isCodeTaskTotalCountSummaryLine("- LLM 정제: 15개")).toBe(false);
  });

  it("splits message around CodeTask LLM refinement block", () => {
    const content = [
      "**구현 준비 완료**",
      "",
      "CodeTask LLM 정제:",
      "- 전체 CodeTask: 15개",
      "- LLM 정제: 15개",
      "- 상태: LLM 정제 완료",
      "",
      "구현 작업목록:",
      "- developer: 3",
      "",
      "다음 작업을 선택해 주세요.",
    ].join("\n");
    const parts = splitMessageContentForCodeTaskLlmRefinementBlock(content);
    expect(parts).not.toBeNull();
    expect(parts!.lines).toContain("- 전체 CodeTask: 15개");
    expect(parts!.suffix).toContain("구현 작업목록:");
  });

  it("splits quick-design implementation-ready style message (proposal-first layout)", () => {
    const content = [
      "**구현 준비 완료**",
      "",
      "구현 준비가 완료되었습니다.",
      "",
      "생성된 산출물:",
      "- 프로젝트 요약서",
      "",
      "구현 준비정보:",
      "구현준비 완료",
      "",
      "CodeTask LLM 정제:",
      "- 전체 CodeTask: 15개",
      "- LLM 정제: 15개",
      "- 상태: LLM 정제 완료",
      "",
      "구현 작업목록:",
      "- developer: 15",
      "",
      "다음 작업을 선택해 주세요.",
    ].join("\n");
    const parts = splitMessageContentForCodeTaskLlmRefinementBlock(content);
    expect(parts).not.toBeNull();
    expect(parts!.lines.some((l) => l.includes("전체 CodeTask: 15개"))).toBe(true);
  });
});
