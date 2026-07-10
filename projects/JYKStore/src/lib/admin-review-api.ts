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

export async function validateAdminPackSourcesApi(
  packId: string,
  input?: { sourceDocumentId?: string },
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/source-documents/validate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function evaluateAdminStructureQualityApi(
  packId: string,
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/structure-quality/evaluate`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function evaluateAdminChunkQualityApi(
  packId: string,
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/chunk-quality/evaluate`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function generateAdminRetrievalEvaluationCasesApi(
  packId: string,
  replace?: boolean,
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/retrieval-evaluation/cases/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(replace === undefined ? {} : { replace }),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function runAdminRetrievalEvaluationApi(
  packId: string,
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/retrieval-evaluation/run`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function evaluateAdminReleaseGateApi(
  packId: string,
  targetStatus?: "PUBLISHED" | "VERIFIED",
): Promise<AdminReviewDetailResponse> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/release-gate/evaluate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetStatus ? { targetStatus } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse;
}

export async function refreshAdminReviewReadinessApi(
  packId: string,
): Promise<AdminReviewDetailResponse & { warnings?: string[]; stoppedAt?: string | null }> {
  const response = await fetch(
    `/api/v1/admin/packs/${encodeURIComponent(packId)}/review-refresh`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminReviewDetailResponse & {
    warnings?: string[];
    stoppedAt?: string | null;
  };
}
