import {
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  buildReferenceContextPrepareFailureNoticeBody,
  referenceContextPrepareFailureNoticeChips,
  resolveReferenceContextPrepareFailureActionPolicy,
  type ReferenceContextPrepareFailureStatus,
  type ReferenceContextPrepareFailureActionPolicy,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
import { buildReferenceMaterializeApiPath } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";

export type ReferenceMaterializeFailureStatus = ReferenceContextPrepareFailureStatus;
export type ReferenceMaterializeFailureActionPolicy = ReferenceContextPrepareFailureActionPolicy;

export type ReferenceMaterializeClientResult =
  | { readonly ok: true; readonly status: "MATERIALIZED" | "ALREADY_MATERIALIZED" }
  | {
      readonly ok: false;
      readonly status: ReferenceMaterializeFailureStatus;
      readonly noticeBody: string;
      readonly failureNoticeChips: readonly string[];
    };

export const resolveReferenceMaterializeFailureActionPolicy = resolveReferenceContextPrepareFailureActionPolicy;
export const referenceMaterializeFailureNoticeChips = referenceContextPrepareFailureNoticeChips;
export const buildReferenceMaterializeFailureNoticeBody = buildReferenceContextPrepareFailureNoticeBody;

/** @deprecated use referenceMaterializeFailureNoticeChips */
export function shouldSuggestReferenceClearAfterMaterializeFailure(
  status: ReferenceMaterializeFailureStatus,
): boolean {
  return referenceMaterializeFailureNoticeChips(status).includes("참조 해제");
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

/** @deprecated */
export const REFERENCE_MATERIALIZE_FAILURE_NOTICE_CHIPS = ["참조 해제"] as const;

export { REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY as REFERENCE_PLANNING_MATERIALIZE_FAILED_DEFAULT_BODY };
