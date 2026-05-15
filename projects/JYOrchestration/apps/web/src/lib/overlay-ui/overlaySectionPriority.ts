/**
 * H8.5 — Overlay 섹션 **표시 우선순위**(과밀 완화·접힘 정책의 입력).
 */

export type OverlaySectionPriority = "critical" | "important" | "normal" | "advanced" | "internal";

/** `OverlaySummaryCard` 및 연관 섹션 식별자. */
export type OverlaySectionKind =
  | "operator_runtime_summary"
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
  | "harness_prompt_preview";

export function resolveOverlaySectionPriority(section: OverlaySectionKind): OverlaySectionPriority {
  switch (section) {
    case "warning":
    case "execution_routing":
      return "critical";
    case "operator_runtime_summary":
    case "maturity_baseline":
      return "important";
    case "context":
    case "budget":
    case "knowledge_activation":
    case "memory_runtime":
      return "normal";
    case "review_security":
    case "review_security_issue":
    case "remediation_loop":
    case "assembly_plan":
    case "pruning":
    case "harness_prompt_preview":
      return "advanced";
  }
}
