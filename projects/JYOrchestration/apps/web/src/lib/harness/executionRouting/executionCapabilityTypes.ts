/**
 * Harness Phase H5 Preparation — **Execution Routing Harness** 타입.
 *
 * **read-only / planning metadata only.** 이 타입의 어떤 값도 실제 prompt payload, LLM 호출,
 * retrieval, provider switching, Cursor execution, GitHub PR/merge에 영향을 주지 않는다.
 *
 * 목적: "어떤 AI멤버가 어떤 실행 capability를 가질 수 있는가"를 설명 가능한 구조로 만든다.
 * 아직 하지 않는 것: actual provider switching, actual execution routing, automatic Cursor execution,
 * provider lock-in, hard enforcement, execution blocking.
 */

/**
 * 실행 capability 분류.
 *
 * - `planning` / `analysis`: 기획·분석(주로 OpenAI).
 * - `architecture_review` / `design_review`: 설계 검토(OpenAI 우선).
 * - `code_generation` / `cursor_execution`: 코드 생성·Cursor 실행(Cursor 우선).
 * - `code_review` / `security_review` / `quality_review` / `deployment_review`: 각 영역 검토(OpenAI 우선).
 * - `github_operation`: GitHub 작업(GitHub provider 전용).
 */
export type ExecutionCapability =
  | "planning"
  | "analysis"
  | "architecture_review"
  | "design_review"
  | "code_generation"
  | "code_review"
  | "security_review"
  | "quality_review"
  | "deployment_review"
  | "cursor_execution"
  | "github_operation";

/** 실행 provider 종류. */
export type ExecutionProviderType = "openai" | "cursor" | "github" | "unknown";

/** Execution routing finding의 severity(H4 / H3과 동일 어휘). */
export type ExecutionRoutingFindingSeverity = "info" | "warning";

/**
 * 단일 routing plan item — 역할별 capability와 추천 provider, enable 여부, 사유.
 *
 * - `enabled`: provider matrix에서 지원되면 true, 아니면 false(diagnostic 표시; 실제 실행 비변경).
 * - `reason`: 사용자/감사 트레이스용 사유 라벨.
 * - `warning`: 선택적 경고 메시지(예: "provider matrix not matched"). enforcement 아님.
 */
export type ExecutionRoutingPlanItem = Readonly<{
  roleKey: string;
  capability: ExecutionCapability;
  provider: ExecutionProviderType;
  enabled: boolean;
  reason: string;
  warning?: string;
}>;

/** Plan-level finding(전체 plan 진단). */
export type ExecutionRoutingFinding = Readonly<{
  code: string;
  severity: ExecutionRoutingFindingSeverity;
  message: string;
}>;

/**
 * Execution Routing Plan — 한 turn의 routing 계획 + 진단.
 *
 * **항상 `mode === "dry_run"`.** apply가 아닌 planning. provider switching/execution 영향 없음.
 */
export type ExecutionRoutingPlan = Readonly<{
  mode: "dry_run";
  roleKey: string | null;
  workspaceStage: string | null;
  items: readonly ExecutionRoutingPlanItem[];
  findings: readonly ExecutionRoutingFinding[];
}>;

/**
 * Diagnostic 응답용 누적 summary(단일 plan 기준).
 *
 * - `roles`: plan items의 유니크 roleKey 수(보통 1; replay 시 N).
 * - `providers`: items의 유니크 provider 수.
 * - `capabilities`: items의 유니크 capability 수.
 * - `warnings`: warning 텍스트가 있는 item 수.
 * - `enabledCount` / `disabledCount`: enabled flag 분포.
 * - `findingsCount`: plan-level finding 수.
 */
export type ExecutionRoutingSummary = Readonly<{
  mode: "dry_run";
  total: number;
  roles: number;
  providers: number;
  capabilities: number;
  warnings: number;
  enabledCount: number;
  disabledCount: number;
  findingsCount: number;
}>;

/** 빈 plan(replay/empty fallback). 호출부 shape 안정화. */
export function emptyExecutionRoutingPlan(): ExecutionRoutingPlan {
  return {
    mode: "dry_run",
    roleKey: null,
    workspaceStage: null,
    items: [],
    findings: [],
  };
}

/** 빈 summary. */
export function emptyExecutionRoutingSummary(): ExecutionRoutingSummary {
  return {
    mode: "dry_run",
    total: 0,
    roles: 0,
    providers: 0,
    capabilities: 0,
    warnings: 0,
    enabledCount: 0,
    disabledCount: 0,
    findingsCount: 0,
  };
}

/** Execution Routing Plan → Summary 변환(read-only). */
export function summarizeExecutionRoutingPlan(
  plan: ExecutionRoutingPlan | null | undefined
): ExecutionRoutingSummary {
  if (!plan || plan.mode !== "dry_run" || !Array.isArray(plan.items)) {
    return emptyExecutionRoutingSummary();
  }
  const roles = new Set<string>();
  const providers = new Set<ExecutionProviderType>();
  const capabilities = new Set<ExecutionCapability>();
  let warnings = 0;
  let enabledCount = 0;
  let disabledCount = 0;
  for (const item of plan.items) {
    if (!item) continue;
    if (item.roleKey) roles.add(item.roleKey);
    providers.add(item.provider);
    capabilities.add(item.capability);
    if (item.warning && item.warning.length > 0) warnings += 1;
    if (item.enabled) enabledCount += 1;
    else disabledCount += 1;
  }
  return {
    mode: "dry_run",
    total: plan.items.length,
    roles: roles.size,
    providers: providers.size,
    capabilities: capabilities.size,
    warnings,
    enabledCount,
    disabledCount,
    findingsCount: plan.findings?.length ?? 0,
  };
}

/** 카탈로그 노출용: capability 전체 키 목록(정렬). */
export const EXECUTION_CAPABILITY_KEYS: readonly ExecutionCapability[] = [
  "analysis",
  "architecture_review",
  "code_generation",
  "code_review",
  "cursor_execution",
  "deployment_review",
  "design_review",
  "github_operation",
  "planning",
  "quality_review",
  "security_review",
];

/** 카탈로그 노출용: provider 전체 키 목록(정렬). */
export const EXECUTION_PROVIDER_KEYS: readonly ExecutionProviderType[] = [
  "cursor",
  "github",
  "openai",
  "unknown",
];
