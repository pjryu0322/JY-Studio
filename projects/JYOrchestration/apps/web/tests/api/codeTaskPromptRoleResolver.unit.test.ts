import { describe, expect, it } from "vitest";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";

describe("resolveCodeTaskSpecificRole", () => {
  it("maps retry common feature", () => {
    const r = resolveCodeTaskSpecificRole({ codeTaskTitle: "재시도 공통 기능 구현" });
    expect(r.roleKind).toBe("common_retry");
    expect(r.role).toMatch(/재시도/);
  });

  it("maps error message common feature", () => {
    const r = resolveCodeTaskSpecificRole({ codeTaskTitle: "오류 메시지 공통 기능 구현" });
    expect(r.roleKind).toBe("common_error");
    expect(r.role).toMatch(/오류/);
  });

  it("maps loading state", () => {
    const r = resolveCodeTaskSpecificRole({ codeTaskTitle: "로딩 상태 공통 기능 구현" });
    expect(r.roleKind).toBe("common_loading");
    expect(r.role).toMatch(/진행 상태/);
  });

  it("maps empty result", () => {
    const r = resolveCodeTaskSpecificRole({ codeTaskTitle: "빈 결과 공통 기능 구현" });
    expect(r.roleKind).toBe("common_empty");
  });

  it("maps input screen", () => {
    const r = resolveCodeTaskSpecificRole({
      codeTaskTitle: "입력 화면 화면 구현",
      parentTaskTitle: "입력 화면",
    });
    expect(r.roleKind).toBe("screen_input");
  });

  it("maps result screen", () => {
    const r = resolveCodeTaskSpecificRole({ codeTaskTitle: "결과 화면 화면 구현" });
    expect(r.roleKind).toBe("screen_result");
  });

  it("maps mock data", () => {
    const r = resolveCodeTaskSpecificRole({ codeTaskTitle: "Mock 데이터 구조 정의" });
    expect(r.roleKind).toBe("mock_data");
  });
});
