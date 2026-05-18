/**
 * H22 — trial layer **표시 라벨**(read-only).
 */

import type { RuntimeResourceTrialConsistency, RuntimeResourceTrialMode } from "./runtimeResourceTrialTypes";

export const RUNTIME_RESOURCE_TRIAL_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 allocation trial 실행이 아니라, read-only dry-run trial readiness metadata입니다.";

export const RUNTIME_RESOURCE_TRIAL_MODE_LABEL_KO: Readonly<Record<RuntimeResourceTrialMode, string>> = {
  not_applicable: "Trial 해당 없음",
  dry_run_ready: "Dry-run 준비(메타)",
  dry_run_watch: "Dry-run 관찰",
  dry_run_blocked: "Dry-run 차단",
};

export const RUNTIME_RESOURCE_TRIAL_CONSISTENCY_LABEL_KO: Readonly<Record<RuntimeResourceTrialConsistency, string>> = {
  consistent: "일관",
  watch: "주시",
  drift_detected: "Drift 감지",
  blocked: "차단",
};
