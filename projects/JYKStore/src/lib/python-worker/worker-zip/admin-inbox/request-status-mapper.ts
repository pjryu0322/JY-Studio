import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS } from "../constants";
import type { AdminWorkerZipDraftItem, LegacyWorkerZipRequestRow } from "./types";

export function derivePhaseFromRunStatus(
  status: string,
): "REQUESTED" | "ACCEPTED" | "COMPLETED" {
  if (status === "PASS") return "COMPLETED";
  if (status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) return "ACCEPTED";
  return "REQUESTED";
}

/**
 * startedAt is stamped on Admin 접수; fall back to updatedAt for ACCEPTED legacy rows.
 */
export function deriveAcceptedAt(input: {
  phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
  createdAt: Date;
  startedAt: Date | null;
  updatedAt: Date | null;
}): string | null {
  if (input.phase === "REQUESTED") return null;
  const { startedAt, updatedAt, createdAt, phase } = input;
  if (startedAt && startedAt.getTime() > createdAt.getTime() + 1_000) {
    return startedAt.toISOString();
  }
  if (phase === "ACCEPTED" && updatedAt) {
    return updatedAt.toISOString();
  }
  if (startedAt) return startedAt.toISOString();
  if (updatedAt) return updatedAt.toISOString();
  return null;
}

export function applyLegacyRequestTimestamps(
  draftItems: AdminWorkerZipDraftItem[],
  legacyRequests: LegacyWorkerZipRequestRow[],
): void {
  const byPack = new Map<string, LegacyWorkerZipRequestRow[]>();
  for (const req of legacyRequests) {
    const list = byPack.get(req.packId) ?? [];
    list.push(req);
    byPack.set(req.packId, list);
  }
  for (const item of draftItems) {
    const reqs = byPack.get(item.packId);
    if (!reqs?.length) continue;
    const first = reqs[0]!;
    item.requestedAt = first.createdAt.toISOString();
    const acceptedReq = [...reqs].reverse().find(
      (r) =>
        r.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS ||
        r.status === "PASS" ||
        r.status === "SKIPPED",
    );
    if (acceptedReq) {
      const stamp =
        acceptedReq.startedAt &&
        acceptedReq.startedAt.getTime() > acceptedReq.createdAt.getTime() + 1_000
          ? acceptedReq.startedAt
          : acceptedReq.updatedAt;
      if (stamp) item.acceptedAt = stamp.toISOString();
    }
  }
}
