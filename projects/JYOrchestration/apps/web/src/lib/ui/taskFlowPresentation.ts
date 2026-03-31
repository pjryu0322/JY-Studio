import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

export type TaskFlowStatus =
  | "TODO"
  | "READY"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED";

/** Task 실행 화면 4분면(준비/진행/막힘/완료) */
export type ExecutionBoardBucket = "ready" | "running" | "blocked" | "completed";

type TaskFlowPrompt = { taskId: string; status: string };
type TaskFlowRun = { status: string };

export function deriveTaskFlowStatus(input: {
  taskStatus: string;
  prompt: TaskFlowPrompt | undefined;
  run: TaskFlowRun | undefined;
  isRunningClient: boolean;
}): TaskFlowStatus {
  const { taskStatus, prompt, run, isRunningClient } = input;

  if (isRunningClient) {
    return "RUNNING";
  }
  if (taskStatus === "BLOCKED") {
    return "BLOCKED";
  }
  if (taskStatus === "CANCELLED") {
    return "CANCELLED";
  }
  if (run) {
    if (run.status === "PENDING") {
      return "RUNNING";
    }
    if (run.status === "FAILED") {
      return "FAILED";
    }
    if (run.status === "DONE" || run.status === "READY_FOR_GIT") {
      return "DONE";
    }
  }
  if (prompt) {
    return "READY";
  }
  return "TODO";
}

export function taskFlowStatusLabel(status: TaskFlowStatus): string {
  return status;
}

export function executionBoardBucket(input: {
  flow: TaskFlowStatus;
  executionWorkflowStatus?: string | null;
}): ExecutionBoardBucket {
  const ew = (input.executionWorkflowStatus ?? "").toLowerCase();

  if (input.flow === "RUNNING") {
    return "running";
  }
  if (
    ew === EXECUTION_WORKFLOW.RUNNING ||
    ew === EXECUTION_WORKFLOW.REVIEWING ||
    ew === EXECUTION_WORKFLOW.PENDING_APPLY
  ) {
    return "running";
  }

  // 리뷰/머지 단계는 "진행 중"이 아니라 "대기/차단"으로 분류(merge 전 다음 Task 금지)
  if (
    ew === EXECUTION_WORKFLOW.COMMITTED ||
    ew === EXECUTION_WORKFLOW.REVIEW_PENDING ||
    ew === EXECUTION_WORKFLOW.REVIEW_REJECTED ||
    ew === EXECUTION_WORKFLOW.REVIEW_APPROVED ||
    ew === EXECUTION_WORKFLOW.MERGE_PENDING
  ) {
    return "blocked";
  }

  if (input.flow === "DONE") {
    return "completed";
  }
  if (ew === EXECUTION_WORKFLOW.MERGED || ew === EXECUTION_WORKFLOW.DONE || ew === EXECUTION_WORKFLOW.PR_OPENED) {
    return "completed";
  }

  if (input.flow === "BLOCKED" || input.flow === "FAILED" || input.flow === "CANCELLED") {
    return "blocked";
  }
  if (ew === EXECUTION_WORKFLOW.FAILED || ew === EXECUTION_WORKFLOW.AWAITING_HUMAN) {
    return "blocked";
  }

  return "ready";
}

export function executionBoardLabelKo(bucket: ExecutionBoardBucket): string {
  switch (bucket) {
    case "ready":
      return "준비된 Task";
    case "running":
      return "실행 중인 Task";
    case "blocked":
      return "막힌 Task";
    case "completed":
      return "완료된 Task";
    default:
      return bucket;
  }
}

export function executionBoardSortKey(bucket: ExecutionBoardBucket): number {
  switch (bucket) {
    case "running":
      return 0;
    case "ready":
      return 1;
    case "blocked":
      return 2;
    case "completed":
      return 3;
    default:
      return 9;
  }
}

export function taskFlowBadgeColors(status: TaskFlowStatus): {
  background: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "TODO":
      return { background: "#eceff1", color: "#455a64", border: "1px solid #b0bec5" };
    case "READY":
      return { background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9" };
    case "RUNNING":
      return { background: "#fff8e1", color: "#e65100", border: "1px solid #ffb74d" };
    case "DONE":
      return { background: "#e8f5e9", color: "#2e7d32", border: "1px solid #81c784" };
    case "FAILED":
      return { background: "#ffebee", color: "#c62828", border: "1px solid #ef9a9a" };
    case "BLOCKED":
      return { background: "#f3e5f5", color: "#6a1b9a", border: "1px solid #ce93d8" };
    case "CANCELLED":
      return { background: "#efebe9", color: "#5d4037", border: "1px solid #a1887f" };
    default:
      return { background: "#eceff1", color: "#455a64", border: "1px solid #b0bec5" };
  }
}
