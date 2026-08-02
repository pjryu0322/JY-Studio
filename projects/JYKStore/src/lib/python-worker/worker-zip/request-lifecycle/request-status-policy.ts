import type { WorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS } from "../constants";
import type { ProviderWorkerZipRequestStatus } from "./types";

export type RequestMarkerRef = { status: string; createdAt?: Date | string | null } | null;
export type LastRunRef = { status: string; createdAt?: Date | string | null } | null;

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function deriveRequestStatus(
  request: WorkerZipRequestMetadata | null,
  lastRun: LastRunRef,
  marker: RequestMarkerRef = null,
): ProviderWorkerZipRequestStatus {
  const lastRunStatus = lastRun?.status ?? null;

  // An actively running generation always wins.
  if (lastRunStatus === "RUNNING") return "PROCESSING";

  // A fresh request cycle: if an open marker (요청/접수) was created AFTER the last
  // terminal run, the Provider has re-submitted — reset the visible status so a
  // prior FAIL/PASS no longer masks the new request.
  const markerTime = toTime(marker?.createdAt);
  const runTime = toTime(lastRun?.createdAt);
  const markerIsFresh =
    marker != null &&
    (lastRun == null || (markerTime != null && runTime != null && markerTime >= runTime));
  if (marker && markerIsFresh) {
    return marker.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS ? "ACCEPTED" : "REQUESTED";
  }

  // Admin 반려(사유 기록)가 있으면 생성 완료(PASS)보다 우선한다. 제공자가 ZIP을
  // 다시 요청하면 sidecar의 rejection이 지워지고, 새 marker가 fresh로 REQUESTED가 된다.
  if (request?.rejection) return "REJECTED";
  if (lastRunStatus === "PASS") return "COMPLETED";
  if (lastRunStatus === "FAIL") return "FAILED";
  if (!request) return "NONE";
  if (marker?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) return "ACCEPTED";
  return "REQUESTED";
}
