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
  | "runtime_lifecycle"
  | "runtime_coherence"
  | "runtime_planning_consolidated"
  | "runtime_planning_dependency"
  | "runtime_planning_criticality"
  | "runtime_planning_traceability"
  | "runtime_planning_reasoning"
  | "runtime_planning_semantic"
  | "runtime_planning_semantic_graph"
  | "runtime_planning_semantic_narrative"
  | "runtime_planning_semantic_vocabulary"
  | "runtime_planning_decision"
  | "runtime_planning_forecast"
  | "runtime_planning_resource"
  | "runtime_planning_resource_governance"
  | "runtime_planning_resource_allocation"
  | "runtime_planning_resource_trial"
  | "runtime_planning_control_boundary"
  | "runtime_planning_execution_candidate"
  | "runtime_planning_operator_approval_readiness"
  | "runtime_planning_controlled_runtime_pilot"
  | "runtime_planning_pilot_contract_adapter_boundary"
  | "runtime_planning_noop_runtime_adapter"
  | "runtime_planning_runtime_adapter_sandbox"
  | "runtime_planning_runtime_pilot_activation"
  | "runtime_planning_runtime_pilot_skeleton"
  | "runtime_planning_runtime_runner_invocation"
  | "runtime_planning_runtime_runner_noop_harness"
  | "runtime_planning_runtime_noop_execution_shell"
  | "runtime_planning_runtime_noop_execution_shell_harness"
  | "runtime_planning_runtime_noop_shell_hardening"
  | "runtime_planning_runtime_noop_shell_release_gate"
  | "runtime_planning_runtime_release_gate_preflight"
  | "runtime_planning_runtime_execution_boundary_shell"
  | "runtime_planning_runtime_execution_governance_boundary"
  | "runtime_planning_runtime_governance_release_readiness"
  | "runtime_planning_runtime_final_release_governance_gate"
  | "runtime_planning_runtime_ultimate_governance_review"
  | "runtime_planning_runtime_controlled_activation_candidate";

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
    case "runtime_coherence":
    case "runtime_planning_consolidated":
    case "runtime_planning_dependency":
    case "runtime_planning_criticality":
    case "runtime_planning_traceability":
    case "runtime_planning_reasoning":
    case "runtime_planning_semantic":
    case "runtime_planning_semantic_graph":
    case "runtime_planning_semantic_narrative":
    case "runtime_planning_semantic_vocabulary":
    case "runtime_planning_decision":
    case "runtime_planning_forecast":
    case "runtime_planning_resource":
    case "runtime_planning_resource_governance":
    case "runtime_planning_resource_allocation":
    case "runtime_planning_resource_trial":
    case "runtime_planning_control_boundary":
    case "runtime_planning_execution_candidate":
    case "runtime_planning_operator_approval_readiness":
    case "runtime_planning_controlled_runtime_pilot":
    case "runtime_planning_pilot_contract_adapter_boundary":
    case "runtime_planning_noop_runtime_adapter":
    case "runtime_planning_runtime_adapter_sandbox":
    case "runtime_planning_runtime_pilot_activation":
    case "runtime_planning_runtime_pilot_skeleton":
    case "runtime_planning_runtime_runner_invocation":
    case "runtime_planning_runtime_runner_noop_harness":
    case "runtime_planning_runtime_noop_execution_shell":
    case "runtime_planning_runtime_noop_execution_shell_harness":
    case "runtime_planning_runtime_noop_shell_hardening":
    case "runtime_planning_runtime_noop_shell_release_gate":
    case "runtime_planning_runtime_release_gate_preflight":
    case "runtime_planning_runtime_execution_boundary_shell":
    case "runtime_planning_runtime_execution_governance_boundary":
    case "runtime_planning_runtime_governance_release_readiness":
    case "runtime_planning_runtime_final_release_governance_gate":
    case "runtime_planning_runtime_ultimate_governance_review":
    case "runtime_planning_runtime_controlled_activation_candidate":
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
