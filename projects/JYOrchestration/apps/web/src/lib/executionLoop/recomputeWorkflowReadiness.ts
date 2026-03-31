import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

type Row = {
  id: string;
  dependsOnTaskIds: unknown;
  executionWorkflowStatus: string | null;
};

function depsOf(t: Row): string[] {
  if (!Array.isArray(t.dependsOnTaskIds)) return [];
  return t.dependsOnTaskIds.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function wf(s: string | null | undefined): string | null {
  return s?.trim() || null;
}

/** 진행/게이트/종료 상태는 유지. 나머지는 선행 MERGED 여부로 pending/ready 계산. */
export function computeWorkflowUpdates(rows: Row[]): Map<string, string> {
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const next = new Map<string, string>();
  for (const t of rows) {
    const cur = wf(t.executionWorkflowStatus);
    if (
      cur === EXECUTION_WORKFLOW.RUNNING ||
      cur === EXECUTION_WORKFLOW.COMMITTED ||
      cur === EXECUTION_WORKFLOW.REVIEW_PENDING ||
      cur === EXECUTION_WORKFLOW.REVIEW_REJECTED ||
      cur === EXECUTION_WORKFLOW.REVIEW_APPROVED ||
      cur === EXECUTION_WORKFLOW.MERGE_PENDING ||
      cur === EXECUTION_WORKFLOW.MERGED ||
      cur === EXECUTION_WORKFLOW.PENDING_APPLY ||
      cur === EXECUTION_WORKFLOW.PR_OPENED ||
      cur === EXECUTION_WORKFLOW.REVIEWING ||
      cur === EXECUTION_WORKFLOW.AWAITING_HUMAN ||
      cur === EXECUTION_WORKFLOW.DONE ||
      cur === EXECUTION_WORKFLOW.FAILED
    ) {
      next.set(t.id, cur!);
      continue;
    }
    const ds = depsOf(t);
    const depWf = (id: string) => wf(byId.get(id)?.executionWorkflowStatus ?? null);
    const anyFailed = ds.some((id) => depWf(id) === EXECUTION_WORKFLOW.FAILED);
    const anyAwaiting = ds.some((id) => depWf(id) === EXECUTION_WORKFLOW.AWAITING_HUMAN);
    if (anyAwaiting) {
      next.set(t.id, EXECUTION_WORKFLOW.PENDING);
      continue;
    }
    const anyPendingApply = ds.some((id) => depWf(id) === EXECUTION_WORKFLOW.PENDING_APPLY);
    if (anyPendingApply) {
      next.set(t.id, EXECUTION_WORKFLOW.PENDING);
      continue;
    }
    if (anyFailed) {
      next.set(t.id, EXECUTION_WORKFLOW.PENDING);
      continue;
    }
    const depOk = (s: string | null) =>
      s === EXECUTION_WORKFLOW.PR_OPENED || s === EXECUTION_WORKFLOW.MERGED || s === EXECUTION_WORKFLOW.DONE;
    const allMerged = ds.length === 0 || ds.every((id) => depOk(depWf(id)));
    next.set(t.id, allMerged ? EXECUTION_WORKFLOW.READY : EXECUTION_WORKFLOW.PENDING);
  }
  return next;
}
