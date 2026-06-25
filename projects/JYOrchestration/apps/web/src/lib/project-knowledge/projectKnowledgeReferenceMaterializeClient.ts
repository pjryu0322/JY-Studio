import {
  buildReferenceContextPrepareFailureNoticeBody,
  referenceContextPrepareFailureNoticeChips,
  resolveReferenceContextPrepareFailureActionPolicy,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
import { buildReferencePrepareContextApiPath } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";

export type ReferencePrepareContextFailureStatus =
  import("@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy").ReferenceContextPrepareFailureStatus;
export type ReferencePrepareContextFailureActionPolicy =
  import("@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy").ReferenceContextPrepareFailureActionPolicy;

export type ReferencePrepareContextClientResult =
  | { readonly ok: true; readonly status: "MATERIALIZED" | "ALREADY_MATERIALIZED" }
  | {
      readonly ok: false;
      readonly status: ReferencePrepareContextFailureStatus;
      readonly noticeBody: string;
      readonly failureNoticeChips: readonly string[];
    };

/** @deprecated use `ReferencePrepareContextClientResult` */
export type ReferenceMaterializeClientResult = ReferencePrepareContextClientResult;

/** @deprecated use `ReferencePrepareContextFailureStatus` */
export type ReferenceMaterializeFailureStatus = ReferencePrepareContextFailureStatus;

/** @deprecated use `ReferencePrepareContextFailureActionPolicy` */
export type ReferenceMaterializeFailureActionPolicy = ReferencePrepareContextFailureActionPolicy;

export function parseReferencePrepareContextFailureStatus(raw: unknown): ReferencePrepareContextFailureStatus {
  const s = String(raw ?? "").trim();
  if (s === "SOURCE_PERMISSION_DENIED") return "SOURCE_PERMISSION_DENIED";
  if (s === "SOURCE_UNAVAILABLE") return "SOURCE_UNAVAILABLE";
  if (s === "SNAPSHOT_NOT_READY") return "SNAPSHOT_NOT_READY";
  if (s === "INVALID_SELECTION") return "INVALID_SELECTION";
  if (s === "NO_REFERENCE_SELECTION") return "NO_REFERENCE_SELECTION";
  return "UNKNOWN";
}

/** @deprecated use `parseReferencePrepareContextFailureStatus` */
export const parseReferenceMaterializeFailureStatus = parseReferencePrepareContextFailureStatus;

export function parseReferencePrepareContextApiResponse(input: Readonly<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: unknown;
}>): ReferencePrepareContextClientResult {
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

  let failureStatus = parseReferencePrepareContextFailureStatus(data.status);
  if (failureStatus === "UNKNOWN" && input.status === 403) {
    failureStatus = "SOURCE_PERMISSION_DENIED";
  }
  const noticeBody = buildReferenceContextPrepareFailureNoticeBody(failureStatus, message);
  return {
    ok: false,
    status: failureStatus,
    noticeBody,
    failureNoticeChips: referenceContextPrepareFailureNoticeChips(failureStatus),
  };
}

/** @deprecated use `parseReferencePrepareContextApiResponse` */
export const parseReferenceMaterializeApiResponse = parseReferencePrepareContextApiResponse;

export async function postReferencePrepareContextForProject(
  projectId: string,
  options?: Readonly<{ dryRun?: boolean }>,
): Promise<ReferencePrepareContextClientResult> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return {
      ok: false,
      status: "UNKNOWN",
      noticeBody: "프로젝트 정보가 없습니다.",
      failureNoticeChips: [],
    };
  }
  const res = await fetch(buildReferencePrepareContextApiPath(pid), {
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
  return parseReferencePrepareContextApiResponse({ ok: res.ok, status: res.status, json });
}

/** @deprecated use `postReferencePrepareContextForProject` */
export const postReferenceMaterializeForProject = postReferencePrepareContextForProject;

/** @deprecated use `referenceContextPrepareFailureNoticeChips` */
export const referenceMaterializeFailureNoticeChips = referenceContextPrepareFailureNoticeChips;

/** @deprecated use `resolveReferenceContextPrepareFailureActionPolicy` */
export const resolveReferenceMaterializeFailureActionPolicy = resolveReferenceContextPrepareFailureActionPolicy;

/** @deprecated use `buildReferenceContextPrepareFailureNoticeBody` */
export const buildReferenceMaterializeFailureNoticeBody = buildReferenceContextPrepareFailureNoticeBody;

/** @deprecated use `referenceContextPrepareFailureNoticeChips` */
export function shouldSuggestReferenceClearAfterMaterializeFailure(
  status: ReferencePrepareContextFailureStatus,
): boolean {
  return referenceContextPrepareFailureNoticeChips(status).includes("참조 해제");
}
