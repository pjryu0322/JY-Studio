/**
 * H8 — SingleChat Message Explainability **사용자 노출** 정책 점검(read-only).
 *
 * UI 컴포넌트와 별도로 ViewModel 단계에서 요약·안전 속성을 검증한다.
 */

import type { MessageExplainabilityViewModel } from "./messageExplainabilityTypes";

const MAX_SUMMARY_LINES = 4;

export type MessageExplainabilityUserExposureCheck = Readonly<{
  ok: boolean;
  violations: readonly string[];
}>;

/**
 * H8 / H8.5 문서 기준: raw key 미노출(호출부 책임), summaryLines ≤4, 위험도·disclaimer 존재 등.
 */
export function checkMessageExplainabilityUserExposure(vm: MessageExplainabilityViewModel): MessageExplainabilityUserExposureCheck {
  const violations: string[] = [];
  if (!vm.disclaimer || !vm.disclaimer.trim()) violations.push("missing_disclaimer");
  if (vm.summaryLines.length > MAX_SUMMARY_LINES) violations.push("summary_lines_over_limit");
  if (!vm.headline?.trim()) violations.push("missing_headline");
  return {
    ok: violations.length === 0,
    violations,
  };
}
