/**
 * Pilot Validation Phase 0 — Korean labels.
 */

import type { RuntimePilotValidationReadOnlyChainStatus } from "./runtimePilotValidationTypes";

export const RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 pilot execution이 아니라, H20.5~H45.5 read-only chain이 pilot validation entry 준비 상태인지 보여주는 검증 요약입니다.";

export const RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_OVERLAY_FOOTER_KO =
  "actual pilot activation·pilot execution·runner invocation·adapter invocation·sandbox invocation·execution·routing·queue control·rollback·release/approval enforcement·blocking·prompt 변경은 없습니다.";

export const RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotValidationReadOnlyChainStatus, string>
> = {
  ready_for_validation: "파일럿 검증 준비됨",
  watch: "주의 확인 필요",
  blocked: "파일럿 검증 차단",
  not_ready: "준비되지 않음",
};

export const RUNTIME_PILOT_VALIDATION_READ_ONLY_CHAIN_EMPTY_HINT_KO = {
  topBlocker: "차단 항목 없음",
  topWarning: "주의 항목 없음",
  finalProof: "proof 요약 없음",
  recommendation: "권고 없음",
} as const;
