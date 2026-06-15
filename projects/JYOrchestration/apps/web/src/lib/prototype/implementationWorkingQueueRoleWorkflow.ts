import type {
  ImplementationWorkingQueueAffectedArea,
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueRole,
  ImplementationWorkingQueueWorkflowStep,
  ImplementationWorkingQueueWorkflowStepStatus,
  ImplementationWorkingQueueWorkflowTask,
} from "@/lib/prototype/implementationWorkingQueueTypes";

const ROLES = new Set<ImplementationWorkingQueueRole>([
  "planner",
  "designer",
  "developer",
  "reviewer",
  "security",
  "orchestrator",
]);

const TASKS = new Set<ImplementationWorkingQueueWorkflowTask>([
  "ux_review",
  "ui_structure_review",
  "developer_fix",
  "security_review",
  "qa_review",
  "orchestration_summary",
]);

const STEP_STATUSES = new Set<ImplementationWorkingQueueWorkflowStepStatus>(["pending", "reviewed", "skipped"]);

export const DEFAULT_DEVELOPER_WORKFLOW: readonly ImplementationWorkingQueueWorkflowStep[] = [
  { role: "developer", task: "developer_fix", status: "pending" },
];

export const LLM_FALLBACK_ROLE_REVIEW_SUMMARY =
  "요청 원문을 기준으로 개발자 작업대기에 등록합니다." as const;

function workflowStep(
  role: ImplementationWorkingQueueRole,
  task: ImplementationWorkingQueueWorkflowTask,
): ImplementationWorkingQueueWorkflowStep {
  return { role, task, status: "pending" };
}

export function defaultReviewWorkflowForPrimaryRole(
  primaryRole: ImplementationWorkingQueueRole,
): readonly ImplementationWorkingQueueWorkflowStep[] {
  switch (primaryRole) {
    case "designer":
    case "planner":
      return [workflowStep("designer", "ux_review"), workflowStep("developer", "developer_fix")];
    case "security":
      return [workflowStep("security", "security_review"), workflowStep("developer", "developer_fix")];
    case "reviewer":
      return [workflowStep("reviewer", "qa_review"), workflowStep("developer", "developer_fix")];
    case "developer":
    case "orchestrator":
    default:
      return [...DEFAULT_DEVELOPER_WORKFLOW];
  }
}

export function parseImplementationWorkingQueueWorkflowSteps(raw: unknown): ImplementationWorkingQueueWorkflowStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const steps: ImplementationWorkingQueueWorkflowStep[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const o = entry as Record<string, unknown>;
    const role = String(o.role ?? "").trim() as ImplementationWorkingQueueRole;
    const task = String(o.task ?? "").trim() as ImplementationWorkingQueueWorkflowTask;
    const statusRaw = String(o.status ?? "pending").trim() as ImplementationWorkingQueueWorkflowStepStatus;
    if (!ROLES.has(role) || !TASKS.has(task) || !STEP_STATUSES.has(statusRaw)) return null;
    const summary = typeof o.summary === "string" ? o.summary.trim().slice(0, 300) : undefined;
    steps.push({
      role,
      task,
      status: statusRaw,
      ...(summary ? { summary } : {}),
    });
  }
  return steps;
}

export function parseImplementationWorkingQueueRole(raw: unknown): ImplementationWorkingQueueRole | null {
  const role = String(raw ?? "").trim() as ImplementationWorkingQueueRole;
  return ROLES.has(role) ? role : null;
}

export type RoleOrchestrationFields = Readonly<{
  readonly primaryRole: ImplementationWorkingQueueRole;
  readonly executionOwnerRole: ImplementationWorkingQueueRole;
  readonly reviewWorkflow: readonly ImplementationWorkingQueueWorkflowStep[];
  readonly roleReviewSummary?: string;
}>;

export function buildDeveloperFallbackRoleFields(): RoleOrchestrationFields {
  return {
    primaryRole: "developer",
    executionOwnerRole: "developer",
    reviewWorkflow: DEFAULT_DEVELOPER_WORKFLOW,
    roleReviewSummary: LLM_FALLBACK_ROLE_REVIEW_SUMMARY,
  };
}

function inferPrimaryRoleFromSignals(input: Readonly<{
  readonly affectedArea: ImplementationWorkingQueueAffectedArea;
  readonly combinedText: string;
}>): ImplementationWorkingQueueRole {
  const text = input.combinedText.toLowerCase();
  if (
    /권한|인증|보안|민감|비밀|접근\s*제한|로그인한|authorized|permission|auth\b|security/i.test(
      input.combinedText,
    )
  ) {
    return "security";
  }
  if (
    input.affectedArea === "bug" ||
    /qa|회귀|일관성\s*검|검수|오류\s*확인/i.test(input.combinedText)
  ) {
    return "reviewer";
  }
  if (
    input.affectedArea === "data" ||
    input.affectedArea === "feature" ||
    /api\b|데이터\s*모델|상태\s*관리|저장하고\s*불러|비즈니스\s*로직|integration/i.test(input.combinedText)
  ) {
    return "developer";
  }
  if (
    input.affectedArea === "ui" ||
    input.affectedArea === "style" ||
    input.affectedArea === "flow" ||
    /레이아웃|정보\s*구조|가독|타이틀|진하게|목록|spacing|typography|화면\s*구조|사용성|ui\b|ux\b/i.test(
      input.combinedText,
    )
  ) {
    return "designer";
  }
  if (text.includes("design") || text.includes("layout")) return "designer";
  return "developer";
}

export function resolveRoleOrchestrationFields(input: Readonly<{
  readonly affectedArea: ImplementationWorkingQueueAffectedArea;
  readonly description: string;
  readonly desiredBehavior?: string;
  readonly rawUserMessage?: string;
  readonly primaryRole?: ImplementationWorkingQueueRole;
  readonly executionOwnerRole?: ImplementationWorkingQueueRole;
  readonly reviewWorkflow?: readonly ImplementationWorkingQueueWorkflowStep[];
  readonly roleReviewSummary?: string;
}>): RoleOrchestrationFields {
  const combinedText = [input.description, input.desiredBehavior ?? "", input.rawUserMessage ?? ""]
    .join(" ")
    .trim();

  const primaryRole =
    input.primaryRole ?? inferPrimaryRoleFromSignals({ affectedArea: input.affectedArea, combinedText });
  const executionOwnerRole = input.executionOwnerRole ?? "developer";

  let reviewWorkflow: readonly ImplementationWorkingQueueWorkflowStep[];
  if (input.reviewWorkflow?.length) {
    reviewWorkflow = input.reviewWorkflow;
  } else if (input.primaryRole) {
    reviewWorkflow = defaultReviewWorkflowForPrimaryRole(input.primaryRole);
  } else {
    reviewWorkflow = defaultReviewWorkflowForPrimaryRole(primaryRole);
  }

  const roleReviewSummary = input.roleReviewSummary?.trim()
    ? input.roleReviewSummary.trim().slice(0, 400)
    : undefined;

  return {
    primaryRole,
    executionOwnerRole,
    reviewWorkflow,
    ...(roleReviewSummary ? { roleReviewSummary } : {}),
  };
}

export function attachRoleOrchestrationToWorkingQueueItem(
  item: ImplementationWorkingQueueItem,
): ImplementationWorkingQueueItem {
  if (item.primaryRole && item.reviewWorkflow?.length) return item;
  const roleFields = resolveRoleOrchestrationFields({
    affectedArea: item.affectedArea,
    description: item.description,
    desiredBehavior: item.desiredBehavior,
    rawUserMessage: item.rawUserMessage,
    primaryRole: item.primaryRole,
    executionOwnerRole: item.executionOwnerRole,
    reviewWorkflow: item.reviewWorkflow,
    roleReviewSummary: item.roleReviewSummary,
  });
  return {
    ...item,
    primaryRole: roleFields.primaryRole,
    executionOwnerRole: roleFields.executionOwnerRole,
    reviewWorkflow: roleFields.reviewWorkflow,
    ...(roleFields.roleReviewSummary ? { roleReviewSummary: roleFields.roleReviewSummary } : {}),
  };
}
