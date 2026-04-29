/**
 * Cursor Cloud Agent — 프로토타입 전용 경계. ENV_TEST 오케스트레이션과 분리.
 */

import { launchCursorAgent, type ExecutionSetupRelaySlice } from "@/lib/execution/cursorExecutionAdapter";

export type RequestCursorPrototypeInput = Readonly<{
  projectId: string;
  executionSetup: ExecutionSetupRelaySlice;
  runId: string;
  branchName: string;
  /** WorkUnit 전용 Cursor 프롬프트(전역 기획 스냅샷과 분리). */
  cursorPrompt: string;
  selectedTemplate: string;
  /** 이번 Cursor 실행에서 완료해야 할 단일 WorkUnit(다른 유닛은 요청하지 않음). */
  workUnit: Readonly<{ order: number; title: string }>;
}>;

export type RequestCursorPrototypeResult =
  | { readonly supported: true; readonly cursorRunId: string }
  | { readonly supported: false; readonly reason: "CURSOR_NOT_CONNECTED" | "CURSOR_LAUNCH_FAILED"; readonly message: string };

/**
 * Cursor API 로 프로토타입 에이전트를 시작합니다. 성공을 가장하지 않습니다.
 */
export async function requestCursorPrototypeRun(input: RequestCursorPrototypeInput): Promise<RequestCursorPrototypeResult> {
  const apiKey = String(input.executionSetup.cursorApiToken ?? "").trim();
  if (!apiKey) {
    return { supported: false, reason: "CURSOR_NOT_CONNECTED", message: "Cursor API 키가 없습니다." };
  }

  const prompt = `${input.cursorPrompt}\n\n=== 실행 메타 ===\nWorkUnit #${input.workUnit.order}: ${input.workUnit.title}\n템플릿: ${input.selectedTemplate}\n`.trim();

  const launch = await launchCursorAgent({
    projectId: input.projectId,
    workflowId: null,
    executionSetup: input.executionSetup,
    task: {
      id: `prototype:${input.runId}:wu:${input.workUnit.order}`,
      title: `Prototype WU${input.workUnit.order}: ${input.workUnit.title}`,
      description: `Template: ${input.selectedTemplate}`,
      acceptanceCriteria: [],
    },
    suggestedBranchName: input.branchName,
    prompt,
    allowedPaths: undefined,
  });

  if (!launch.ok) {
    return {
      supported: false,
      reason: "CURSOR_LAUNCH_FAILED",
      message: launch.error,
    };
  }

  return { supported: true, cursorRunId: launch.agentId };
}
