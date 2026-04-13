/**
 * JYOrchestration — draft HTTP-style response envelopes for future route mapping (no server here).
 * Pure types + mappers from current application results; no controllers or routes.
 */

import type {
  GetReadinessResult,
  GetRunDetailResult,
  GetRunInspectionResult,
  GetRunSummaryResult,
  GetStepListResult,
  StartRunResult,
} from "./mvpExecutionContracts";
import type { MvpExecutionAppFailureCode } from "./mvpExecutionResultCodes";
import { MVP_EXECUTION_APP_CODE } from "./mvpExecutionResultCodes";

/** Human-readable copy for draft errors (stable for tests; not user-facing i18n yet). */
export const MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES: Record<MvpExecutionAppFailureCode, string> = {
  [MVP_EXECUTION_APP_CODE.NOT_READY]: "Project is not ready to start an execution run.",
  [MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND]: "No execution run exists for the given run id.",
  [MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID]: "projectId is required and cannot be blank.",
  [MVP_EXECUTION_APP_CODE.INVALID_RUN_ID]: "runId is required and cannot be blank.",
};

/** Suggested future JSON body: success. */
export type MvpRouteSuccessEnvelopeDraft = {
  success: true;
  appCode: typeof MVP_EXECUTION_APP_CODE.OK;
  /** Domain payload for the route (DTOs / view models only). */
  data: unknown;
  /** Optional stable message (e.g. for logs or generic API copy). */
  message?: string;
};

/** Suggested future JSON body: application-layer failure (before or without HTTP status). */
export type MvpRouteErrorEnvelopeDraft = {
  success: false;
  appCode: MvpExecutionAppFailureCode;
  message: string;
  /** Optional structured context (e.g. readiness DTO on NOT_READY). */
  data?: unknown;
};

export type MvpRouteEnvelopeDraft = MvpRouteSuccessEnvelopeDraft | MvpRouteErrorEnvelopeDraft;

function draftError(code: MvpExecutionAppFailureCode, data?: unknown): MvpRouteErrorEnvelopeDraft {
  return {
    success: false,
    appCode: code,
    message: MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[code],
    ...(data !== undefined ? { data } : {}),
  };
}

function draftOk(data: unknown, message?: string): MvpRouteSuccessEnvelopeDraft {
  return {
    success: true,
    appCode: MVP_EXECUTION_APP_CODE.OK,
    data,
    ...(message !== undefined ? { message } : {}),
  };
}

export function routeEnvelopeDraftFromGetReadinessResult(r: GetReadinessResult): MvpRouteEnvelopeDraft {
  if (r.ok) {
    return draftOk({ readiness: r.readiness });
  }
  return draftError(r.code);
}

export function routeEnvelopeDraftFromStartRunResult(r: StartRunResult): MvpRouteEnvelopeDraft {
  if (r.ok) {
    return draftOk({ runId: r.runId, readiness: r.readiness });
  }
  if (r.code === MVP_EXECUTION_APP_CODE.NOT_READY) {
    return draftError(r.code, { readiness: r.readiness });
  }
  return draftError(r.code);
}

export function routeEnvelopeDraftFromGetRunSummaryResult(r: GetRunSummaryResult): MvpRouteEnvelopeDraft {
  if (r.ok) {
    return draftOk({ summary: r.summary });
  }
  return draftError(r.code);
}

export function routeEnvelopeDraftFromGetRunDetailResult(r: GetRunDetailResult): MvpRouteEnvelopeDraft {
  if (r.ok) {
    return draftOk({ detail: r.detail });
  }
  return draftError(r.code);
}

export function routeEnvelopeDraftFromGetStepListResult(r: GetStepListResult): MvpRouteEnvelopeDraft {
  if (r.ok) {
    return draftOk({ steps: r.steps, stepFlowSummary: r.stepFlowSummary });
  }
  return draftError(r.code);
}

export function routeEnvelopeDraftFromGetRunInspectionResult(r: GetRunInspectionResult): MvpRouteEnvelopeDraft {
  if (r.ok) {
    return draftOk({ inspection: r.inspection });
  }
  return draftError(r.code);
}
