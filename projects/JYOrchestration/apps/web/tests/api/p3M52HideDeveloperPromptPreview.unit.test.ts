import { describe, expect, it } from "vitest";
import {
  formatDeveloperPromptAllSelectedCopySuccessToast,
  formatDeveloperPromptHeaderCopySuccessToast,
} from "@/lib/prototype/codeTaskDeveloperPromptBundle";
import { SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW } from "@/lib/prototype/implementationDeveloperPromptPreviewUi";

describe("P3-M52 developer prompt preview and copy toasts", () => {
  it("hides stage-two preview by default", () => {
    expect(SHOW_STAGE_TWO_DEVELOPER_PROMPT_PREVIEW).toBe(false);
  });

  it("formats all-selected bundle copy toast", () => {
    const msg = formatDeveloperPromptAllSelectedCopySuccessToast(16);
    expect(msg).toContain("전체 CodeTask 16개");
    expect(msg).toContain("개별 실행");
  });

  it("formats header copy for current execution target when nothing selected", () => {
    expect(
      formatDeveloperPromptHeaderCopySuccessToast({
        count: 1,
        selectedCodeTaskIds: [],
        totalCodeTaskCount: 16,
      }),
    ).toBe("현재 CodeTask 개발 프롬프트를 복사했습니다.");
  });

  it("formats header copy for single selected CodeTask", () => {
    expect(
      formatDeveloperPromptHeaderCopySuccessToast({
        count: 1,
        selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
        totalCodeTaskCount: 16,
      }),
    ).toBe("CODE-DEV-FRAME-001-001 개발 프롬프트를 복사했습니다.");
  });

  it("formats header copy for partial multi-select", () => {
    const msg = formatDeveloperPromptHeaderCopySuccessToast({
      count: 3,
      selectedCodeTaskIds: ["a", "b", "c"],
      totalCodeTaskCount: 16,
    });
    expect(msg).toContain("선택한 CodeTask 3개");
  });

  it("formats header copy for full select-all", () => {
    const ids = Array.from({ length: 5 }, (_, i) => `CODE-${i}`);
    const msg = formatDeveloperPromptHeaderCopySuccessToast({
      count: 5,
      selectedCodeTaskIds: ids,
      totalCodeTaskCount: 5,
    });
    expect(msg).toContain("전체 CodeTask 5개");
  });
});
