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
    licenseName: string;
    licenseUrl?: string | null;
    usageTerms?: string | null;
    readmeText?: string | null;
    visibility?: string;
    allowDownload?: boolean;
  },
): Promise<{
  clientId: string;
  distribution: import("@/lib/admin-review-dto").AdminReviewDetailDto["distribution"];
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
  };
}

export function adminDoclingImportFileDownloadUrl(packId: string, fileId: string): string {
  return `/api/v1/admin/reviews/${encodeURIComponent(packId)}/docling-import/files/${encodeURIComponent(fileId)}/download`;
}
