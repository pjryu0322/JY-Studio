import { describe, expect, it } from "vitest";
import {
  isCodeAgentWipExecutionActive,
  resolvePrototypeExecutionActivityStatus,
  resolvePrototypeRunActivityLabel,
} from "@/lib/prototype/prototypeExecutionActivityStatus";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";

function wip(partial: Partial<CodeAgentWipExecutionV1>): CodeAgentWipExecutionV1 {
  return {
    version: "code_agent_wip_execution_v1",
    projectId: "p1",
    branchName: "wip/test",
    requestedAt: "2026-01-01T00:00:00.000Z",
    provider: "cursor",
    status: "requested",
    commits: [],
    refactorRequests: [],
    ...partial,
  };
}

describe("prototypeExecutionActivityStatus", () => {
  it("returns idle when nothing is in progress", () => {
    expect(
      resolvePrototypeExecutionActivityStatus({
        implementationResetBusy: false,
        executionAiSummaryBusy: false,
        plannerCreatePending: false,
        isPlannerRunning: false,
        isRunningState: false,
        protoBusy: false,
        executionEnvLoading: false,
        conversationLoading: false,
        aiInvokePending: false,
      }),
    ).toEqual({ active: false, label: "" });
  });

  it("prioritizes reset over other busy flags", () => {
    expect(
      resolvePrototypeExecutionActivityStatus({
        implementationResetBusy: true,
        executionAiSummaryBusy: true,
        plannerCreatePending: true,
        isPlannerRunning: true,
        isRunningState: true,
        protoBusy: true,
        executionEnvLoading: true,
        conversationLoading: true,
        aiInvokePending: true,
      }),
    ).toEqual({ active: true, label: "구현 세션 초기화 중" });
  });

  it("shows planner progress step detail", () => {
    expect(
      resolvePrototypeExecutionActivityStatus({
        implementationResetBusy: false,
        executionAiSummaryBusy: false,
        plannerCreatePending: false,
        isPlannerRunning: true,
        plannerProgressStep: 3,
        isRunningState: false,
        protoBusy: false,
        executionEnvLoading: false,
        conversationLoading: false,
        aiInvokePending: false,
      }),
    ).toEqual({
      active: true,
      label: "AI 플래너 작업계획 생성 중",
      detail: "3/5 단계",
    });
  });

  it("maps prototype run statuses to user-facing labels", () => {
    expect(resolvePrototypeRunActivityLabel("CURSOR_RUNNING")).toBe("Cursor 코드 생성 중");
    expect(resolvePrototypeRunActivityLabel("DEPLOYING")).toBe("배포 진행 중");
  });

  it("detects active code agent wip execution", () => {
    expect(isCodeAgentWipExecutionActive(wip({ status: "drafting" }))).toBe(true);
    expect(isCodeAgentWipExecutionActive(wip({ status: "developer_approved" }))).toBe(false);
    expect(
      isCodeAgentWipExecutionActive(
        wip({ status: "developer_approved", bridgeExecutionStatus: "bridge_running" }),
      ),
    ).toBe(true);
  });

  it("shows wip bridge running label with task detail", () => {
    expect(
      resolvePrototypeExecutionActivityStatus({
        implementationResetBusy: false,
        executionAiSummaryBusy: false,
        plannerCreatePending: false,
        isPlannerRunning: false,
        isRunningState: false,
        protoBusy: false,
        executionEnvLoading: false,
        conversationLoading: false,
        aiInvokePending: false,
        codeAgentWipExecutionV1: wip({
          status: "developer_approved",
          bridgeExecutionStatus: "bridge_running",
          selectedTaskId: "task-1",
        }),
      }),
    ).toEqual({
      active: true,
      label: "Cursor 실행 중",
      detail: "Task task-1",
    });
  });
});
