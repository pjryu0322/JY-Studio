/**
 * 오케스트레이션용 AI 멤버 역할(프로젝트 RBAC ProjectMemberRole 과 별개).
 */

export type AiMemberRole =
  | "planner"
  | "service-designer"
  | "domain-expert"
  | "reviewer"
  | "security-reviewer"
  | "quality-reviewer"
  | "spec-reviewer"
  | "task-reviewer"
  | "scm-manager";

export type OrchestrationStage = "spec" | "service-flow" | "task" | "execution-review" | "scm-manager";

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
  "service-designer",
  "domain-expert",
  "reviewer",
  "security-reviewer",
  "quality-reviewer",
  "spec-reviewer",
  "task-reviewer",
  "scm-manager",
]);

const ORCHESTRATION_STAGES: ReadonlySet<string> = new Set(["spec", "service-flow", "task", "execution-review", "scm-manager"]);

/** DB에 그대로 저장되는 내부 stage — UI에서는 "서비스 기획" 그룹으로 묶어 표시 */
export const ORCHESTRATION_SERVICE_PLANNING_DB_STAGES = ["spec", "service-flow", "task"] as const;

/** `<select>` 등 UI 전용 값(DB·API로는 변환 후 전송) */
export const ORCHESTRATION_STAGE_UI_SERVICE_PLANNING = "service-planning" as const;

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

export function isOrchestrationServicePlanningDbStage(stage: string | null | undefined): boolean {
  const t = String(stage ?? "").trim().toLowerCase();
  return (ORCHESTRATION_SERVICE_PLANNING_DB_STAGES as readonly string[]).includes(t);
}

/** DB stage → 오케스트레이션 단계 `<select>` value */
export function orchestrationStageDbToUiSelectValue(stage: string | null | undefined): string {
  const t = String(stage ?? "").trim();
  if (!t) return "";
  if (isOrchestrationServicePlanningDbStage(t)) return ORCHESTRATION_STAGE_UI_SERVICE_PLANNING;
  return t;
}

/**
 * UI `<select>` 값 → DB에 저장할 stage.
 * 서비스 기획 그룹은 기존 spec/service-flow/task를 유지하고, 그룹으로 신규 지정 시에만 대표값을 고른다.
 */
export function orchestrationStageUiSelectToDbForSave(
  uiValue: string,
  previousDbStage: string | null | undefined
): OrchestrationStage | null {
  const u = String(uiValue ?? "").trim();
  if (!u) return null;
  if (u === ORCHESTRATION_STAGE_UI_SERVICE_PLANNING) {
    const prev = String(previousDbStage ?? "").trim().toLowerCase();
    if (isOrchestrationServicePlanningDbStage(prev)) {
      return prev as OrchestrationStage;
    }
    return "spec";
  }
  return parseOrchestrationStage(u);
}

/** 초대 폼 등: UI 그룹 선택 → API `orchestrationStage` 문자열 */
export function mapInviteOrchestrationUiStageToDbStage(uiStage: string, orchRole: string): string {
  const s = String(uiStage ?? "").trim();
  if (s !== ORCHESTRATION_STAGE_UI_SERVICE_PLANNING) return s;
  const r = String(orchRole ?? "").trim().toLowerCase();
  if (r === "task-reviewer") return "task";
  if (r === "service-designer") return "service-flow";
  return "spec";
}

/** 멤버 카드·읽기 전용 등 사용자 향 라벨(내부 stage 문자열 비노출) */
export function orchestrationStageUserFacingLabel(stage: string | null | undefined): string {
  const t = String(stage ?? "").trim().toLowerCase();
  if (!t) return "—";
  if (isOrchestrationServicePlanningDbStage(t)) return "서비스 기획";
  if (t === "execution-review") return "실행 검토";
  if (t === "scm-manager") return "PR/merge 관리";
  return t;
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
  "service-designer": "gpt-5-mini",
  "domain-expert": "gpt-5-mini",
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
