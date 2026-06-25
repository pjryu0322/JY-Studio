import {
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_MATERIALIZE,
  REFERENCE_PLANNING_MATERIALIZE_FAILED_DEFAULT_BODY,
} from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";
import { buildReferenceMaterializeApiPath } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";

export type ReferenceMaterializeFailureStatus =
  | "SOURCE_PERMISSION_DENIED"
  | "SOURCE_UNAVAILABLE"
  | "SNAPSHOT_NOT_READY"
  | "INVALID_SELECTION"
  | "NO_REFERENCE_SELECTION"
  | "UNKNOWN";

export type ReferenceMaterializeFailureActionPolicy = "RETRY_AND_CLEAR" | "CLEAR_ONLY" | "NONE";

export type ReferenceMaterializeClientResult =
  | { readonly ok: true; readonly status: "MATERIALIZED" | "ALREADY_MATERIALIZED" }
  | {
      readonly ok: false;
      readonly status: ReferenceMaterializeFailureStatus;
      readonly noticeBody: string;
      readonly failureNoticeChips: readonly string[];
    };

export function resolveReferenceMaterializeFailureActionPolicy(
  status: ReferenceMaterializeFailureStatus,
): ReferenceMaterializeFailureActionPolicy {
  switch (status) {
    case "SOURCE_PERMISSION_DENIED":
    case "SOURCE_UNAVAILABLE":
    case "INVALID_SELECTION":
      return "CLEAR_ONLY";
    case "SNAPSHOT_NOT_READY":
    case "UNKNOWN":
      return "RETRY_AND_CLEAR";
    case "NO_REFERENCE_SELECTION":
      return "NONE";
    default:
      return "RETRY_AND_CLEAR";
  }
}

export function referenceMaterializeFailureNoticeChips(
  status: ReferenceMaterializeFailureStatus,
): readonly string[] {
  const policy = resolveReferenceMaterializeFailureActionPolicy(status);
  if (policy === "RETRY_AND_CLEAR") {
    return [REFERENCE_PLANNING_CHIP_MATERIALIZE, REFERENCE_PLANNING_CHIP_CLEAR];
  }
  if (policy === "CLEAR_ONLY") {
    return [REFERENCE_PLANNING_CHIP_CLEAR];
  }
  return [];
}

export function buildReferenceMaterializeFailureNoticeBody(
  status: ReferenceMaterializeFailureStatus,
  serverMessage?: string | null,
): string {
  const trimmed = String(serverMessage ?? "").trim();
  switch (status) {
    case "SOURCE_PERMISSION_DENIED":
      return trimmed || "이전 참조 프로젝트에 접근할 권한이 없습니다. 참조를 해제해 주세요.";
    case "SOURCE_UNAVAILABLE":
      return trimmed || "참조 저장본을 다시 확인할 수 없습니다. 참조를 해제해 주세요.";
    case "SNAPSHOT_NOT_READY":
      return trimmed || "참조 저장본이 아직 준비되지 않았습니다. 다시 시도하거나 참조를 해제해 주세요.";
    case "INVALID_SELECTION":
      return trimmed || "저장된 참조 선택 정보가 올바르지 않습니다. 참조를 해제해 주세요.";
    case "NO_REFERENCE_SELECTION":
      return trimmed || "저장된 참조 선택이 없습니다.";
    default:
      return trimmed || REFERENCE_PLANNING_MATERIALIZE_FAILED_DEFAULT_BODY;
  }
}

/** @deprecated use referenceMaterializeFailureNoticeChips */
export function shouldSuggestReferenceClearAfterMaterializeFailure(
  status: ReferenceMaterializeFailureStatus,
): boolean {
  return referenceMaterializeFailureNoticeChips(status).includes(REFERENCE_PLANNING_CHIP_CLEAR);
}

export function parseReferenceMaterializeFailureStatus(raw: unknown): ReferenceMaterializeFailureStatus {
  const s = String(raw ?? "").trim();
  if (s === "SOURCE_PERMISSION_DENIED") return "SOURCE_PERMISSION_DENIED";
  if (s === "SOURCE_UNAVAILABLE") return "SOURCE_UNAVAILABLE";
  if (s === "SNAPSHOT_NOT_READY") return "SNAPSHOT_NOT_READY";
  if (s === "INVALID_SELECTION") return "INVALID_SELECTION";
  if (s === "NO_REFERENCE_SELECTION") return "NO_REFERENCE_SELECTION";
  return "UNKNOWN";
}

export function parseReferenceMaterializeApiResponse(input: Readonly<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: unknown;
}>): ReferenceMaterializeClientResult {
  const payload = input.json && typeof input.json === "object" && !Array.isArray(input.json)
    ? (input.json as Record<string, unknown>)
    : {};
  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : {};
  const message = typeof payload.message === "string" ? payload.message : null;
  const successFlag = payload.success !== false;

  if (input.ok && successFlag) {
    const st = String(data.status ?? "").trim();
    if (st === "MATERIALIZED" || st === "ALREADY_MATERIALIZED") {
      return {
        ok: true,
        status: st === "ALREADY_MATERIALIZED" ? "ALREADY_MATERIALIZED" : "MATERIALIZED",
      };
    }
  }

  let failureStatus = parseReferenceMaterializeFailureStatus(data.status);
  if (failureStatus === "UNKNOWN" && input.status === 403) {
    failureStatus = "SOURCE_PERMISSION_DENIED";
  }
  const noticeBody = buildReferenceMaterializeFailureNoticeBody(failureStatus, message);
  return {
    ok: false,
    status: failureStatus,
    noticeBody,
    failureNoticeChips: referenceMaterializeFailureNoticeChips(failureStatus),
  };
}

export async function postReferenceMaterializeForProject(
  projectId: string,
  options?: Readonly<{ dryRun?: boolean }>,
): Promise<ReferenceMaterializeClientResult> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return {
      ok: false,
      status: "UNKNOWN",
      noticeBody: "프로젝트 정보가 없습니다.",
      failureNoticeChips: [],
    };
  }
  const res = await fetch(buildReferenceMaterializeApiPath(pid), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dryRun: options?.dryRun === true }),
  });
  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return parseReferenceMaterializeApiResponse({ ok: res.ok, status: res.status, json });
}

/** @deprecated use referenceMaterializeFailureNoticeChips */
export const REFERENCE_MATERIALIZE_FAILURE_NOTICE_CHIPS = [REFERENCE_PLANNING_CHIP_CLEAR] as const;
