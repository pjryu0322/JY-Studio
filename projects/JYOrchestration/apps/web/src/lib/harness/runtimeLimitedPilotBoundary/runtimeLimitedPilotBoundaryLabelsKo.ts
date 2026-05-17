/**
 * H42 — limited pilot boundary overlay·진단 **한국어 라벨**(read-only).
 */

import type {
  RuntimeLimitedPilotBoundaryCandidateStatus,
  RuntimeLimitedPilotBoundaryMode,
} from "./runtimeLimitedPilotBoundaryTypes";

export const RUNTIME_LIMITED_PILOT_BOUNDARY_SECTION_DISCLAIMER_KO =
  "이 정보는 실제 pilot activation/execution이 아니라, limited controlled runtime pilot boundary 후보를 설명하는 read-only metadata입니다.";

export const RUNTIME_LIMITED_PILOT_BOUNDARY_OVERLAY_FOOTER_KO =
  "actual orchestration·activation·pilot activation·pilot execution·runner invocation·adapter invocation·sandbox invocation·execution·routing·queue control·rollback·release/approval enforcement·blocking·prompt 변경은 없습니다.";

export const RUNTIME_LIMITED_PILOT_BOUNDARY_STATUS_LABEL_KO: Readonly<
  Record<RuntimeLimitedPilotBoundaryCandidateStatus, string>
> = {
  not_candidate: "미후보",
  limited_pilot_boundary_metadata_candidate: "limited pilot boundary 메타 후보",
  watch: "주시",
  blocked: "차단",
};

export const RUNTIME_LIMITED_PILOT_BOUNDARY_MODE_LABEL_KO: Readonly<
  Record<RuntimeLimitedPilotBoundaryMode, string>
> = {
  disabled: "비활성(메타)",
  metadata_only: "메타만",
  blocked: "차단",
};

export const RUNTIME_LIMITED_PILOT_BOUNDARY_EMPTY_HINT_KO = {
  pilotScope: "pilot boundary scope 행이 없습니다.",
  forbiddenOperation: "금지 pilot operation이 없습니다.",
  inputContract: "pilot input contract 행이 없습니다.",
  outputContract: "pilot output contract 행이 없습니다.",
  checklist: "pilot readiness checklist 행이 없습니다.",
  missingChecklist: "누락 checklist 행이 없습니다.",
  blocker: "pilot boundary blocker가 없습니다.",
  recommendation: "권장 사항이 없습니다.",
} as const;
