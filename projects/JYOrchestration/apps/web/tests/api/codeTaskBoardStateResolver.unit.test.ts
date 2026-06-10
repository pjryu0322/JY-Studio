import { describe, expect, it } from "vitest";
import { resolveCodeTaskBoardState } from "@/lib/prototype/implementationCodeTaskBoardState";

describe("resolveCodeTaskBoardState", () => {
  it("marks 대기 + 실행 가능 as runnable for user", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DATA-SAMPLE-001",
      title: "샘플 데이터 생성 · 샘플 데이터 구현",
      statusLabel: "대기",
      progressLabel: "실행 가능",
      githubOutcomeSaved: false,
    });
    expect(state.isRunnableForUser).toBe(true);
    expect(state.checkboxDisabled).toBe(false);
    expect(state.isIntegrationReady).toBe(false);
  });

  it("marks completed outcome as not runnable but integration ready", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-001",
      title: "Task",
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      githubOutcomeSaved: true,
      commitSha: "abc123",
      branchName: "wip/feature",
    });
    expect(state.isRunnableForUser).toBe(false);
    expect(state.isIntegrationReady).toBe(true);
    expect(state.checkboxDisabledReason).toContain("통합 시 자동 포함");
  });

  it("marks running as not runnable", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-002",
      title: "Task",
      statusLabel: "실행 중",
      progressLabel: "실행 중",
      githubOutcomeSaved: false,
    });
    expect(state.isRunnableForUser).toBe(false);
  });

  it("marks blocked as not runnable", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-003",
      title: "Task",
      statusLabel: "차단됨",
      progressLabel: "의존 작업 대기",
      githubOutcomeSaved: false,
    });
    expect(state.isRunnableForUser).toBe(false);
    expect(state.isBlocked).toBe(true);
  });
});
