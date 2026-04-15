/**
 * Planning-originated execution (web client) adapter.
 *
 * UI calls the **route only** (`POST /api/jy-orchestration/planning-execution`).
 * The route calls the **application facade only**, and returns the normalized response contract.
 *
 * This keeps raw internal bundles (handoff, preparation, bridge inputs, seed payloads) intentionally hidden from the UI.
 */

"use client";

import type { PlanningOriginatedExecutionMode } from "@jy-orch/application/planningOriginatedExecution/planningOriginatedExecutionContracts";
import {
  buildPlanningExecutionScreenViewModel,
  buildPlanningOriginatedExecutionViewModel,
  normalizePlanningOriginatedExecutionResponse,
  type PlanningExecutionScreenViewModel,
  type PlanningOriginatedExecutionResponse,
} from "@jy-orch/application/public";
import { RBAC_FORBIDDEN_CODE } from "@/lib/rbac/projectAccessDenied";

const ROUTE = "/api/jy-orchestration/planning-execution" as const;

export type RunPlanningOriginatedExecutionRequest = Readonly<{
  projectId: string;
  inputText: string;
  mode: PlanningOriginatedExecutionMode;
  /**
   * In non-production the backend accepts `x-mock-user-id` for manual testing.
   * Leave unset for normal UI usage.
   */
  mockUserId?: string | null;
}>;

export type RunPlanningOriginatedExecutionResult =
  | {
      readonly status: "success";
      readonly response: PlanningOriginatedExecutionResponse;
      readonly screen: PlanningExecutionScreenViewModel;
    }
  | { readonly status: "validation_error"; readonly issues: readonly string[] }
  | { readonly status: "auth_error"; readonly message: string }
  | { readonly status: "forbidden"; readonly message: string }
  | { readonly status: "transport_error"; readonly message: string }
  | { readonly status: "parse_error"; readonly message: string };

type BadRequestBody = Readonly<{ error: "BAD_REQUEST"; issues: readonly string[] }>;
type AuthErrorBody = Readonly<{ success: false; message?: string }>;
type ForbiddenBody = Readonly<{ success: false; code?: string; message?: string }>;

function isBadRequestBody(x: unknown): x is BadRequestBody {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return o.error === "BAD_REQUEST" && Array.isArray(o.issues);
}

function isAuthErrorBody(x: unknown): x is AuthErrorBody {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return o.success === false;
}

function isForbiddenBody(x: unknown): x is ForbiddenBody {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return o.success === false && typeof o.code === "string";
}

function isLikelyPlanningOriginatedExecutionResponse(x: unknown): x is PlanningOriginatedExecutionResponse {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.status === "string" && typeof o.ok === "boolean" && typeof o.reasonSummary === "string";
}

function screenFromNormalizedResponse(response: PlanningOriginatedExecutionResponse): PlanningExecutionScreenViewModel {
  const vm = buildPlanningOriginatedExecutionViewModel(response);
  return buildPlanningExecutionScreenViewModel(vm);
}

/**
 * Calls the route, validates minimal shape, normalizes the response contract, and maps to a screen view-model.
 * Page/components never parse raw fetch JSON inline.
 */
export async function runPlanningOriginatedExecution(
  req: RunPlanningOriginatedExecutionRequest
): Promise<RunPlanningOriginatedExecutionResult> {
  const projectId = String(req.projectId ?? "").trim();
  const inputText = String(req.inputText ?? "").trim();
  const mode = req.mode;

  const issues: string[] = [];
  if (!projectId) issues.push("프로젝트 ID가 필요합니다.");
  if (!inputText) issues.push("입력 텍스트가 필요합니다.");
  if (mode !== "PREPARE_ONLY" && mode !== "PREPARE_AND_START") {
    issues.push("mode 값이 올바르지 않습니다. 허용: 준비만, 준비 및 시작.");
  }
  if (issues.length > 0) {
    return { status: "validation_error", issues };
  }

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (req.mockUserId) {
      headers.set("x-mock-user-id", String(req.mockUserId));
    }

    const res = await fetch(ROUTE, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ projectId, mode, inputText }),
    });

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 400 && isBadRequestBody(json)) {
        return { status: "validation_error", issues: json.issues };
      }
      if (res.status === 401 && isAuthErrorBody(json)) {
        return { status: "auth_error", message: json.message ?? "로그인이 필요합니다." };
      }
      if (res.status === 403 && isForbiddenBody(json) && json.code === RBAC_FORBIDDEN_CODE) {
        return { status: "forbidden", message: json.message ?? "권한이 없습니다." };
      }
      return { status: "transport_error", message: `요청이 실패했습니다(응답 코드 ${res.status}).` };
    }

    if (!isLikelyPlanningOriginatedExecutionResponse(json)) {
      return { status: "parse_error", message: "계획 기반 실행 API 응답 형식이 올바르지 않습니다." };
    }

    let normalized: PlanningOriginatedExecutionResponse;
    try {
      normalized = normalizePlanningOriginatedExecutionResponse(json);
    } catch {
      return { status: "parse_error", message: "계획 기반 실행 응답을 해석하지 못했습니다." };
    }

    return { status: "success", response: normalized, screen: screenFromNormalizedResponse(normalized) };
  } catch {
    return { status: "transport_error", message: "네트워크 오류가 발생했습니다." };
  }
}

