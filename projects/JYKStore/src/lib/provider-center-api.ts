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
    licenseName?: string;
    licenseUrl?: string;
    usageTerms?: string;
    visibility?: string;
    allowDownload?: boolean;
    allowApi?: boolean;
    allowMcp?: boolean;
    rightsBasis?: string;
    rightsBasisDetail?: string | null;
    rightsConfirmed?: boolean;
    serviceEndsAt?: string | null;
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

export type ServiceValidationStatusDto =
  import("@/lib/distribution/service-validation-service").ServiceValidationStatusDto;

export type SearchDataStatusDto =
  import("@/lib/search-data/search-data-state").SearchDataStatusResponse;

export async function fetchProviderSearchDataStatusApi(
  packId: string,
): Promise<SearchDataStatusDto> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/search-data/status`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as SearchDataStatusDto;
}

export type SearchDataGenerateAcceptedDto = {
  accepted: true;
  state: "CREATING";
  searchIndexGenerationId: string;
  processedCount: number;
  chunkCount: number;
};

/**
 * Enqueues search-data generation (HTTP 202). Poll status for progress.
 * When the generation is already complete, may return a full status payload (200).
 */
export async function generateProviderSearchDataApi(
  packId: string,
  options?: { forceRegenerate?: boolean },
): Promise<SearchDataGenerateAcceptedDto | SearchDataStatusDto> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/search-data/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRegenerate: Boolean(options?.forceRegenerate) }),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as SearchDataGenerateAcceptedDto | SearchDataStatusDto;
}

export async function validateProviderSearchDataApi(
  packId: string,
): Promise<SearchDataStatusDto> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/search-data/validate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as SearchDataStatusDto;
}

export async function fetchProviderServiceValidationApi(
  packId: string,
): Promise<ServiceValidationStatusDto> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/service-validation`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ServiceValidationStatusDto;
}

export async function runProviderServiceValidationApi(
  packId: string,
  body: { channel: "API" | "MCP" | "DOWNLOAD"; query?: string },
): Promise<{
  channel: import("@/lib/distribution/service-validation-service").ServiceValidationChannelDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/service-validation`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    channel: import("@/lib/distribution/service-validation-service").ServiceValidationChannelDto;
  };
}

export async function confirmProviderServiceValidationApi(
  packId: string,
  runId: string,
  body: Record<string, boolean>,
): Promise<{ confirmationId: string; confirmedRunIds: string[] }> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/service-validation/${encodeURIComponent(runId)}/confirm`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    confirmationId: string;
    confirmedRunIds: string[];
  };
}

export async function rejectProviderServiceValidationApi(
  packId: string,
  runId: string,
  body: { rejectionReason: string; comment?: string },
): Promise<{ confirmationId: string }> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/service-validation/${encodeURIComponent(runId)}/reject`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { confirmationId: string };
}

export async function fetchProviderServiceValidationSourcePreviewApi(
  packId: string,
  runId: string,
  rank: number,
): Promise<{
  title: string;
  snippet: string;
  sourceDocumentTitle: string;
  pageLabel: string | null;
  pageStart: number | null;
  fileName: string | null;
  previewFileId: string | null;
  previewMode: string;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/service-validation/${encodeURIComponent(runId)}/results/${rank}/source-preview`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    title: string;
    snippet: string;
    sourceDocumentTitle: string;
    pageLabel: string | null;
    pageStart: number | null;
    fileName: string | null;
    previewFileId: string | null;
    previewMode: string;
  };
}

export function providerServiceValidationDownloadTestUrl(
  packId: string,
  runId: string,
): string {
  return `/api/v1/provider/packs/${encodeURIComponent(packId)}/service-validation/${encodeURIComponent(runId)}/download-test`;
}

export function providerSourcePreviewPageUrl(input: {
  packId: string;
  runId: string;
  rank: number;
  page?: number | null;
}): string {
  const q = new URLSearchParams();
  q.set("runId", input.runId);
  q.set("rank", String(Math.max(1, Math.floor(input.rank))));
  if (input.page != null && Number.isFinite(input.page)) {
    q.set("page", String(Math.max(1, Math.floor(input.page))));
  }
  return `/provider/packs/${encodeURIComponent(input.packId)}/source-preview?${q.toString()}`;
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
      lastModifiedMs?: number | null;
      headSha256?: string | null;
      tailSha256?: string | null;
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

export async function confirmProviderDoclingImportApi(
  packId: string,
  bundleId: string,
): Promise<{
  clientId: string;
  bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/${encodeURIComponent(bundleId)}/confirm`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    type ConfirmErrorBody = {
      error?: string;
      message?: string;
      code?: string;
      blockers?: Array<{ message?: string }>;
    };
    let raw: ConfirmErrorBody | null = null;
    try {
      raw = (await response.json()) as ConfirmErrorBody;
    } catch {
      raw = null;
    }
    if (raw?.blockers && raw.blockers.length > 0) {
      const blockers = raw.blockers
        .map((b: { message?: string }) => b.message)
        .filter(Boolean)
        .join(" ");
      throw new Error(
        blockers
          ? `${raw.error ?? raw.message ?? "확인 완료할 수 없습니다."} ${blockers}`
          : raw.error ?? raw.message ?? "확인 완료할 수 없습니다.",
      );
    }
    if (raw?.code) {
      const { mapDoclingImportUserError } = await import("@/lib/docling-import/docling-import-ui");
      throw new Error(mapDoclingImportUserError(raw.code, raw.message ?? raw.error));
    }
    throw new Error(raw?.message ?? raw?.error ?? `요청에 실패했습니다. (${response.status})`);
  }
  return (await response.json()) as {
    clientId: string;
    bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
  };
}

export type DoclingKnowledgePipelineStatusDto =
  import("@/lib/docling-knowledge/docling-knowledge-pipeline-service").DoclingKnowledgePipelineStatusDto;

export async function fetchProviderKnowledgePipelineApi(
  packId: string,
): Promise<DoclingKnowledgePipelineStatusDto> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-pipeline`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as DoclingKnowledgePipelineStatusDto;
}

export async function startProviderKnowledgePipelineApi(
  packId: string,
  options?: { forceRestart?: boolean },
): Promise<{ ok: true; runId: string; alreadyRunning?: boolean }> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-pipeline`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forceRestart: Boolean(options?.forceRestart) }),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    ok: true;
    runId: string;
    alreadyRunning?: boolean;
  };
}

export async function downloadProviderKnowledgePipelineStageApi(
  packId: string,
  stageId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-pipeline/export?stage=${encodeURIComponent(stageId)}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const asciiMatch = disposition.match(/filename="([^"]+)"/i);
  const fileName = utf8Match?.[1]
    ? decodeURIComponent(utf8Match[1])
    : asciiMatch?.[1] || `${packId}_${stageId}.json`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

export async function revalidateProviderDoclingImportBundleApi(
  packId: string,
  bundleId: string,
): Promise<{
  clientId: string;
  bundle: import("@/lib/docling-import/docling-import-dto").DoclingImportBundlePublicDto;
}> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/${encodeURIComponent(bundleId)}/revalidate`,
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

export function providerDoclingFigurePreviewUrl(
  packId: string,
  bundleId: string,
  figureId: string,
): string {
  return `/api/v1/provider/packs/${encodeURIComponent(packId)}/docling-import/${encodeURIComponent(bundleId)}/figures/${encodeURIComponent(figureId)}/preview`;
}
