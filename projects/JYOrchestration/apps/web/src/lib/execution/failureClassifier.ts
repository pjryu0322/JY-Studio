import { FAILURE_TYPES, type FailureType } from "@/lib/execution/failureTypes";

export function classifyFailure(input: {
  stage: string;
  message?: string | null;
  detailJson?: unknown;
}): FailureType {
  const { stage, message, detailJson } = input;

  const text = `${message || ""} ${JSON.stringify(detailJson || {})} ${stage}`.toLowerCase();

  if (text.includes("cursor_execution_failed")) {
    return FAILURE_TYPES.CURSOR_EXECUTION_FAILED;
  }

  if (text.includes("conflict")) {
    return FAILURE_TYPES.GIT_CONFLICT;
  }

  if (text.includes("git apply failed")) {
    return FAILURE_TYPES.GIT_APPLY_FAILED;
  }

  if (text.includes("pull request") && text.includes("failed")) {
    return FAILURE_TYPES.PR_CREATION_FAILED;
  }

  if (text.includes("403") || text.includes("unauthorized")) {
    return FAILURE_TYPES.AUTH_ERROR;
  }

  if (text.includes("timeout") || text.includes("network")) {
    return FAILURE_TYPES.NETWORK_ERROR;
  }

  return FAILURE_TYPES.UNKNOWN;
}

