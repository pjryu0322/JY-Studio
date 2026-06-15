import type {
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueRole,
  ImplementationWorkingQueueRoleRoutingSource,
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

/** Display/helper only — not used for keyword or text-based role routing. */
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
  readonly roleRoutingSource: ImplementationWorkingQueueRoleRoutingSource;
}>;

export function buildDeveloperFallbackRoleFields(): RoleOrchestrationFields {
  return {
    primaryRole: "developer",
    executionOwnerRole: "developer",
    reviewWorkflow: DEFAULT_DEVELOPER_WORKFLOW,
    roleReviewSummary: LLM_FALLBACK_ROLE_REVIEW_SUMMARY,
    roleRoutingSource: "fallback",
  };
}

export function resolveRoleOrchestrationFields(input: Readonly<{
  readonly primaryRole?: ImplementationWorkingQueueRole | null;
  readonly executionOwnerRole?: ImplementationWorkingQueueRole | null;
  readonly reviewWorkflow?: readonly ImplementationWorkingQueueWorkflowStep[] | null;
  readonly roleReviewSummary?: string | null;
}>): RoleOrchestrationFields {
  const primaryRole = input.primaryRole ? parseImplementationWorkingQueueRole(input.primaryRole) : null;
  const reviewWorkflow =
    input.reviewWorkflow && input.reviewWorkflow.length > 0 ? input.reviewWorkflow : null;
  const executionOwnerRole = parseImplementationWorkingQueueRole(input.executionOwnerRole) ?? "developer";

  if (primaryRole && reviewWorkflow) {
    const roleReviewSummary = input.roleReviewSummary?.trim()
      ? input.roleReviewSummary.trim().slice(0, 400)
      : undefined;
    return {
      primaryRole,
      executionOwnerRole,
      reviewWorkflow,
      ...(roleReviewSummary ? { roleReviewSummary } : {}),
      roleRoutingSource: "llm",
    };
  }

  return buildDeveloperFallbackRoleFields();
}

export function attachRoleOrchestrationToWorkingQueueItem(
  item: ImplementationWorkingQueueItem,
): ImplementationWorkingQueueItem {
  if (
    item.roleRoutingSource === "llm" &&
    item.primaryRole &&
    item.reviewWorkflow?.length
  ) {
    return item;
  }

  const roleFields = resolveRoleOrchestrationFields({
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
    roleRoutingSource: roleFields.roleRoutingSource,
  };
}
