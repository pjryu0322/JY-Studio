import { describe, expect, it } from "vitest";
import { detectImplementationActionAlias } from "@/lib/prototype/implementationActionAliasGuard";

describe("detectImplementationActionAlias", () => {
  it("maps short work plan chip labels", () => {
    expect(detectImplementationActionAlias({ text: "구현 작업안 생성" })).toBe("CREATE_WORK_PLAN");
    expect(detectImplementationActionAlias({ text: "작업계획 생성" })).toBe("CREATE_WORK_PLAN");
    expect(detectImplementationActionAlias({ text: "구현 작업안 초안 생성해줘" })).toBe("CREATE_WORK_PLAN");
  });

  it("skips alias when defer-before-create phrasing is present", () => {
    expect(detectImplementationActionAlias({ text: "작업안 생성 전에 검토해 줘" })).toBeNull();
  });

  it("skips question-like alias phrases", () => {
    expect(detectImplementationActionAlias({ text: "작업계획 생성 방법 알려줘" })).toBeNull();
    expect(detectImplementationActionAlias({ text: "구현 작업안 생성 기준 설명해줘" })).toBeNull();
    expect(detectImplementationActionAlias({ text: "구현 작업안 생성 가능해?" })).toBeNull();
  });

  it("maps visible chip labels from bootstrap", () => {
    expect(
      detectImplementationActionAlias({
        text: "SCM 점검 결과",
        visibleActionLabels: ["SCM 점검 결과", "환경설정 점검 결과"],
      }),
    ).toBe("SHOW_SCM_CHECK");
  });
});
