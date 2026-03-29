/**
 * 오케스트레이션용 AI 멤버 역할(프로젝트 RBAC ProjectMemberRole 과 별개).
 */

export type AiMemberRole =
  | "planner"
  | "reviewer"
  | "security-reviewer"
  | "quality-reviewer"
  | "spec-reviewer"
  | "task-reviewer";

export type OrchestrationStage = "spec" | "task" | "execution-review";

export type AiMemberConfig = {
  id: string;
  name: string;
  role: AiMemberRole;
  model: string;
  enabled: boolean;
  stage: OrchestrationStage;
};

const AI_MEMBER_ROLES: ReadonlySet<string> = new Set([
  "planner",
  "reviewer",
  "security-reviewer",
  "quality-reviewer",
  "spec-reviewer",
  "task-reviewer",
]);

const ORCHESTRATION_STAGES: ReadonlySet<string> = new Set(["spec", "task", "execution-review"]);

/** Cursor 실행 후 검토 파이프라인에 참여하는 역할(순서) */
export const EXECUTION_REVIEW_ROLE_ORDER: readonly AiMemberRole[] = [
  "reviewer",
  "security-reviewer",
  "quality-reviewer",
  "spec-reviewer",
  "task-reviewer",
] as const;

export function parseAiMemberRole(value: unknown): AiMemberRole | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s || !AI_MEMBER_ROLES.has(s)) return null;
  return s as AiMemberRole;
}

export function parseOrchestrationStage(value: unknown): OrchestrationStage | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s || !ORCHESTRATION_STAGES.has(s)) return null;
  return s as OrchestrationStage;
}

export function roleOrderIndex(role: AiMemberRole): number {
  const i = EXECUTION_REVIEW_ROLE_ORDER.indexOf(role);
  return i === -1 ? 999 : i;
}

export type ExecutionReviewDecision = "done" | "retry" | "failed";

export function aggregateExecutionReviewDecisions(decisions: ExecutionReviewDecision[]): ExecutionReviewDecision {
  if (decisions.some((d) => d === "failed")) return "failed";
  if (decisions.some((d) => d === "retry")) return "retry";
  return "done";
}
