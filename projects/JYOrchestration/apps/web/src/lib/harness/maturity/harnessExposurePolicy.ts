/**
 * Harness Phase H8 — **노출 정책**(사용자 / 운영자 / 내부).
 *
 * enforcement 없음. UI·문서·진단에서의 표시 수준 가이드.
 */

import type { HarnessExposureLevel, HarnessMaturityLayer } from "./harnessMaturityTypes";

/**
 * 계층별 기본 노출 수준(요약).
 *
 * | 영역 | 수준 |
 * | Message Explainability Summary | user_visible_summary |
 * | Prompt Timeline Overlay | operator_visible |
 * | Raw Prompt Preview | operator_visible |
 * | Diagnostic API | internal_only / operator_visible |
 * | Execution Safety Flags | user_visible_summary 가능 |
 * | Issue Planning 상세 | operator_visible |
 * | Raw JSON | internal_only |
 */
export function resolveHarnessExposureLevel(layer: HarnessMaturityLayer): HarnessExposureLevel {
  switch (layer) {
    case "message_explainability":
    case "execution_safety":
      return "user_visible_summary";
    case "prompt_assembly_preview":
    case "apply_readiness":
    case "knowledge_activation":
    case "memory_runtime":
    case "memory_stabilization":
    case "execution_routing":
    case "review_security":
    case "issue_planning":
      return "operator_visible";
  }
}
