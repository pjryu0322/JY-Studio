/**
 * Pilot Validation Phase 1 — 사용자 화면용 문구(H단계명 미노출).
 */

import type { RuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationTypes";

export const PILOT_VALIDATION_USER_PANEL_TITLE_KO = "제한된 파일럿 검증 준비 상태";

export const PILOT_VALIDATION_USER_PANEL_DESCRIPTION_KO =
  "이 화면은 실제 실행이 아니라, 파일럿 검증을 시작할 수 있는 준비 상태를 보여줍니다. 실제 소스 변경, Git Push, PR Merge, 배포, DB 변경, runner 실행은 수행되지 않습니다.";

export const PILOT_VALIDATION_USER_STATUS_LABEL_KO: Readonly<
  Record<RuntimePilotValidationReadOnlyChainStatus, string>
> = {
  ready_for_validation: "파일럿 검증 준비됨",
  watch: "주의 확인 필요",
  blocked: "파일럿 검증 차단",
  not_ready: "아직 준비되지 않음",
};

export const PILOT_VALIDATION_USER_EXECUTION_SCOPE_KO =
  "제한된 파일럿 검증(메타데이터만, 실제 pilot activation·execution 없음)";

export const PILOT_VALIDATION_DRY_RUN_ONLY_NOTICE_KO =
  "아직 실제 파일럿 실행은 연결되지 않았습니다. 현재는 Safe Echo 검증 계약(metadata) 준비 상태만 확인합니다.";

export const PILOT_VALIDATION_SAFE_ECHO_VALIDATION_MODE_KO =
  "Safe Echo Contract only (실제 adapter/sandbox/runner 호출 없음)";
