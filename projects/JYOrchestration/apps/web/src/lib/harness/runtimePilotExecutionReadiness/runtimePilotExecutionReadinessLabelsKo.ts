/**
 * H44 / H44.5 — pilot execution readiness overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimePilotExecutionReadinessAlignmentStatus,
  RuntimePilotExecutionReadinessFinalGateStatus,
  RuntimePilotExecutionReadinessMode,
  RuntimePilotExecutionReadinessStatus,
  RuntimePilotExecutionReadinessVerificationStatus,
} from "./runtimePilotExecutionReadinessTypes";

export const RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 pilot activation/execution이 아니라, pilot execution readiness boundary를 설명하는 read-only metadata입니다.";

export const RUNTIME_PILOT_EXECUTION_READINESS_OVERLAY_FOOTER_KO =
  "actual pilot activation·pilot execution·runner invocation·adapter invocation·sandbox invocation·execution·routing·queue control·rollback·release/approval enforcement·blocking·prompt 변경은 없습니다.";

export const RUNTIME_PILOT_EXECUTION_READINESS_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotExecutionReadinessStatus, string>
> = {
  not_ready: "미준비",
  pilot_execution_readiness_metadata_ready: "pilot execution readiness 메타 준비",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_PILOT_EXECUTION_READINESS_MODE_LABEL_KO: Readonly<
  Record<RuntimePilotExecutionReadinessMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_PILOT_EXECUTION_READINESS_FINAL_GATE_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotExecutionReadinessFinalGateStatus, string>
> = {
  ready_metadata: "ready(메타)",
  watch: "주시",
  blocked: "차단",
  not_ready: "미준비",
};

export const RUNTIME_PILOT_EXECUTION_READINESS_VERIFICATION_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotExecutionReadinessVerificationStatus, string>
> = {
  verified_metadata: "verified(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_PILOT_EXECUTION_READINESS_ALIGNMENT_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotExecutionReadinessAlignmentStatus, string>
> = {
  aligned_metadata: "aligned(메타)",
  partial: "부분",
  failed: "실패",
};

export const RUNTIME_PILOT_EXECUTION_READINESS_EMPTY_HINT_KO = {
  boundary: "pilot execution readiness boundary 행 없음",
  inputEnvelope: "input envelope 행 없음",
  outputEnvelope: "output envelope 행 없음",
  noExecutionProof: "final no-execution proof 행 없음",
  forbiddenProof: "final execution-forbidden proof 행 없음",
  violation: "pilot execution readiness violation이 없습니다.",
  verification: "readiness verification finding이 없습니다.",
  alignment: "alignment finding이 없습니다.",
  finalGateChecklist: "final safety gate checklist 행 없음",
  checklist: "checklist 행 없음",
  blockers: "blocker 없음",
} as const;
