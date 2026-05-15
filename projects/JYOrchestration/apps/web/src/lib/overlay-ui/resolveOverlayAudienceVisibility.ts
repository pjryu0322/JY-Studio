/**
 * H8.5 — audience별 Overlay **섹션 노출** 여부.
 */

import type { OverlayAudienceMode } from "./overlayAudienceTypes";
import type { OverlaySectionKind } from "./overlaySectionPriority";

/**
 * - `user`: 경고·안전·성숙도·요약 중심(세부 harness·raw·replay 성격 섹션 숨김; context/budget도 숨김).
 * - `operator` / `internal`: 전 섹션 표시(내부 전용 raw JSON은 본 카드에서 원래 비노출).
 */
export function isOverlaySectionVisibleForAudience(
  section: OverlaySectionKind,
  audience: OverlayAudienceMode
): boolean {
  if (audience !== "user") return true;
  switch (section) {
    case "operator_runtime_summary":
    case "warning":
    case "execution_routing":
    case "maturity_baseline":
      return true;
    default:
      return false;
  }
}
