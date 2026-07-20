/**
 * Provider-facing search-data status labels and messages (no state policy).
 */
import type {
  SearchDataUiState,
} from "@/lib/search-data/search-data-state-types";
import type { SearchDataFailureGuidance } from "@/lib/search-data/search-data-error";

export function searchDataModelLabel(model: string): string {
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

/** Tab badge / statusLabel for the 검색검증 step. */
export function searchDataTabStatusLabel(state: SearchDataUiState): string {
  switch (state) {
    case "NOT_CREATED":
      return "시작 전";
    case "CREATING":
    case "VALIDATING":
      return "진행 중";
    case "CREATE_FAILED":
    case "VALIDATION_FAILED":
    case "STALE":
      return "보완 필요";
    case "CREATED":
      return "검증 필요";
    case "VALIDATED":
      return "완료";
  }
}

export function resolveSearchDataStatusMessage(input: {
  state: SearchDataUiState;
  structurePassed: boolean;
  rankingPolicyStale: boolean;
  overrideMessage?: string;
  createFailedGuidance?: SearchDataFailureGuidance | null;
}): string | undefined {
  if (input.overrideMessage) return input.overrideMessage;

  if (input.state === "CREATE_FAILED" && input.createFailedGuidance) {
    return input.createFailedGuidance.message;
  }

  switch (input.state) {
    case "STALE":
      return input.structurePassed
        ? "자료 또는 구조화 결과가 변경되었습니다. 데이터 구조화를 다시 실행해 주세요."
        : "데이터 구조화가 완료되지 않았습니다.";
    case "NOT_CREATED":
      return "현재 구조화 결과로 생성된 검색데이터가 없습니다.";
    case "CREATING":
      return "검색데이터를 생성하는 중입니다.";
    case "CREATE_FAILED":
      return "검색데이터 생성에 실패했습니다.";
    case "CREATED":
      return "검색데이터 생성이 완료되었습니다.";
    case "VALIDATING":
      return "검색 품질을 검증하는 중입니다.";
    case "VALIDATION_FAILED":
      return "검색 품질이 기준을 충족하지 못했습니다.";
    case "VALIDATED":
      return input.rankingPolicyStale
        ? "검색 순위 정책이 변경되었습니다. 자동 검색 평가를 다시 실행해 주세요."
        : "검색 품질 검증이 완료되었습니다.";
  }
}

export function resolveValidationSummaryStatus(input: {
  rankingPolicyStale: boolean;
  evaluationStepStatus?: string | null;
}): "PASS" | "FAIL" | "WARNING" | "RUNNING" | "NONE" {
  if (input.rankingPolicyStale) return "WARNING";
  if (input.evaluationStepStatus === "PASS") return "PASS";
  if (input.evaluationStepStatus === "FAIL") return "FAIL";
  if (input.evaluationStepStatus === "WARNING") return "WARNING";
  if (input.evaluationStepStatus === "RUNNING") return "RUNNING";
  return "NONE";
}
