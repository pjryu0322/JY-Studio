import { EXECUTION_WORKFLOW, type ExecutionWorkflowStatus } from "@/lib/executionLoop/workflowConstants";

export type TaskForPick = {
  id: string;
  order: number;
  status: string;
  dependsOnTaskIds: unknown;
  executionWorkflowStatus: string | null;
  /** ENV_TEST 등은 자동 실행 루프에서 제외(설정 화면에서 단일 실행만) */
  taskKind?: string | null;
};

function depsOf(t: TaskForPick): string[] {
  if (!Array.isArray(t.dependsOnTaskIds)) return [];
  return t.dependsOnTaskIds.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function wf(t: TaskForPick): ExecutionWorkflowStatus | null {
  const s = t.executionWorkflowStatus?.trim();
  if (!s) return null;
  if (Object.values(EXECUTION_WORKFLOW).includes(s as ExecutionWorkflowStatus)) {
    return s as ExecutionWorkflowStatus;
  }
  return null;
}

/**
 * 선행 Task가 모두 done 인 ready Task 중 order 가장 작은 것.
 */
export function pickNextReadyTask(tasks: TaskForPick[]): TaskForPick | undefined {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const candidates = tasks.filter((t) => {
    const tk = String(t.taskKind ?? "").trim();
    if (tk === "ENV_TEST" || tk === "ENV_TEST_STAGE2") return false;
    if (t.status !== "TODO") return false;
    if (wf(t) !== EXECUTION_WORKFLOW.READY) return false;
    // 다음 Task는 "PR_OPENED" 이후에만 가능
    return depsOf(t).every((id) => {
      const w = wf(byId.get(id)!);
      return w === EXECUTION_WORKFLOW.PR_OPENED || w === EXECUTION_WORKFLOW.MERGED || w === EXECUTION_WORKFLOW.DONE;
    });
  });
  candidates.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return candidates[0];
}
