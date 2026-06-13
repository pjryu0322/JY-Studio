import { describe, expect, it } from "vitest";
import {
  coalesceCodeTaskBoardRowDisplayLabels,
  resolveCodeTaskBoardState,
} from "@/lib/prototype/implementationCodeTaskBoardState";

describe("coalesceCodeTaskBoardRowDisplayLabels", () => {
  it("overrides stale completed unit labels when row is visibly waiting", () => {
    const labels = coalesceCodeTaskBoardRowDisplayLabels({
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      collapsedSummary: "대기",
      promptReadyPhase: true,
      rowStatusLabel: "대기",
      rowProgressLabel: "실행 가능",
    });
    expect(labels).toEqual({ statusLabel: "대기", progressLabel: "실행 가능" });
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DATA-SAMPLE-001",
      title: "샘플 데이터 생성",
      ...labels,
      githubOutcomeSaved: true,
      commitSha: "abc",
      branchName: "wip/data/sample-data",
    });
    expect(state.isRunnableForUser).toBe(false);
    expect(state.isCompleted).toBe(true);
    expect(state.isIntegrationReady).toBe(true);
    expect(state.checkboxDisabled).toBe(true);
    expect(state.progressLabel).toBe("GitHub commit 확인됨");
  });

  it("locks completed display when completion evidence is present", () => {
    const labels = coalesceCodeTaskBoardRowDisplayLabels({
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      collapsedSummary: "대기",
      rowStatusLabel: "대기",
      rowProgressLabel: "실행 가능",
      completionEvidenceLocked: true,
    });
    expect(labels).toEqual({ statusLabel: "완료", progressLabel: "GitHub outcome 저장됨" });
  });

  it("overrides stale completed labels when row view still shows waiting", () => {
    const labels = coalesceCodeTaskBoardRowDisplayLabels({
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      collapsedSummary: "완료",
      rowStatusLabel: "대기",
      rowProgressLabel: "실행 가능",
      rowCollapsedSummary: "대기",
    });
    expect(labels).toEqual({ statusLabel: "대기", progressLabel: "실행 가능" });
  });

  it("fills 대기/실행 가능 when snapshot labels are empty but collapsed summary is 대기", () => {
    const labels = coalesceCodeTaskBoardRowDisplayLabels({
      statusLabel: "",
      progressLabel: "",
      collapsedSummary: "대기",
      promptReadyPhase: true,
      rowStatusLabel: "",
      rowProgressLabel: "",
    });
    expect(labels).toEqual({ statusLabel: "대기", progressLabel: "실행 가능" });
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DATA-SAMPLE-001",
      title: "샘플 데이터 생성",
      ...labels,
      githubOutcomeSaved: false,
      branchName: "wip/data/sample-data",
    });
    expect(state.isRunnableForUser).toBe(true);
    expect(state.checkboxDisabled).toBe(false);
  });
});

describe("resolveCodeTaskBoardState", () => {
  it("treats 대기 with empty progress as runnable", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DATA-SAMPLE-001",
      title: "샘플 데이터 생성",
      statusLabel: "대기",
      progressLabel: "",
      githubOutcomeSaved: false,
    });
    expect(state.isRunnableForUser).toBe(true);
  });

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
    expect(state.isCompleted).toBe(false);
  });

  it("keeps github outcome tasks non-runnable even when row labels look waiting", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DATA-SAMPLE-001",
      title: "샘플 데이터 생성 · 샘플 데이터 구현",
      statusLabel: "대기",
      progressLabel: "실행 가능",
      githubOutcomeSaved: true,
      branchName: "wip/data/sample-data",
      commitSha: "abc123",
    });
    expect(state.isRunnableForUser).toBe(false);
    expect(state.checkboxDisabled).toBe(true);
    expect(state.isCompleted).toBe(true);
    expect(state.isIntegrationReady).toBe(true);
  });

  it("forbids 완료 + 실행 가능 display combination", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DATA-SAMPLE-001",
      title: "샘플",
      statusLabel: "완료",
      progressLabel: "실행 가능",
      githubOutcomeSaved: true,
      commitSha: "abc",
    });
    expect(state.isRunnableForUser).toBe(false);
    expect(state.progressLabel).toBe("GitHub commit 확인됨");
  });

  it("marks completed github outcome tasks as integration ready", () => {
    const state = resolveCodeTaskBoardState({
      codeTaskId: "CODE-DEV-SCREEN-001",
      title: "화면 프레임 구성",
      statusLabel: "완료",
      progressLabel: "GitHub outcome 저장됨",
      githubOutcomeSaved: true,
      commitSha: "abc123",
    });
    expect(state.isRunnableForUser).toBe(false);
    expect(state.checkboxDisabled).toBe(true);
    expect(state.isIntegrationReady).toBe(true);
    expect(state.checkboxDisabledReason).toBe("completed");
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
