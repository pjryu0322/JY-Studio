import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { formatCodeTaskExecutionFlowPhaseKo } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { deriveCodeTaskExecutionFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type ImplementationRuntimeStatusBoardPhase =
  | "prompt_building"
  | "prompt_ready"
  | "cursor_running"
  | "github_branch_waiting"
  | "github_commit_verifying"
  | "github_commit_failed"
  | "auto_gate_running"
  | "auto_gate_passed"
  | "rework_required"
  | "completed";

export type ImplementationRuntimeStatusBoardNotice = Readonly<{
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly phase: ImplementationRuntimeStatusBoardPhase;
  readonly label: string;
  readonly reason?: string;
  readonly lastCheckedAt?: string;
  readonly nextAction?: string;
}>;

function mapFlowPhaseToBoardPhase(
  flowPhase: ReturnType<typeof deriveCodeTaskExecutionFlowPhase>,
  run: CodeTaskExecutionRunV1 | null,
  execution: TaskCursorExecutionV1 | null,
): ImplementationRuntimeStatusBoardPhase {
  if (run?.status === "prompt_building") return "prompt_building";
  if (run?.status === "prompt_ready" || flowPhase === "prompt_ready") return "prompt_ready";
  if (flowPhase === "failed" || run?.status === "rework_required") return "rework_required";
  if (flowPhase === "completed") return "completed";
  if (execution?.status === "github_verify_failed") return "github_commit_failed";
  if (flowPhase === "github_verifying" || execution?.status === "github_verifying") {
    return "github_commit_verifying";
  }
  if (flowPhase === "lightweight_checking") return "auto_gate_running";
  if (flowPhase === "github_verified") return "auto_gate_passed";
  if (flowPhase === "cursor_running") {
    const branch = String(execution?.workBranch ?? run?.workBranch ?? "").trim();
    if (branch && !run?.commitSha && !execution?.commitSha) return "github_branch_waiting";
    return "cursor_running";
  }
  return "prompt_ready";
}

export function buildImplementationRuntimeStatusBoardNotice(input: {
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly run?: CodeTaskExecutionRunV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGatePassed?: boolean;
}): ImplementationRuntimeStatusBoardNotice | null {
  const codeTaskId = input.codeTaskId.trim();
  const taskId = input.parentTaskId.trim();
  if (!codeTaskId || !taskId) return null;

  const run = input.run ?? null;
  const execution = input.taskCursorExecution ?? null;
  const flowPhase = deriveCodeTaskExecutionFlowPhase({
    parentTaskId: taskId,
    latestRun: run,
    taskCursorExecution: execution,
    autoGate: input.autoGatePassed
      ? ({ status: "passed", version: "implementation_auto_quality_gate_v1" } as ImplementationAutoQualityGateV1)
      : null,
  });
  const phase = mapFlowPhaseToBoardPhase(flowPhase, run, execution);
  const label = formatCodeTaskExecutionFlowPhaseKo(flowPhase);

  let reason: string | undefined;
  let nextAction: string | undefined;
  if (phase === "github_commit_failed") {
    reason =
      String(execution?.errorMessage ?? run?.errorMessage ?? "").trim() ||
      "작업 브랜치에 유효한 commit이 아직 없습니다.";
    nextAction = "자동 재확인 중";
  } else if (phase === "github_commit_verifying") {
    nextAction = "GitHub commit 확인 중";
  } else if (phase === "github_branch_waiting") {
    nextAction = "GitHub branch 대기";
  } else if (phase === "auto_gate_running") {
    nextAction = "경량 자동검사 진행";
  } else if (phase === "prompt_building") {
    nextAction = "프롬프트 생성 중";
  } else if (phase === "prompt_ready") {
    nextAction = "Cursor 실행 대기";
  }

  const lastCheckedAt =
    run?.updatedAt ?? execution?.updatedAt ?? execution?.createdAt ?? undefined;

  return {
    codeTaskId,
    taskId,
    phase,
    label,
    ...(reason ? { reason } : {}),
    ...(lastCheckedAt ? { lastCheckedAt } : {}),
    ...(nextAction ? { nextAction } : {}),
  };
}
