/**
 * H10 — Maturity layer id → 운영자 표시 라벨.
 */

import type { HarnessMaturityLayer } from "@/lib/harness/maturity/harnessMaturityTypes";

const LABELS: Readonly<Record<HarnessMaturityLayer, string>> = {
  prompt_assembly_preview: "프롬프트 조립 미리보기",
  apply_readiness: "적용 준비도",
  knowledge_activation: "지식 활성화",
  memory_runtime: "메모리 런타임",
  memory_stabilization: "메모리 안정화",
  execution_routing: "실행 라우팅",
  execution_safety: "실행 안전",
  review_security: "리뷰/보안",
  issue_planning: "이슈 계획",
  message_explainability: "메시지 설명가능성",
};

export function runtimeTrialHarnessLayerLabelKo(layer: HarnessMaturityLayer): string {
  return LABELS[layer] ?? layer;
}
