export type TaskFlowStatus =
  | "TODO"
  | "READY"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED";

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
