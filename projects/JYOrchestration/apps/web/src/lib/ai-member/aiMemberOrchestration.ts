/**
 * 오케스트레이션용 AI 멤버 역할(프로젝트 RBAC ProjectMemberRole 과 별개).
 */

export type AiMemberRole =
  | "planner"
  | "reviewer"
  | "security-reviewer"
  | "quality-reviewer"
  | "spec-reviewer"
  | "task-reviewer"
  | "scm-manager";

export type OrchestrationStage = "spec" | "task" | "execution-review" | "scm-manager";

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
  "scm-manager",
]);

const ORCHESTRATION_STAGES: ReadonlySet<string> = new Set(["spec", "task", "execution-review", "scm-manager"]);

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

/** LLM JSON 권장 스키마(이력·표시용). 내부 집계는 ExecutionReviewDecision 과 매핑한다. */
export type ReviewResultDecision = "pass" | "retry" | "fail";

export type ReviewResult = {
  decision: ReviewResultDecision;
  summary: string;
  issues: string[];
};

export const DEFAULT_REVIEWER_MODEL_BY_ROLE: Partial<Record<AiMemberRole, string>> = {
  /** 실행 리뷰어: 최종 판단 — 고역량 기본 */
  reviewer: "gpt-5",
  "security-reviewer": "gpt-5-mini",
  "quality-reviewer": "gpt-5-mini",
  "spec-reviewer": "gpt-5-mini",
  "task-reviewer": "gpt-5-mini",
  planner: "gpt-5-mini",
};

const FALLBACK_REVIEWER_MODEL = "gpt-5-mini";

/** UI·서버 공통: 저장된 덮어쓰기가 없으면 역할별 기본 모델 */
export function resolveEffectiveReviewerModel(role: AiMemberRole, aiModelOverride: string | null | undefined): string {
  const o = aiModelOverride?.trim();
  if (o) return o;
  return DEFAULT_REVIEWER_MODEL_BY_ROLE[role] ?? FALLBACK_REVIEWER_MODEL;
}

export const REVIEW_MODEL_PRESETS: readonly { value: string; label: string }[] = [
  { value: "gpt-5", label: "GPT-5 (권장)" },
  { value: "gpt-5-mini", label: "GPT-5-mini (빠름/저비용)" },
] as const;

/** 실행 리뷰어에 부적절한 경량 모델 선택 시 경고 */
export function isLowCapabilityReviewerModel(modelId: string): boolean {
  const m = modelId.trim().toLowerCase();
  if (!m) return false;
  if (m === "gpt-5") return false;
  if (m === "gpt-5-mini" || m === "gpt-4o-mini" || m === "o4-mini") return true;
  if (/-mini$/.test(m) || /-mini\b/.test(m)) return true;
  return false;
}

export function reviewerModelDisplayLabel(role: AiMemberRole, aiModelOverride: string | null | undefined): string {
  const id = resolveEffectiveReviewerModel(role, aiModelOverride);
  const preset = REVIEW_MODEL_PRESETS.find((p) => p.value === id);
  if (preset) return preset.label;
  return id;
}

export function aggregateExecutionReviewDecisions(decisions: ExecutionReviewDecision[]): ExecutionReviewDecision {
  if (decisions.some((d) => d === "failed")) return "failed";
  if (decisions.some((d) => d === "retry")) return "retry";
  return "done";
}
