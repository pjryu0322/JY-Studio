import type { AdminReviewDetailDto, AdminReviewListItemDto } from "@/lib/admin-review-dto";

export type AdminReviewListResponse = {
  clientId: string;
  items: AdminReviewListItemDto[];
};

export type AdminReviewDetailResponse = {
  clientId: string;
  detail: AdminReviewDetailDto;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

/**
 * P7.3: Admin ZIP Worker generation — request state + execution. Execution is
 * Admin-only (route gated by requireAdminSession).
 */
export type AdminWorkerZipRequestState = {
  clientId: string;
  packId: string;
  versionId: string;
  requestStatus: "NONE" | "REQUESTED" | "ACCEPTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  request: {
    originalFileName: string;
    fileSize: number;
    uploadedAt: string;
    uploadedByUserId: string;
  } | null;
  lastRun: { status: string; finishedAt: string | null; summary: string | null } | null;
  reviewMemo: string | null;
};

/** P7.4: read-only roll-up of files the Worker auto-excluded from structuring. */
export type AdminWorkerZipExclusionSummary = {
  total: number;
  byReason: Record<string, number>;
};

export type AdminWorkerZipGenerationResult = {
  clientId: string;
  ok: boolean;
  pipelineRunId: string;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  pgvectorReflected: boolean;
  generationReady: boolean;
  nextStep: "SEARCH_DATA_VALIDATION" | "RETRY";
  exclusionSummary?: AdminWorkerZipExclusionSummary;
  warnings: { code: string; message: string }[];
  error?: { code: string; message: string; retryable: boolean; supportRequired: boolean };
};

export type AdminWorkerZipRequestListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  originalFileName: string | null;
  accepted: boolean;
};

/** List DRAFT packs with a pending ZIP generation request (접수 대기). */
export async function fetchAdminWorkerZipRequests(): Promise<{
  clientId: string;
  items: AdminWorkerZipRequestListItem[];
}> {
  const response = await fetch("/api/v1/admin/worker-zip-requests", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    items: AdminWorkerZipRequestListItem[];
  };
}

export async function fetchAdminWorkerZipRequestState(
  packId: string,
): Promise<AdminWorkerZipRequestState> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminWorkerZipRequestState;
}

/**
 * Execute the ZIP Worker for a received request. A processed-but-failed pipeline
 * (HTTP 422 `ok:false`) is returned as data; auth/ownership/precondition failures
 * throw with a mapped message.
 */
export async function runAdminWorkerZipGeneration(
  packId: string,
): Promise<AdminWorkerZipGenerationResult> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip`,
    { method: "POST", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | AdminWorkerZipGenerationResult
    | { error?: string; message?: string; code?: string }
    | null;
  if (data && typeof (data as AdminWorkerZipGenerationResult).ok === "boolean") {
    return data as AdminWorkerZipGenerationResult;
  }
  const failure = (data ?? {}) as { error?: string; message?: string; code?: string };
  throw new Error(failure.message ?? failure.error ?? `요청에 실패했습니다. (${response.status})`);
}

/** Admin 접수(accept) — mark the request 접수완료 so the Provider can no longer withdraw. */
export async function acceptAdminWorkerZipRequest(
  packId: string,
): Promise<{ ok: boolean; packId: string; versionId: string; requestStatus: string }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip`,
    { method: "PATCH", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; packId?: string; versionId?: string; requestStatus?: string; error?: string; message?: string; code?: string }
    | null;
  if (response.ok && data && data.ok === true) {
    return {
      ok: true,
      packId: data.packId ?? packId,
      versionId: data.versionId ?? "",
      requestStatus: data.requestStatus ?? "ACCEPTED",
    };
  }
  const failure = (data ?? {}) as { error?: string; message?: string; code?: string };
  throw new Error(failure.message ?? failure.error ?? `요청에 실패했습니다. (${response.status})`);
}

export async function fetchAdminReviewItems(): Promise<AdminReviewListResponse> {
  const response = await fetch("/api/v1/admin/reviews", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewListResponse;
}

export async function fetchAdminReviewDetail(packId: string): Promise<AdminReviewDetailResponse> {
  const response = await fetch(`/api/v1/admin/reviews/${encodeURIComponent(packId)}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function acceptAdminReview(packId: string): Promise<AdminReviewDetailResponse> {
  const response = await fetch(`/api/v1/admin/reviews/${encodeURIComponent(packId)}/accept`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function approveAdminReview(
  packId: string,
  input: { memo?: string; publishAsVerified?: boolean },
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(`/api/v1/admin/reviews/${encodeURIComponent(packId)}/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function rejectAdminReview(
  packId: string,
  input: { memo?: string; rejectionReason: string },
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(`/api/v1/admin/reviews/${encodeURIComponent(packId)}/reject`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function fetchAdminDoclingImportApi(packId: string): Promise<{
  clientId: string;
  bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto | null;
  stagingBundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto | null;
}> {
  const response = await fetch(
    `/api/v1/admin/reviews/${encodeURIComponent(packId)}/docling-import`,
    {
      method: "GET",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto | null;
    stagingBundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto | null;
  };
}

export async function fetchAdminNormalizedDocumentApi(packId: string): Promise<{
  clientId: string;
  document: import("@/lib/docling-import/docling-import-dto").NormalizedDocumentSummaryDto | null;
  structure: unknown;
  capabilities: import("@/lib/docling-import/docling-import-dto").PackCapabilitiesDto;
}> {
  const response = await fetch(
    `/api/v1/admin/reviews/${encodeURIComponent(packId)}/normalized-document`,
    {
      method: "GET",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    document: import("@/lib/docling-import/docling-import-dto").NormalizedDocumentSummaryDto | null;
    structure: unknown;
    capabilities: import("@/lib/docling-import/docling-import-dto").PackCapabilitiesDto;
  };
}

export async function patchAdminDistributionMetadataApi(
  packId: string,
  input: {
    sourceTitle?: string | null;
    sourceUrl?: string | null;
    sourcePublisherName?: string | null;
    sourcePublisherUrl?: string | null;
    sourceDocumentVersion?: string | null;
    sourcePublishedAt?: string | null;
    sourceRetrievedAt?: string | null;
    licenseName?: string | null;
    licenseUrl?: string | null;
    usageTerms?: string | null;
    readmeText?: string | null;
    visibility?: string | null;
    allowDownload?: boolean | null;
    contentType?: string | null;
  },
): Promise<{
  clientId: string;
  distribution: import("@/lib/admin-review-dto").AdminReviewDetailDto["distribution"];
  artifactOptions: import("@/lib/admin-review-dto").AdminReviewDetailDto["artifactOptions"];
}> {
  const response = await fetch(
    `/api/v1/admin/reviews/${encodeURIComponent(packId)}/distribution-metadata`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    distribution: import("@/lib/admin-review-dto").AdminReviewDetailDto["distribution"];
    artifactOptions: import("@/lib/admin-review-dto").AdminReviewDetailDto["artifactOptions"];
  };
}

export function adminDoclingImportFileDownloadUrl(
  packId: string,
  fileId: string,
  options?: { preview?: boolean; maxBytes?: number },
): string {
  const base = `/api/v1/admin/reviews/${encodeURIComponent(packId)}/docling-import/files/${encodeURIComponent(fileId)}/download`;
  if (!options?.preview) return base;
  const params = new URLSearchParams({ preview: "1" });
  if (options.maxBytes != null && options.maxBytes > 0) {
    params.set("maxBytes", String(options.maxBytes));
  }
  return `${base}?${params.toString()}`;
}
