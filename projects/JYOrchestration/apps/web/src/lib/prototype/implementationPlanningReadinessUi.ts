import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type {
  ImplementationCodeTaskExecutionFeedbackV1,
} from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import {
  buildImplementationCodeTaskFeedbackSummary,
  buildImplementationCodeTaskFeedbackTaskRows,
  type ImplementationCodeTaskFeedbackSummaryV1,
  type ImplementationCodeTaskFeedbackTaskRowV1,
} from "@/lib/prototype/implementationCodeTaskFeedbackUi";
import type {
  ImplementationCodeTaskQualityGateV1,
  ImplementationCodeTaskQualityIssueV1,
} from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE,
  IMPLEMENTATION_PLANNING_MISSING_VALIDATION_MESSAGE,
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
  readonly qualityIssues?: readonly ImplementationCodeTaskQualityIssueV1[];
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
  readonly qualityStatus: "passed" | "warning" | "failed" | "unknown";
  readonly qualityIssueCount: number;
  readonly qualityWarnings: readonly string[];
  readonly qualityErrors: readonly string[];
  readonly riskyCodeTaskIds: readonly string[];
  readonly executionReady: boolean;
  readonly supplementReasons: readonly string[];
  readonly advancedTasks: readonly ImplementationPlanningReadinessCardTaskRow[];
  readonly feedbackSummary?: ImplementationCodeTaskFeedbackSummaryV1;
  readonly feedbackTaskRows?: readonly ImplementationCodeTaskFeedbackTaskRowV1[];
}>;

function countDeveloperTasks(taskList: ImplementationTaskListV1 | null | undefined): number {
  return (taskList?.tasks ?? []).filter((task) => task.ownerRole === "developer").length;
}

function formatLlmRefinementLabel(plan: ImplementationCodeTaskPlanV1 | null | undefined): string {
  const status = plan?.refinementStatus ?? "heuristic_only";
  switch (status) {
    case "llm_refined":
      return "LLM Refinement: 적용됨";
    case "llm_validation_failed":
    case "llm_unavailable_fallback":
    case "llm_parse_failed_fallback":
      return "LLM Refinement: heuristic fallback";
    default:
      return "LLM Refinement: heuristic only";
  }
}

function formatQualityStatusLabel(
  status: ImplementationPlanningReadinessCardVM["qualityStatus"],
): string {
  switch (status) {
    case "passed":
      return "통과";
    case "warning":
      return "경고";
    case "failed":
      return "실패";
    default:
      return "미확인";
  }
}

export { formatQualityStatusLabel };

function groupIssuesByCodeTaskId(
  issues: readonly ImplementationCodeTaskQualityIssueV1[],
): Readonly<Record<string, readonly ImplementationCodeTaskQualityIssueV1[]>> {
  const grouped: Record<string, ImplementationCodeTaskQualityIssueV1[]> = {};
  for (const issue of issues) {
    const bucket = grouped[issue.codeTaskId] ?? [];
    bucket.push(issue);
    grouped[issue.codeTaskId] = bucket;
  }
  return grouped;
}

export function buildImplementationPlanningReadinessCardVM(input: {
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly preflightSummary?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly codeTaskQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly codeTaskExecutionFeedback?: ImplementationCodeTaskExecutionFeedbackV1 | null;
}): ImplementationPlanningReadinessCardVM | null {
  const plan = input.codeTaskPlan;
  if (!plan?.tasks?.length && !input.taskList?.tasks?.length) return null;

  const gate = evaluateImplementationPlanningExecutionGate({
    codeTaskPlan: plan,
    cursorWorkItems: input.cursorWorkItems,
    preflightSummary: input.preflightSummary,
    codeTaskQualityGate: input.codeTaskQualityGate,
  });

  const qualityGate = input.codeTaskQualityGate;
  const qualityStatus = qualityGate?.status ?? "unknown";
  const qualityWarnings = (qualityGate?.issues ?? [])
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message)
    .slice(0, 3);
  const qualityErrors = (qualityGate?.issues ?? [])
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message)
    .slice(0, 3);
  const riskyCodeTaskIds = [
    ...new Set(
      (qualityGate?.issues ?? [])
        .filter((issue) => issue.severity === "error" || issue.severity === "warning")
        .map((issue) => issue.codeTaskId),
    ),
  ];
  const issuesByCodeTaskId = groupIssuesByCodeTaskId(qualityGate?.issues ?? []);

  const supplementReasons: string[] = [];
  if (plan?.readiness.missing.length) {
    supplementReasons.push(...plan.readiness.missing.slice(0, 4));
  }
  if (plan?.validationReport?.status === "failed") {
    supplementReasons.push(...(plan.validationReport.errors.slice(0, 3) ?? []));
  } else if (!plan?.validationReport?.status) {
    supplementReasons.push(IMPLEMENTATION_PLANNING_MISSING_VALIDATION_MESSAGE);
  }
  if (qualityGate?.status === "failed") {
    supplementReasons.push(IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE);
    supplementReasons.push(...qualityErrors.slice(0, 3));
  } else if (qualityGate?.status === "warning") {
    supplementReasons.push(...qualityWarnings.slice(0, 3));
  }
  if (input.preflightSummary?.status === "failed") {
    supplementReasons.push(...(input.preflightSummary.failedReasons.slice(0, 3) ?? []));
  }
  if (!gate.ok && gate.message) {
    supplementReasons.push(gate.message);
  }

  const executionReady = gate.ok;
  const overallTone: "ok" | "warn" = executionReady ? "ok" : "warn";
  const feedbackSummary = buildImplementationCodeTaskFeedbackSummary(input.codeTaskExecutionFeedback);
  const feedbackTaskRows = buildImplementationCodeTaskFeedbackTaskRows(input.codeTaskExecutionFeedback);

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
    qualityStatus,
    qualityIssueCount: qualityGate?.issueCount ?? 0,
    qualityWarnings,
    qualityErrors,
    riskyCodeTaskIds,
    executionReady,
    supplementReasons: [...new Set(supplementReasons.map((v) => v.trim()).filter(Boolean))].slice(
      0,
      3,
    ),
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
      ...(issuesByCodeTaskId[task.codeTaskId]?.length
        ? { qualityIssues: issuesByCodeTaskId[task.codeTaskId] }
        : {}),
    })),
    ...(feedbackSummary ? { feedbackSummary } : {}),
    ...(feedbackTaskRows.length ? { feedbackTaskRows } : {}),
  };
}
