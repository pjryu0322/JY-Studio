/**
 * Provider "검색데이터 생성·검증" step display state — UI only.
 * Does not change server gates; aligns tab labels, guidance, and CTAs.
 */

import type { SearchDataUiState } from "@/lib/search-data/search-data-state";

export type SearchValidationStepDisplayState =
  | "NOT_STARTED"
  | "GENERATING"
  | "AUTO_EVALUATION_REQUIRED"
  | "SERVICE_REVALIDATION_REQUIRED"
  | "PROVIDER_REVIEW_REQUIRED"
  | "COMPLETED"
  | "FAILED";

export type SearchValidationChannelSnapshot = {
  systemStatus: string;
  currentValidity?: string | null;
  providerConfirmationStatus?: string | null;
};

export type SearchValidationPrimaryAction =
  | "GENERATE"
  | "RETRY_GENERATE"
  | "VALIDATE"
  | "REVALIDATE_AUTO"
  | "RUN_SERVICE_SEARCH"
  | "CONFIRM_QUALITY"
  | "GO_DISTRIBUTION"
  | "NONE";

const DISPLAY_LABEL: Record<SearchValidationStepDisplayState, string> = {
  NOT_STARTED: "시작 전",
  GENERATING: "생성 중",
  AUTO_EVALUATION_REQUIRED: "자동 평가 필요",
  SERVICE_REVALIDATION_REQUIRED: "재검증 필요",
  PROVIDER_REVIEW_REQUIRED: "품질 확인 필요",
  COMPLETED: "완료",
  FAILED: "확인 필요",
};

/** Short mobile-friendly status text for step tabs. */
const DISPLAY_LABEL_SHORT: Record<SearchValidationStepDisplayState, string> = {
  NOT_STARTED: "시작 전",
  GENERATING: "생성 중",
  AUTO_EVALUATION_REQUIRED: "자동 평가 필요",
  SERVICE_REVALIDATION_REQUIRED: "재검증 필요",
  PROVIDER_REVIEW_REQUIRED: "품질 확인 필요",
  COMPLETED: "완료",
  FAILED: "확인 필요",
};

function channelReady(channel: SearchValidationChannelSnapshot | null | undefined): boolean {
  if (!channel) return false;
  return (
    channel.systemStatus === "PASS" &&
    (channel.currentValidity == null || channel.currentValidity === "CURRENT") &&
    channel.providerConfirmationStatus === "CONFIRMED"
  );
}

function channelNeedsRevalidation(
  channel: SearchValidationChannelSnapshot | null | undefined,
): boolean {
  if (!channel) return true;
  if (channel.systemStatus === "STALE") return true;
  if (channel.systemStatus !== "PASS") return true;
  if (channel.currentValidity === "STALE") return true;
  return false;
}

function channelNeedsProviderReview(
  channel: SearchValidationChannelSnapshot | null | undefined,
): boolean {
  if (!channel) return true;
  if (channelNeedsRevalidation(channel)) return false;
  return channel.providerConfirmationStatus !== "CONFIRMED";
}

/**
 * Single source for step-4 tab badge / progress label.
 * COMPLETED only when generation + auto-eval (current policy) + all preparation
 * channels are PASS/CURRENT/CONFIRMED (including DOWNLOAD).
 */
export function resolveSearchValidationStepDisplayState(input: {
  searchDataState: SearchDataUiState | string | null | undefined;
  rankingPolicyStale?: boolean;
  canRunServiceValidation?: boolean;
  api?: SearchValidationChannelSnapshot | null;
  mcp?: SearchValidationChannelSnapshot | null;
  download?: SearchValidationChannelSnapshot | null;
}): SearchValidationStepDisplayState {
  const state = input.searchDataState ?? "NOT_CREATED";
  const rankingPolicyStale = Boolean(input.rankingPolicyStale);

  if (state === "CREATE_FAILED" || state === "VALIDATION_FAILED" || state === "STALE") {
    return "FAILED";
  }
  if (state === "CREATING" || state === "VALIDATING") {
    return "GENERATING";
  }
  if (state === "NOT_CREATED") {
    return "NOT_STARTED";
  }
  if (state === "CREATED" || rankingPolicyStale) {
    return "AUTO_EVALUATION_REQUIRED";
  }

  // VALIDATED + current ranking policy
  if (state === "VALIDATED") {
    const api = input.api;
    const mcp = input.mcp;
    const download = input.download;

    if (
      channelNeedsRevalidation(api) ||
      channelNeedsRevalidation(mcp) ||
      channelNeedsRevalidation(download)
    ) {
      return "SERVICE_REVALIDATION_REQUIRED";
    }
    if (
      channelNeedsProviderReview(api) ||
      channelNeedsProviderReview(mcp) ||
      channelNeedsProviderReview(download)
    ) {
      return "PROVIDER_REVIEW_REQUIRED";
    }
    if (channelReady(api) && channelReady(mcp) && channelReady(download)) {
      return "COMPLETED";
    }
    return "SERVICE_REVALIDATION_REQUIRED";
  }

  return "NOT_STARTED";
}

export function searchValidationStepStatusLabel(
  display: SearchValidationStepDisplayState,
  opts?: { short?: boolean },
): string {
  return opts?.short ? DISPLAY_LABEL_SHORT[display] : DISPLAY_LABEL[display];
}

/** Maps display state to registration-style status for tab badges. */
export function searchValidationStepRegistrationStatus(
  display: SearchValidationStepDisplayState,
): "COMPLETED" | "IN_PROGRESS" | "WARNING" | "STALE" | "NOT_STARTED" {
  switch (display) {
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "WARNING";
    case "NOT_STARTED":
      return "NOT_STARTED";
    case "GENERATING":
    case "AUTO_EVALUATION_REQUIRED":
    case "SERVICE_REVALIDATION_REQUIRED":
    case "PROVIDER_REVIEW_REQUIRED":
      return "IN_PROGRESS";
  }
}

export function resolveSearchValidationPrimaryAction(input: {
  displayState: SearchValidationStepDisplayState;
  searchDataState?: SearchDataUiState | string | null;
}): SearchValidationPrimaryAction {
  switch (input.displayState) {
    case "NOT_STARTED":
      return "GENERATE";
    case "GENERATING":
      return "NONE";
    case "FAILED":
      return input.searchDataState === "CREATE_FAILED" ? "RETRY_GENERATE" : "VALIDATE";
    case "AUTO_EVALUATION_REQUIRED":
      return input.searchDataState === "CREATED" ? "VALIDATE" : "REVALIDATE_AUTO";
    case "SERVICE_REVALIDATION_REQUIRED":
      return "RUN_SERVICE_SEARCH";
    case "PROVIDER_REVIEW_REQUIRED":
      return "CONFIRM_QUALITY";
    case "COMPLETED":
      return "GO_DISTRIBUTION";
  }
}

export function resolveSearchValidationGuidance(input: {
  displayState: SearchValidationStepDisplayState;
  rankingPolicyStale?: boolean;
}): { title: string; body: string[] } {
  switch (input.displayState) {
    case "AUTO_EVALUATION_REQUIRED":
      if (input.rankingPolicyStale) {
        return {
          title: "검색 순위 정책이 변경되었습니다",
          body: [
            "검색데이터 생성은 완료되었습니다.",
            "검색 순위 정책이 변경되어 자동 검색 평가만 다시 실행하면 됩니다.",
            "기존 Chunk와 Vector는 유지됩니다.",
          ],
        };
      }
      return {
        title: "자동 검색 평가가 필요합니다",
        body: [
          "검색데이터 생성은 완료되었습니다.",
          "자동 검색 평가를 실행한 뒤 API·MCP 검색검증을 진행해 주세요.",
        ],
      };
    case "SERVICE_REVALIDATION_REQUIRED":
      return {
        title: "API·MCP 재검색이 필요합니다",
        body: [
          "자동 검색 평가가 완료되었습니다.",
          "API와 MCP 검색을 다시 실행해 현재 정책으로 검색 결과를 확인해 주세요.",
        ],
      };
    case "PROVIDER_REVIEW_REQUIRED":
      return {
        title: "검색 결과 품질 확인이 필요합니다",
        body: [
          "현재 검색 정책으로 API와 MCP 검색이 완료되었습니다.",
          "검색 결과를 확인하고 적절함 또는 보완 필요를 선택해 주세요.",
        ],
      };
    case "COMPLETED":
      return {
        title: "검색데이터 생성·검증이 완료되었습니다",
        body: [
          "검색데이터 생성, 자동 평가, API·MCP 검색검증과 제공자 품질 확인이 완료되었습니다.",
          "유통정보 입력과 검수요청을 진행할 수 있습니다.",
        ],
      };
    case "FAILED":
      return {
        title: "확인이 필요합니다",
        body: ["검색데이터 생성 또는 자동 평가에 문제가 있습니다. 안내를 확인해 주세요."],
      };
    case "GENERATING":
      return {
        title: "처리 중입니다",
        body: ["완료될 때까지 잠시만 기다려 주세요."],
      };
    case "NOT_STARTED":
    default:
      return {
        title: "검색데이터를 생성해 주세요",
        body: ["데이터 구조화 결과로 검색데이터(Chunk·Vector)를 생성합니다."],
      };
  }
}

export type SearchValidationWorkStep = {
  id: "auto_eval" | "service_search" | "provider_review";
  label: string;
  status: "done" | "current" | "waiting";
};

export function resolveSearchValidationWorkSteps(
  displayState: SearchValidationStepDisplayState,
): SearchValidationWorkStep[] {
  let auto: SearchValidationWorkStep["status"] = "waiting";
  let service: SearchValidationWorkStep["status"] = "waiting";
  let review: SearchValidationWorkStep["status"] = "waiting";

  switch (displayState) {
    case "AUTO_EVALUATION_REQUIRED":
    case "FAILED":
    case "NOT_STARTED":
    case "GENERATING":
      auto = displayState === "AUTO_EVALUATION_REQUIRED" || displayState === "FAILED"
        ? "current"
        : "waiting";
      break;
    case "SERVICE_REVALIDATION_REQUIRED":
      auto = "done";
      service = "current";
      break;
    case "PROVIDER_REVIEW_REQUIRED":
      auto = "done";
      service = "done";
      review = "current";
      break;
    case "COMPLETED":
      auto = "done";
      service = "done";
      review = "done";
      break;
  }

  return [
    { id: "auto_eval", label: "자동 평가 다시 실행", status: auto },
    { id: "service_search", label: "API·MCP 검색 다시 실행", status: service },
    { id: "provider_review", label: "검색 결과 품질 확인", status: review },
  ];
}

/**
 * Why step 5 (유통정보·검수요청) is locked — mirrors server readiness without changing gates.
 */
export function resolveDistributionStepLockMessage(input: {
  displayState: SearchValidationStepDisplayState;
  structurePassed?: boolean;
  searchFoundationPassed?: boolean;
  allPreparationChannelsPassed?: boolean;
  searchValidationStale?: boolean;
}): string | null {
  if (input.structurePassed === false) {
    return "데이터 구조화가 완료되지 않았습니다.";
  }
  if (input.searchFoundationPassed === false) {
    return "검색 인덱스·검색 평가가 완료되지 않았습니다.";
  }
  if (input.searchValidationStale) {
    return "검색 검증 증적이 현재 자료와 일치하지 않습니다. 다시 검증해 주세요.";
  }

  switch (input.displayState) {
    case "COMPLETED":
      return null;
    case "AUTO_EVALUATION_REQUIRED":
    case "NOT_STARTED":
    case "GENERATING":
    case "FAILED":
      return "자동 평가 재실행이 필요합니다.";
    case "SERVICE_REVALIDATION_REQUIRED":
      return "API·MCP 검색검증이 필요합니다.";
    case "PROVIDER_REVIEW_REQUIRED":
      return "검색 결과 품질 확인이 필요합니다.";
    default:
      if (input.allPreparationChannelsPassed === false) {
        return "API·MCP·DOWNLOAD 검증 결과를 제공자가 확인하지 않았습니다.";
      }
      return "자동 평가, API·MCP 검색검증, 제공자 품질 확인을 완료하면 열립니다.";
  }
}

/** Banner when SEARCH_DATA_NOT_READY but generation is already VALIDATED/policy stale. */
export function resolveSearchDataNotReadyBanner(input: {
  rankingPolicyStale: boolean;
  searchDataState: string | null | undefined;
}): string {
  if (input.rankingPolicyStale || input.searchDataState === "VALIDATED") {
    return "검색데이터 생성은 완료되었습니다. 자동 검색 평가를 다시 실행해 주세요.";
  }
  if (input.searchDataState === "CREATED") {
    return "검색데이터 생성은 완료되었습니다. 자동 검색 평가를 실행해 주세요.";
  }
  return "검색데이터 생성과 자동 평가를 먼저 완료해 주세요.";
}

export function isRankingPolicyStaleRun(channel: {
  systemStatus: string;
  currentValidity?: string | null;
}): boolean {
  return channel.systemStatus === "STALE" || channel.currentValidity === "STALE";
}
