/**
 * H8.5 — Overlay 섹션 **표시 우선순위**(과밀 완화·접힘 정책의 입력).
 */

export type OverlaySectionPriority = "critical" | "important" | "normal" | "advanced" | "internal";

/** `OverlaySummaryCard` 및 연관 섹션 식별자. */
export type OverlaySectionKind =
  | "operator_runtime_summary"
  | "operator_resource_summary"
  | "warning"
  | "execution_routing"
  | "maturity_baseline"
  | "context"
  | "budget"
  | "knowledge_activation"
  | "memory_runtime"
  | "review_security"
  | "review_security_issue"
  | "remediation_loop"
  | "assembly_plan"
  | "pruning"
  | "harness_prompt_preview"
  | "resource_orchestration"
  | "runtime_trial"
  | "runtime_governance"
  | "runtime_enforcement_candidate"
  | "controlled_enforcement_governance"
  | "runtime_stability"
  | "runtime_priority"
  | "runtime_lifecycle";

export function resolveOverlaySectionPriority(section: OverlaySectionKind): OverlaySectionPriority {
  switch (section) {
    /** 경고 + 실행 라우팅(안전 요약 포함) — 사용자 뷰에서도 critical 유지. */
    case "warning":
    case "execution_routing":
      return "critical";
    case "operator_runtime_summary":
    case "operator_resource_summary":
    case "maturity_baseline":
    case "runtime_stability":
    case "runtime_priority":
    case "runtime_lifecycle":
      return "important";
    case "context":
    case "budget":
    case "resource_orchestration":
    case "runtime_trial":
    case "runtime_governance":
    case "runtime_enforcement_candidate":
    case "controlled_enforcement_governance":
    case "knowledge_activation":
    case "memory_runtime":
      return "normal";
    case "review_security":
    case "review_security_issue":
    case "remediation_loop":
      return "advanced";
    /** Raw harness replay / assembly 진단 — `advanced`와 동일한 compact·narrow 정책이지만 의미상 내부 raw에 가깝다. */
    case "assembly_plan":
    case "pruning":
    case "harness_prompt_preview":
      return "internal";
  }
}
