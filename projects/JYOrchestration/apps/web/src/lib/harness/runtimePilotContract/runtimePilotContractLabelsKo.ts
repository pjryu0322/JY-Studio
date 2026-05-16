/**
 * H24.5 — Overlay·진단용 한국어 라벨(read-only).
 */

import type { RuntimeAdapterBoundaryMode, RuntimePilotContractReadiness } from "./runtimePilotContractTypes";

export const RUNTIME_PILOT_CONTRACT_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 runtime adapter 호출이 아니라, controlled pilot을 향후 runtime으로 넘기기 위한 계약과 no-op boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_PILOT_CONTRACT_READINESS_LABEL_KO: Record<RuntimePilotContractReadiness, string> = {
  not_ready: "pilot contract 메타 미준비",
  contract_metadata_ready: "contract 메타 작성 가능(실행·adapter 호출 없음)",
  watch: "contract 메타 주시(adapter 호출 없음)",
  blocked: "contract·handoff 차단(adapter 호출 없음)",
};

export const RUNTIME_ADAPTER_BOUNDARY_MODE_LABEL_KO: Record<RuntimeAdapterBoundaryMode, string> = {
  no_op_only: "no-op boundary만(실제 adapter 호출 없음)",
  contract_metadata_only: "contract 메타만(실제 adapter 호출 없음)",
  handoff_blocked: "handoff 차단(실제 adapter 호출 없음)",
};
