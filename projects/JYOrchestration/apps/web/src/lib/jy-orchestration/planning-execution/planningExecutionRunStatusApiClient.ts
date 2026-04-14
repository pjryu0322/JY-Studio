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
  if (!rid) return { status: "validation_error", message: "runId is required" };

  try {
    const res = await fetch(`${ROUTE}?runId=${encodeURIComponent(rid)}`, {
      method: "GET",
      credentials: "include",
    });
    const json: unknown = await res.json().catch(() => null);
    if (res.status === 401) return { status: "auth_error", message: "로그인이 필요합니다." };
    if (!res.ok) {
      const msg =
        json && typeof json === "object" && "message" in (json as Record<string, unknown>) && typeof (json as any).message === "string"
          ? (json as any).message
          : `Request failed (${res.status})`;
      return { status: "transport_error", message: msg };
    }
    if (!isRunStatusResponse(json) || json.ok !== true) {
      return { status: "parse_error", message: "Invalid run-status response." };
    }
    return { status: "success", response: json };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { status: "transport_error", message };
  }
}

