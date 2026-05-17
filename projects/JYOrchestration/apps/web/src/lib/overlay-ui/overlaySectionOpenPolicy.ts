/**
 * H8.5 — compact / narrow / audience에 따른 **섹션 기본 펼침·DOM 생략** 정책.
 */

import type { OverlayAudienceMode } from "./overlayAudienceTypes";
import { resolveOverlaySectionPriority, type OverlaySectionKind } from "./overlaySectionPriority";
import { isOverlaySectionVisibleForAudience } from "./resolveOverlayAudienceVisibility";

export type OverlaySectionUiPolicy = Readonly<{
  defaultOpen: boolean;
  /** true면 섹션 자체를 렌더하지 않음(모바일+compact에서 advanced 축소). */
  omitFromDom: boolean;
}>;

export function resolveOverlaySectionUiPolicy(input: {
  readonly section: OverlaySectionKind;
  readonly baseDefaultOpen: boolean;
  readonly compactMode: boolean;
  readonly isNarrow: boolean;
  readonly audience: OverlayAudienceMode;
}): OverlaySectionUiPolicy {
  if (!isOverlaySectionVisibleForAudience(input.section, input.audience)) {
    return { defaultOpen: false, omitFromDom: true };
  }

  const p = resolveOverlaySectionPriority(input.section);
  let defaultOpen = input.baseDefaultOpen;
  let omitFromDom = false;

  if (input.compactMode) {
    if (p === "critical" || p === "important") {
      defaultOpen = true;
    } else if (p === "advanced" || p === "internal") {
      defaultOpen = false;
      if (input.isNarrow) omitFromDom = true;
    }
    if (
      input.isNarrow &&
      (input.section === "runtime_trial" ||
        input.section === "runtime_governance" ||
        input.section === "runtime_enforcement_candidate" ||
        input.section === "controlled_enforcement_governance" ||
        input.section === "runtime_lifecycle" ||
        input.section === "runtime_coherence" ||
        input.section === "runtime_planning_dependency" ||
        input.section === "runtime_planning_criticality" ||
        input.section === "runtime_planning_traceability" ||
        input.section === "runtime_planning_reasoning" ||
        input.section === "runtime_planning_semantic" ||
        input.section === "runtime_planning_semantic_graph" ||
        input.section === "runtime_planning_semantic_narrative" ||
        input.section === "runtime_planning_semantic_vocabulary" ||
        input.section === "runtime_planning_decision" ||
        input.section === "runtime_planning_forecast" ||
        input.section === "runtime_planning_resource" ||
        input.section === "runtime_planning_resource_governance" ||
        input.section === "runtime_planning_resource_allocation" ||
        input.section === "runtime_planning_resource_trial" ||
        input.section === "runtime_planning_control_boundary" ||
        input.section === "runtime_planning_execution_candidate" ||
        input.section === "runtime_planning_operator_approval_readiness" ||
        input.section === "runtime_planning_controlled_runtime_pilot" ||
        input.section === "runtime_planning_pilot_contract_adapter_boundary" ||
        input.section === "runtime_planning_noop_runtime_adapter" ||
        input.section === "runtime_planning_runtime_adapter_sandbox" ||
        input.section === "runtime_planning_runtime_pilot_activation" ||
        input.section === "runtime_planning_runtime_pilot_skeleton" ||
        input.section === "runtime_planning_runtime_runner_invocation" ||
        input.section === "runtime_planning_runtime_runner_noop_harness" ||
        input.section === "runtime_planning_runtime_noop_execution_shell" ||
        input.section === "runtime_planning_runtime_noop_execution_shell_harness" ||
        input.section === "runtime_planning_runtime_noop_shell_hardening" ||
        input.section === "runtime_planning_runtime_noop_shell_release_gate" ||
        input.section === "runtime_planning_runtime_release_gate_preflight" ||
        input.section === "runtime_planning_runtime_execution_boundary_shell" ||
        input.section === "runtime_planning_runtime_execution_governance_boundary" ||
        input.section === "runtime_planning_runtime_governance_release_readiness")
    ) {
      omitFromDom = true;
      defaultOpen = false;
    }
  }

  return { defaultOpen, omitFromDom };
}
