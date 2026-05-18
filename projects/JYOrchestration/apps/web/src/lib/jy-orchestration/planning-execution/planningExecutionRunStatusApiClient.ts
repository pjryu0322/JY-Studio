/**
 * Planning-originated execution — run-status (web client) adapter.
 *
 * UI calls the **route only** (`GET /api/jy-orchestration/planning-execution/run-status?runId=...`).
 */

"use client";

import type { PlanningExecutionRunStatusResponse } from "@jy-orch/application/public";

const ROUTE = "/api/jy-orchestration/planning-execution/run-status" as const;

export type GetPlanningExecutionRunStatusResult =
  | { readonly status: "success"; readonly response: PlanningExecutionRunStatusResponse & { ok: true } }
  | { readonly status: "validation_error"; readonly message: string }
  | { readonly status: "auth_error"; readonly message: string }
  | { readonly status: "transport_error"; readonly message: string }
  | { readonly status: "parse_error"; readonly message: string };

function isRunStatusResponse(x: unknown): x is PlanningExecutionRunStatusResponse {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.ok !== "boolean") return false;
  if (o.ok === true) return typeof o.run === "object" && o.run !== null;
  return typeof o.error === "string" && typeof o.message === "string";
}

export async function getPlanningExecutionRunStatus(runId: string): Promise<GetPlanningExecutionRunStatusResult> {
  const rid = String(runId ?? "").trim();
  if (!rid) return { status: "validation_error", message: "실행 식별자가 필요합니다." };

  try {
    const res = await fetch(`${ROUTE}?runId=${encodeURIComponent(rid)}`, {
      method: "GET",
      credentials: "include",
    });
    const json: unknown = await res.json().catch(() => null);
    if (res.status === 401) return { status: "auth_error", message: "로그인이 필요합니다." };
    if (!res.ok) {
      return { status: "transport_error", message: `요청이 실패했습니다(응답 코드 ${res.status}).` };
    }
    if (!isRunStatusResponse(json) || json.ok !== true) {
      return { status: "parse_error", message: "실행 상태 응답 형식이 올바르지 않습니다." };
    }
    return { status: "success", response: json };
  } catch {
    return { status: "transport_error", message: "네트워크 오류가 발생했습니다." };
  }
}

