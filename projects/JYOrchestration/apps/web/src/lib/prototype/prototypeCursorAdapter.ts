/**
 * Cursor Cloud Agent — 프로토타입 전용 경계. ENV_TEST 오케스트레이션과 분리.
 */

import { launchCursorAgent, type ExecutionSetupRelaySlice } from "@/lib/execution/cursorExecutionAdapter";

export type RequestCursorPrototypeInput = Readonly<{
  projectId: string;
  executionSetup: ExecutionSetupRelaySlice;
  runId: string;
  branchName: string;
  promptSnapshot: string;
  selectedTemplate: string;
  plannerTasks?: ReadonlyArray<{ order: number; title: string }>;
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

  const plannerBlock =
    input.plannerTasks && input.plannerTasks.length
      ? `\n\nAI Planner task packages (execute in order, report progress in summary):\n${input.plannerTasks
          .map((t) => `- Task ${t.order}. ${t.title}`)
          .join("\n")}\n`
      : "";
  const prompt = `${input.promptSnapshot}${plannerBlock}`.trim();

  const launch = await launchCursorAgent({
    projectId: input.projectId,
    workflowId: null,
    executionSetup: input.executionSetup,
    task: {
      id: `prototype:${input.runId}`,
      title: "Prototype generation (workspace)",
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
