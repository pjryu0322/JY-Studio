import type { PlanningOriginatedExecutionStatus } from "@jy-orch/application/public";

/** MVP 실행 단계 유형(`sequence:stepType`)의 `stepType` 표기 */
const MVP_EXECUTION_STEP_TYPE_KO: Readonly<Record<string, string>> = {
  PROMPT_GENERATED: "프롬프트 생성됨",
  CURSOR_SUBMITTED: "코딩 실행 요청 제출됨",
  CURSOR_FAILED: "코딩 실행 실패",
  CURSOR_COMPLETED: "코딩 실행 완료됨",
  GIT_VERIFIED: "저장소 변경 검증됨",
  GIT_FAILED: "저장소 변경 검증 실패",
  REVIEW_PASSED: "검토 통과",
  REVIEW_FAILED: "검토 실패",
  TASK_RETRY_SCHEDULED: "작업 재시도 예약됨",
  TASK_COMPLETED: "작업 완료됨",
  RUN_FAILED: "실행 실패",
  RUN_SUCCESS: "실행 성공",
};

/**
 * 실행 로그 `currentStep`(예: `12:PROMPT_GENERATED`)을 화면용 한글 한 줄로.
 * 원문은 `detailTitle`에 두고 `title` 등으로만 노출하는 것을 권장합니다.
 */
export function formatPlanningRunCurrentStepLineKo(currentStep: string | null | undefined): {
  readonly line: string;
  readonly detailTitle: string | null;
} {
  if (currentStep == null || currentStep === "") {
    return { line: "—", detailTitle: null };
  }
  const idx = currentStep.indexOf(":");
  if (idx <= 0) {
    return { line: "실행 로그 기록", detailTitle: currentStep };
  }
  const seq = currentStep.slice(0, idx).trim();
  const typ = currentStep.slice(idx + 1).trim();
  const typeKo = MVP_EXECUTION_STEP_TYPE_KO[typ];
  if (/^\d+$/.test(seq) && typeKo) {
    return { line: `${seq}번째 · ${typeKo}`, detailTitle: currentStep };
  }
  if (/^\d+$/.test(seq)) {
    return { line: `${seq}번째 실행 로그`, detailTitle: currentStep };
  }
  return { line: "실행 로그 기록", detailTitle: currentStep };
}

/** 계획 파이프라인 상태(문자열)를 화면 표기용 한글로 */
export function formatPlanningPipelineStatusKo(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  switch (value) {
    case "READY":
      return "준비됨";
    case "NEEDS_CONFIRMATION":
      return "확인 필요";
    case "BLOCKED":
      return "차단됨";
    default:
      return "알 수 없는 계획 상태";
  }
}

/** 계획 기반 실행 응답 상태 코드를 짧은 한글 표기로 */
export function formatPlanningOriginatedExecutionStatusKo(status: PlanningOriginatedExecutionStatus): string {
  switch (status) {
    case "BLOCKED":
      return "차단됨";
    case "NEEDS_CONFIRMATION":
      return "확인 필요";
    case "READY_FOR_EXECUTION":
      return "실행 준비됨";
    case "EXECUTION_STARTED":
      return "실행 중";
    case "EXECUTION_START_FAILED":
      return "실행 시작 실패";
    default: {
      const _e: never = status;
      return _e;
    }
  }
}
