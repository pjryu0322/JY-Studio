/**
 * Harness Phase H3 — **Role-aware Knowledge Activation Harness** 타입.
 *
 * **read-only / planning metadata only.** 이 타입의 어떤 값도 실제 retrieval query,
 * vector search, prompt payload, LLM 호출, provider, Cursor execution, GitHub PR/merge에
 * 영향을 주지 않는다.
 *
 * 목적: "AI 역할, 프로젝트 단계, 작업 유형에 따라 어떤 지식팩이 왜 활성화 후보가 되었는가"를
 * 설명 가능한 구조로 만든다.
 *
 * 아직 하지 않는 것: actual retrieval orchestration, vector search control,
 * automatic retrieval, actual prompt injection, provider routing, hard enforcement.
 */

/**
 * Knowledge Activation 후보의 우선순위. `required > recommended > optional`로 merge한다.
 * 실제 enforcement에는 사용되지 않는다(planning hint).
 */
export type KnowledgeActivationPriority = "required" | "recommended" | "optional";

/** 활성화 사유의 분류. UI 라벨 매핑의 단일 출처. */
export type KnowledgeActivationReasonType =
  | "role_policy"
  | "stage_policy"
  | "task_type_policy"
  | "project_context"
  | "manual_selection"
  | "safety_requirement"
  | "existing_hint";

/** Finding severity(이 단계에서 행동 강제 없음 → info/warning만). */
export type KnowledgeActivationFindingSeverity = "info" | "warning";

/**
 * 단일 활성화 후보 지식팩.
 *
 * - `knowledgePackId`: kebab-case 권장. 실제 지식팩 존재 여부와 무관한 planning ID.
 * - `priority`: merge 결과 우선순위.
 * - `reasonType` / `reasonLabel`: 어떤 정책에 의해 후보가 되었는지(사용자 표시용).
 * - `roleKey`/`workspaceStage`/`taskType`: optional — 사유에 해당하는 컨텍스트.
 */
export type KnowledgeActivationPlanItem = Readonly<{
  knowledgePackId: string;
  priority: KnowledgeActivationPriority;
  reasonType: KnowledgeActivationReasonType;
  reasonLabel: string;
  roleKey?: string;
  workspaceStage?: string;
  taskType?: string;
}>;

/** Finding(진단/안내). 행동 강제 아님. */
export type KnowledgeActivationFinding = Readonly<{
  code: string;
  severity: KnowledgeActivationFindingSeverity;
  message: string;
}>;

/**
 * Knowledge Activation Plan — 한 turn의 지식팩 활성화 후보 목록 + 진단.
 *
 * **항상 `mode === "dry_run"`.** apply가 아닌 planning 결과이며, retrieval에 영향 없음.
 */
export type KnowledgeActivationPlan = Readonly<{
  mode: "dry_run";
  roleKey: string | null;
  workspaceStage: string | null;
  taskType: string | null;
  items: readonly KnowledgeActivationPlanItem[];
  findings: readonly KnowledgeActivationFinding[];
}>;

/**
 * Diagnostic API 응답용 누적 summary.
 *
 * - `total`: 후보 수.
 * - `required/recommended/optional`: priority 분포.
 * - `rolePolicyDriven/stagePolicyDriven/taskTypePolicyDriven/existingHintDriven`: 출처 분포 hint.
 */
export type KnowledgeActivationSummary = Readonly<{
  mode: "dry_run";
  total: number;
  required: number;
  recommended: number;
  optional: number;
  rolePolicyDriven: number;
  stagePolicyDriven: number;
  taskTypePolicyDriven: number;
  existingHintDriven: number;
  findingsCount: number;
}>;

/**
 * 정책 모듈이 공통으로 반환하는 후보 참조.
 *
 * `roleKey`/`workspaceStage`/`taskType`/`existingHints`별 helper가 이 형태로 후보를 만들고,
 * builder가 dedupe + priority merge + reasonType 부여한다.
 */
export type KnowledgeActivationPolicyRef = Readonly<{
  knowledgePackId: string;
  priority: KnowledgeActivationPriority;
  reasonLabel?: string;
}>;

/** 빈 plan(replay/empty fallback). 호출부 shape 안정화. */
export function emptyKnowledgeActivationPlan(): KnowledgeActivationPlan {
  return {
    mode: "dry_run",
    roleKey: null,
    workspaceStage: null,
    taskType: null,
    items: [],
    findings: [],
  };
}

/** 빈 summary. */
export function emptyKnowledgeActivationSummary(): KnowledgeActivationSummary {
  return {
    mode: "dry_run",
    total: 0,
    required: 0,
    recommended: 0,
    optional: 0,
    rolePolicyDriven: 0,
    stagePolicyDriven: 0,
    taskTypePolicyDriven: 0,
    existingHintDriven: 0,
    findingsCount: 0,
  };
}

/** Knowledge Activation Plan → Summary 변환(read-only). */
export function summarizeKnowledgeActivationPlan(
  plan: KnowledgeActivationPlan | null | undefined
): KnowledgeActivationSummary {
  if (!plan || plan.mode !== "dry_run" || !Array.isArray(plan.items)) {
    return emptyKnowledgeActivationSummary();
  }
  let required = 0;
  let recommended = 0;
  let optional = 0;
  let rolePolicyDriven = 0;
  let stagePolicyDriven = 0;
  let taskTypePolicyDriven = 0;
  let existingHintDriven = 0;
  for (const item of plan.items) {
    if (item.priority === "required") required += 1;
    else if (item.priority === "recommended") recommended += 1;
    else if (item.priority === "optional") optional += 1;
    if (item.reasonType === "role_policy") rolePolicyDriven += 1;
    else if (item.reasonType === "stage_policy") stagePolicyDriven += 1;
    else if (item.reasonType === "task_type_policy") taskTypePolicyDriven += 1;
    else if (item.reasonType === "existing_hint") existingHintDriven += 1;
  }
  return {
    mode: "dry_run",
    total: plan.items.length,
    required,
    recommended,
    optional,
    rolePolicyDriven,
    stagePolicyDriven,
    taskTypePolicyDriven,
    existingHintDriven,
    findingsCount: plan.findings?.length ?? 0,
  };
}

/**
 * priority merge 규칙. `required > recommended > optional`.
 *
 * 두 priority가 들어오면 더 강한 쪽을 반환한다. 같은 priority는 그대로 유지.
 */
export function mergeKnowledgeActivationPriorities(
  a: KnowledgeActivationPriority,
  b: KnowledgeActivationPriority
): KnowledgeActivationPriority {
  const rank: Readonly<Record<KnowledgeActivationPriority, number>> = {
    required: 3,
    recommended: 2,
    optional: 1,
  };
  return (rank[a] ?? 0) >= (rank[b] ?? 0) ? a : b;
}
