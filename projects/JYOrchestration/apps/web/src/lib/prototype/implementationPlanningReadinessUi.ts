import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateImplementationPlanningExecutionGate,
  type ImplementationWorkItemPreflightSummaryV1,
} from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type ImplementationPlanningReadinessCardTaskRow = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly changeType: string;
  readonly title: string;
  readonly status: string;
  readonly parentTaskDependencies: readonly string[];
  readonly codeTaskDependencies: readonly string[];
  readonly candidateFileHints: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly verificationHints: readonly string[];
  readonly llmRationale?: string;
}>;

export type ImplementationPlanningReadinessCardVM = Readonly<{
  readonly visible: true;
  readonly overallLabel: "준비됨" | "보완 필요";
  readonly overallTone: "ok" | "warn";
  readonly parentTaskCount: number;
  readonly codeTaskCount: number;
  readonly workItemCount: number;
  readonly preflightStatus: "passed" | "failed" | "unknown";
  readonly llmRefinementLabel: string;
  readonly validationStatus: "passed" | "failed" | "unknown";
  readonly executionReady: boolean;
  readonly supplementReasons: readonly string[];
  readonly advancedTasks: readonly ImplementationPlanningReadinessCardTaskRow[];
}>;

function countDeveloperTasks(taskList: ImplementationTaskListV1 | null | undefined): number {
  return (taskList?.tasks ?? []).filter((task) => task.ownerRole === "developer").length;
}

function formatLlmRefinementLabel(plan: ImplementationCodeTaskPlanV1 | null | undefined): string {
  const status = plan?.refinementStatus ?? "heuristic_only";
  switch (status) {
    case "llm_refined":
      return "LLM 정제 적용";
    case "llm_validation_failed":
      return "LLM 정제 실패 · heuristic 유지";
    case "llm_unavailable_fallback":
      return "LLM 사용 불가 · heuristic 유지";
    case "llm_parse_failed_fallback":
      return "LLM 응답 파싱 실패 · heuristic 유지";
    default:
      return "Heuristic only";
  }
}

export function buildImplementationPlanningReadinessCardVM(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly preflightSummary?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
}): ImplementationPlanningReadinessCardVM | null {
  const plan = input.codeTaskPlan;
  if (!plan?.tasks?.length && !input.taskList?.tasks?.length) return null;

  const gate = evaluateImplementationPlanningExecutionGate({
    codeTaskPlan: plan,
    cursorWorkItems: input.cursorWorkItems,
    preflightSummary: input.preflightSummary,
  });

  const supplementReasons: string[] = [];
  if (plan?.readiness.missing.length) {
    supplementReasons.push(...plan.readiness.missing.slice(0, 4));
  }
  if (plan?.validationReport?.status === "failed") {
    supplementReasons.push(...(plan.validationReport.errors.slice(0, 3) ?? []));
  } else if (!plan?.validationReport?.status) {
    supplementReasons.push("CodeTask validationReport가 없습니다. 구현 준비 산출물 동기화가 필요합니다.");
  }
  if (input.preflightSummary?.status === "failed") {
    supplementReasons.push(...(input.preflightSummary.failedReasons.slice(0, 3) ?? []));
  }
  if (!gate.ok && gate.message) {
    supplementReasons.push(gate.message);
  }

  const executionReady = gate.ok;
  const overallTone: "ok" | "warn" = executionReady ? "ok" : "warn";

  return {
    visible: true,
    overallLabel: executionReady ? "준비됨" : "보완 필요",
    overallTone,
    parentTaskCount: plan?.parentTaskCount ?? countDeveloperTasks(input.taskList),
    codeTaskCount: plan?.codeTaskCount ?? plan?.tasks.length ?? 0,
    workItemCount: input.cursorWorkItems?.length ?? 0,
    preflightStatus: input.preflightSummary?.status ?? "unknown",
    llmRefinementLabel: formatLlmRefinementLabel(plan),
    validationStatus: plan?.validationReport?.status ?? "unknown",
    executionReady,
    supplementReasons: [...new Set(supplementReasons.map((v) => v.trim()).filter(Boolean))],
    advancedTasks: (plan?.tasks ?? []).map((task) => ({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      changeType: task.changeType,
      title: task.title,
      status: task.status,
      parentTaskDependencies: task.parentTaskDependencies ?? [],
      codeTaskDependencies: task.codeTaskDependencies ?? [],
      candidateFileHints: task.candidateFileHints ?? [],
      acceptanceCriteria: task.acceptanceCriteria ?? [],
      verificationHints: task.verificationHints ?? [],
      ...(task.llmRationale ? { llmRationale: task.llmRationale } : {}),
    })),
  };
}
