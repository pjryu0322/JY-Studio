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
  requestStatus:
    | "NONE"
    | "REQUESTED"
    | "ACCEPTED"
    | "REJECTED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";
  request: {
    originalFileName: string;
    fileSize: number;
    uploadedAt: string;
    uploadedByUserId: string;
    rejection?: {
      reason: string;
      rejectedAt: string;
      rejectedByUserId: string;
      acknowledgedAt?: string;
      acknowledgedByUserId?: string;
    };
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
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  originalFileName: string | null;
  accepted: boolean;
  phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
  packStatus: string;
  providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
  serviceValidationPhase: "NONE" | "PASSED";
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

export type AdminProviderReturnedPackListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  withdrawnAt: string;
  packStatus: string;
  providerReviewPhase: "WITHDRAWN" | "NONE" | "REQUESTED" | "CONFIRMED";
  serviceValidationPhase: "NONE" | "PASSED";
  providerSupplementPhase?: string;
  changesRequest: {
    changeType: string;
    targetKind: string;
    targetLabel?: string;
    details: string;
  } | null;
  changeTypeLabel?: string | null;
  targetCount?: number;
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

/** List DRAFT packs with open/completed ZIP requests, plus provider 보완요청 returns. */
export async function fetchAdminWorkerZipRequests(): Promise<{
  clientId: string;
  items: AdminWorkerZipRequestListItem[];
  returnedItems: AdminProviderReturnedPackListItem[];
}> {
  const response = await fetch("/api/v1/admin/worker-zip-requests", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as {
    clientId: string;
    items: AdminWorkerZipRequestListItem[];
    returnedItems?: AdminProviderReturnedPackListItem[];
  };
  return {
    clientId: data.clientId,
    items: data.items ?? [],
    returnedItems: data.returnedItems ?? [],
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

/** P7.5: Admin 자료 반려 — reject the request with a required reason (접수 전/후 모두). */
export async function rejectAdminWorkerZipRequest(
  packId: string,
  reason: string,
): Promise<{ ok: boolean; packId: string; versionId: string; requestStatus: string; message: string }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip/reject`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; packId?: string; versionId?: string; requestStatus?: string; message?: string; error?: string; code?: string }
    | null;
  if (response.ok && data && data.ok === true) {
    return {
      ok: true,
      packId: data.packId ?? packId,
      versionId: data.versionId ?? "",
      requestStatus: data.requestStatus ?? "REJECTED",
      message: data.message ?? "생성 요청이 반려되었습니다.",
    };
  }
  const failure = (data ?? {}) as { error?: string; message?: string; code?: string };
  throw new Error(failure.message ?? failure.error ?? `요청에 실패했습니다. (${response.status})`);
}

/** Admin 반려 취소 — Provider가 반려 사유를 확인하기 전에만 가능. */
export async function cancelAdminWorkerZipRejection(
  packId: string,
): Promise<{ ok: boolean; packId: string; versionId: string; requestStatus: string; message: string }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip/reject/cancel`,
    { method: "POST", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; packId?: string; versionId?: string; requestStatus?: string; message?: string; error?: string; code?: string }
    | null;
  if (response.ok && data && data.ok === true) {
    return {
      ok: true,
      packId: data.packId ?? packId,
      versionId: data.versionId ?? "",
      requestStatus: data.requestStatus ?? "REQUESTED",
      message: data.message ?? "반려가 취소되었습니다.",
    };
  }
  const failure = (data ?? {}) as { error?: string; message?: string; code?: string };
  throw new Error(failure.message ?? failure.error ?? `요청에 실패했습니다. (${response.status})`);
}

/** P7.5: one persisted step log line for the Admin stepper / history. */
export type AdminWorkerZipStepLog = {
  step: string;
  status: "PENDING" | "RUNNING" | "PASS" | "WARNING" | "FAIL" | "SKIPPED";
  message: string | null;
  createdAt: string;
};

export type AdminWorkerZipRunView = {
  runId: string;
  status: "PENDING" | "RUNNING" | "PASS" | "WARNING" | "FAIL" | "SKIPPED";
  currentStep: string | null;
  currentStepLabel: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  message: string | null;
  errorMessage: string | null;
  summary: {
    importedChunkCount?: number;
    importedEmbeddingCount?: number;
    excludedFiles?: number;
  } | null;
  stepLogs: AdminWorkerZipStepLog[];
};

export type AdminWorkerZipStatus = {
  clientId: string;
  packId: string;
  requestStatus: AdminWorkerZipRequestState["requestStatus"];
  run: AdminWorkerZipRunView | null;
};

/** P7.5: poll live generation status (current step + step logs) for a pack. */
export async function fetchAdminWorkerZipStatus(packId: string): Promise<AdminWorkerZipStatus> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip/status`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminWorkerZipStatus;
}

/** P7.5: fetch recent generation runs (Worker 작업 내역) for a pack. */
export async function fetchAdminWorkerZipRuns(
  packId: string,
): Promise<{ clientId: string; packId: string; runs: AdminWorkerZipRunView[] }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip/runs`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    packId: string;
    runs: AdminWorkerZipRunView[];
  };
}

export type AdminWorkerZipQualityRefreshResult = {
  ok: true;
  clientId: string;
  packId: string;
  backfilledSourceDocuments: number;
  retypedSourceDocuments: number;
  stepsCompleted: string[];
  warnings: string[];
  stoppedAt: string | null;
  readiness: {
    sourceValidation: {
      passCount: number;
      warningCount: number;
      failCount: number;
      notCheckedCount: number;
    };
    structureCoverageStatus: string | null;
    knowledgeQualityStatus: string | null;
    structureQualityMessage: string | null;
    chunkQualityStatus: string | null;
    chunkQualityMessage: string | null;
    retrievalEvaluationStatus: string | null;
    retrievalEvaluationMessage: string | null;
    releaseGateStatus: string | null;
    releaseGateMessage: string | null;
  };
};

/**
 * Run legacy quality gates (원천검증→구조→청킹→검색평가) against Worker ZIP
 * Store data so admin "판단 근거" blockers update from real reports.
 */
export async function runAdminWorkerZipQualityRefresh(
  packId: string,
): Promise<AdminWorkerZipQualityRefreshResult> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/worker-zip/quality-refresh`,
    { method: "POST", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | AdminWorkerZipQualityRefreshResult
    | { ok?: false; error?: string; message?: string; code?: string }
    | null;
  if (response.ok && data && (data as AdminWorkerZipQualityRefreshResult).ok === true) {
    return data as AdminWorkerZipQualityRefreshResult;
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

export type AdminStoreWorkflowMarkers = {
  providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
  serviceValidationPhase: "NONE" | "PASSED";
  providerReviewRequestedAt: string | null;
  providerReviewConfirmedAt: string | null;
  serviceValidationPassedAt: string | null;
  providerSupplementPhase?: string;
  providerSupplement?: import("@/lib/provider-supplement-request").ProviderSupplementRequestState | null;
};

export async function fetchAdminStoreWorkflowMarkers(
  packId: string,
): Promise<AdminStoreWorkflowMarkers> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/store-workflow`,
    { method: "GET", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | (AdminStoreWorkflowMarkers & { ok?: boolean; error?: string; message?: string })
    | null;
  if (response.ok && data?.providerReviewPhase) {
    return {
      providerReviewPhase: data.providerReviewPhase,
      serviceValidationPhase: data.serviceValidationPhase,
      providerReviewRequestedAt: data.providerReviewRequestedAt,
      providerReviewConfirmedAt: data.providerReviewConfirmedAt,
      serviceValidationPassedAt: data.serviceValidationPassedAt,
      providerSupplementPhase: data.providerSupplementPhase,
      providerSupplement: data.providerSupplement ?? null,
    };
  }
  throw new Error(data?.message ?? data?.error ?? `요청에 실패했습니다. (${response.status})`);
}

export async function postAdminProviderSupplementAction(
  packId: string,
  input: {
    action:
      | "ACCEPT"
      | "RESOLVE"
      | "REJECT"
      | "CLARIFY"
      | "REQUEST_PROVIDER_REVIEW_AGAIN";
    resolutionNote?: string;
    rejectionReason?: string;
    clarifyMessage?: string;
    nextAdminStep?: "NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK";
  },
): Promise<{
  providerSupplementPhase: string;
  providerSupplement: import("@/lib/provider-supplement-request").ProviderSupplementRequestState;
}> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/provider-supplement`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    message?: string;
    providerSupplementPhase?: string;
    providerSupplement?: import("@/lib/provider-supplement-request").ProviderSupplementRequestState;
  } | null;
  if (response.ok && data?.ok === true && data.providerSupplement) {
    return {
      providerSupplementPhase: data.providerSupplementPhase ?? data.providerSupplement.adminPhase,
      providerSupplement: data.providerSupplement,
    };
  }
  throw new Error(data?.message ?? data?.error ?? `요청에 실패했습니다. (${response.status})`);
}

export async function requestAdminProviderReviewApi(packId: string): Promise<void> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/store-workflow/request-provider-review`,
    { method: "POST", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; message?: string }
    | null;
  if (response.ok && data?.ok === true) return;
  throw new Error(data?.message ?? data?.error ?? `요청에 실패했습니다. (${response.status})`);
}

export async function markAdminServiceValidationPassedApi(packId: string): Promise<void> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/store-workflow/service-validation`,
    { method: "POST", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; message?: string; missingChannels?: string[] }
    | null;
  if (response.ok && data?.ok === true) return;
  throw new Error(data?.message ?? data?.error ?? `요청에 실패했습니다. (${response.status})`);
}

export async function fetchAdminServiceChannelGates(
  packId: string,
): Promise<{
  allPassed: boolean;
  serviceValidationReady: boolean;
  bindingStatus: string;
  bindingReason: string | null;
  channels: Array<{
    channel: string;
    label: string;
    passed: boolean;
    reason: string | null;
    reasonCode: string | null;
  }>;
  missingLabels: string[];
}> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/store-workflow/service-validation`,
    { method: "GET", credentials: "include" },
  );
  const data = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        allPassed?: boolean;
        serviceValidationReady?: boolean;
        bindingStatus?: string;
        bindingReason?: string | null;
        channels?: Array<{
          channel: string;
          label: string;
          passed: boolean;
          reason: string | null;
          reasonCode?: string | null;
        }>;
        missingLabels?: string[];
        error?: string;
        message?: string;
      }
    | null;
  if (response.ok && data?.channels) {
    return {
      allPassed: Boolean(data.allPassed),
      serviceValidationReady: Boolean(data.serviceValidationReady ?? data.allPassed),
      bindingStatus: data.bindingStatus ?? "MISSING",
      bindingReason: data.bindingReason ?? null,
      channels: data.channels.map((c) => ({
        ...c,
        reasonCode: c.reasonCode ?? null,
      })),
      missingLabels: data.missingLabels ?? [],
    };
  }
  throw new Error(data?.message ?? data?.error ?? `요청에 실패했습니다. (${response.status})`);
}
