import type { ProviderPackDetailDto, ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderPacksStatusSummary } from "@/lib/provider-pack-progress";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";

export type ProviderProfileResponse = {
  clientId: string;
  profile: ProviderProfileDto | null;
};

export type ProviderPacksListResponse = {
  clientId: string;
  items: ProviderPackListItemDto[];
  summary?: ProviderPacksStatusSummary;
};

export type ProviderPackDetailResponse = {
  clientId: string;
  pack: ProviderPackDetailDto;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string; code?: string };
    if (data.code) {
      const { mapDoclingImportUserError } = await import("@/lib/docling-import/docling-import-ui");
      return mapDoclingImportUserError(data.code, data.message ?? data.error);
    }
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchProviderProfile(): Promise<ProviderProfileResponse> {
  const response = await fetch("/api/v1/provider/profile", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderProfileResponse;
}

export async function upsertProviderProfileApi(input: {
  displayName: string;
  description: string;
  websiteUrl?: string;
  contactEmail?: string;
}): Promise<{ clientId: string; profile: ProviderProfileDto }> {
  const response = await fetch("/api/v1/provider/profile", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { clientId: string; profile: ProviderProfileDto };
}

export async function fetchProviderPacks(): Promise<ProviderPacksListResponse> {
  const response = await fetch("/api/v1/provider/packs", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPacksListResponse;
}

/** Kept for P29 Payload Import reuse — UI creation is temporarily blocked. */
export async function createProviderPackApi(input: {
  packId?: string;
  name: string;
  categoryId: string;
  shortDescription?: string;
  description: string;
  tags?: string[];
  version?: string;
}): Promise<ProviderPackDetailResponse> {
  const response = await fetch("/api/v1/provider/packs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function fetchProviderPack(packId: string): Promise<ProviderPackDetailResponse> {
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function updateProviderPackApi(
  packId: string,
  input: Record<string, unknown>,
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function submitProviderPackApi(packId: string): Promise<ProviderPackDetailResponse> {
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}/submit`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function withdrawProviderPackReviewApi(
  packId: string,
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/withdraw-review`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function createProviderPackVersionApi(
  packId: string,
  input: {
    version: string;
    overview?: string;
    versionSummary?: string;
  },
): Promise<{ clientId: string; pack: ProviderPackDetailDto }> {
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}/versions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { clientId: string; pack: ProviderPackDetailDto };
}

export async function fetchProviderPackDistributionApi(packId: string): Promise<{
  clientId: string;
  distribution: import("@/lib/distribution/distribution-metadata-service").PackDistributionMetadataDto | null;
  artifactOptions: import("@/lib/distribution/distribution-metadata-service").DistributionArtifactOptionsDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/distribution`,
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
    distribution: import("@/lib/distribution/distribution-metadata-service").PackDistributionMetadataDto | null;
    artifactOptions: import("@/lib/distribution/distribution-metadata-service").DistributionArtifactOptionsDto;
  };
}

export async function upsertProviderPackDistributionApi(
  packId: string,
  input: {
    sourceTitle?: string;
    sourceUrl?: string;
    sourcePublisherName?: string;
    sourcePublisherUrl?: string;
    sourceDocumentVersion?: string;
    sourcePublishedAt?: string | null;
    sourceRetrievedAt?: string | null;
    licenseName: string;
    licenseUrl?: string;
    usageTerms?: string;
    readmeText?: string;
    visibility?: string;
    allowDownload?: boolean;
    contentType?: string | null;
  },
): Promise<{
  clientId: string;
  distribution: import("@/lib/distribution/distribution-metadata-service").PackDistributionMetadataDto;
  artifactOptions: import("@/lib/distribution/distribution-metadata-service").DistributionArtifactOptionsDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/distribution`,
    {
      method: "PUT",
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
    distribution: import("@/lib/distribution/distribution-metadata-service").PackDistributionMetadataDto;
    artifactOptions: import("@/lib/distribution/distribution-metadata-service").DistributionArtifactOptionsDto;
  };
}

export async function fetchProviderDoclingImportApi(packId: string): Promise<{
  clientId: string;
  bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto | null;
  stagingBundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto | null;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import`,
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

export type DoclingUploadPolicyDto = {
  maxSourceBytes: number;
  maxJsonBytes: number;
  maxMarkdownBytes: number;
  maxBundleBytes: number;
  multipartPartBytes: number;
  multipartConcurrency: number;
  uploadSessionTtlSeconds: number;
  presignedUrlTtlSeconds: number;
  hardCaps: {
    maxFileBytes: number;
    maxBundleBytes: number;
    minPartBytes: number;
    maxPartNumber: number;
  };
};

export async function fetchProviderDoclingUploadPolicyApi(packId: string): Promise<{
  clientId: string;
  policy: DoclingUploadPolicyDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/upload-policy`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { clientId: string; policy: DoclingUploadPolicyDto };
}

export async function createProviderDoclingUploadSessionApi(
  packId: string,
  input: {
    files: Array<{
      role: string;
      fileName: string;
      mimeType?: string | null;
      declaredFileSize: number;
    }>;
  },
): Promise<{
  clientId: string;
  session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/upload-sessions`,
    {
      method: "POST",
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
    session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
  };
}

export async function fetchProviderDoclingUploadSessionApi(
  packId: string,
  sessionId: string,
): Promise<{
  clientId: string;
  session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/upload-sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
  };
}

export async function abortProviderDoclingUploadSessionApi(
  packId: string,
  sessionId: string,
): Promise<{
  clientId: string;
  session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/upload-sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
  };
}

export async function presignProviderDoclingUploadPartsApi(
  packId: string,
  sessionId: string,
  input: {
    requests: Array<{ role: string; partNumbers: number[] }>;
  },
): Promise<{
  clientId: string;
  sessionId: string;
  presigns: import("@/lib/docling-import/docling-upload-session-service").PartPresignDto[];
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/upload-sessions/${encodeURIComponent(sessionId)}/parts`,
    {
      method: "POST",
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
    sessionId: string;
    presigns: import("@/lib/docling-import/docling-upload-session-service").PartPresignDto[];
  };
}

export async function completeProviderDoclingUploadSessionApi(
  packId: string,
  sessionId: string,
  input?: {
    partsByRole?: Record<string, Array<{ partNumber: number; etag: string }>>;
  },
): Promise<{
  clientId: string;
  accepted: true;
  session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
  bundleId: string;
  processingJobId: string;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/upload-sessions/${encodeURIComponent(sessionId)}/complete`,
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
  return (await response.json()) as {
    clientId: string;
    accepted: true;
    session: import("@/lib/docling-import/docling-upload-session-service").UploadSessionPublicDto;
    bundleId: string;
    processingJobId: string;
  };
}

export async function deleteProviderDoclingImportApi(
  packId: string,
): Promise<{ clientId: string; deleted: true }> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { clientId: string; deleted: true };
}

export async function retryProviderDoclingImportApi(packId: string): Promise<{
  clientId: string;
  bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/retry`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
  };
}

export async function retryProviderDoclingImportBundleApi(
  packId: string,
  bundleId: string,
): Promise<{
  clientId: string;
  bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/${encodeURIComponent(bundleId)}/retry`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
  };
}

export async function deleteProviderDoclingImportBundleApi(
  packId: string,
  bundleId: string,
): Promise<{ clientId: string; deleted: true }> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/${encodeURIComponent(bundleId)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { clientId: string; deleted: true };
}

export async function fetchProviderNormalizedDocumentApi(packId: string): Promise<{
  clientId: string;
  document: import("@/lib/docling-import/docling-import-dto").NormalizedDocumentSummaryDto | null;
  structure: unknown;
  capabilities: import("@/lib/docling-import/docling-import-dto").PackCapabilitiesDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/normalized-document`,
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

export function providerDoclingImportFileDownloadUrl(
  packId: string,
  fileId: string,
  options?: { preview?: boolean; maxBytes?: number },
): string {
  const base = `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/files/${encodeURIComponent(fileId)}/download`;
  if (!options?.preview) return base;
  const params = new URLSearchParams({ preview: "1" });
  if (options.maxBytes != null && options.maxBytes > 0) {
    params.set("maxBytes", String(options.maxBytes));
  }
  return `${base}?${params.toString()}`;
}
