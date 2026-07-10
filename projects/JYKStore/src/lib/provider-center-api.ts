import type { ProviderPackDetailDto, ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import type {
  GitHubKnowledgeUnitDraftResult,
  GitHubRepositoryDiscoveryResult,
  GitHubSourceRegisterResult,
} from "@/lib/github-auto-collect/github-auto-collect-types";
import type { ProviderKnowledgeUnitDraftListResponse } from "@/lib/provider-knowledge-unit-draft-dto";

export type ProviderProfileResponse = {
  clientId: string;
  profile: ProviderProfileDto | null;
};

export type ProviderPacksListResponse = {
  clientId: string;
  items: ProviderPackListItemDto[];
};

export type ProviderPackDetailResponse = {
  clientId: string;
  pack: ProviderPackDetailDto;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
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

export async function addSourceDocumentApi(
  packId: string,
  input: {
    title: string;
    sourceType: string;
    sourceFormat?: string;
    sourceUrl?: string;
    fileName?: string;
    mimeType?: string;
    content?: string;
    checksum?: string | null;
    productVersion?: string;
    documentVersion?: string;
    licenseStatus?: string;
  },
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/source-documents`,
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

export async function evaluateProviderStructureQualityApi(
  packId: string,
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/structure-quality/evaluate`,
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

export async function evaluateProviderChunkQualityApi(
  packId: string,
  input?: { regenerate?: boolean },
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/chunk-quality/evaluate`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? { regenerate: true }),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function generateProviderRetrievalEvaluationCasesApi(
  packId: string,
  replace?: boolean,
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/retrieval-evaluation/cases/generate`,
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
  return (await response.json()) as ProviderPackDetailResponse;
}

export async function runProviderRetrievalEvaluationApi(
  packId: string,
): Promise<ProviderPackDetailResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/retrieval-evaluation/run`,
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

export async function validateSourceDocumentApi(
  packId: string,
  sourceDocumentId: string,
): Promise<ProviderPackDetailResponse & { report?: unknown }> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/source-documents/${encodeURIComponent(sourceDocumentId)}/validate`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse & { report?: unknown };
}

export async function previewGitHubRepositoryDiscoveryApi(input: {
  repositoryUrl: string;
  crawlMode?: string;
  sourceCodeAnalysis?: string;
  selectedPaths?: string[];
  maxFilesToAnalyze?: number;
  maxCandidateFiles?: number;
}): Promise<GitHubRepositoryDiscoveryResult> {
  const response = await fetch("/api/v1/provider/github/repository-discovery", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as GitHubRepositoryDiscoveryResult;
}

export async function registerGitHubSourceDocumentsApi(
  packId: string,
  input: {
    repositoryUrl: string;
    crawlMode?: string;
    sourceCodeAnalysis?: string;
    selectedPaths?: string[];
    selectedSourcePaths: string[];
    maxFilesToAnalyze?: number;
    maxCandidateFiles?: number;
    maxFilesToFetch?: number;
    maxFileBytes?: number;
    maxTotalBytes?: number;
    productVersion?: string;
    documentVersion?: string;
    licenseStatus?: string;
    syncSelectedSources?: boolean;
  },
): Promise<GitHubSourceRegisterResult> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/auto-collect/github/register`,
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
  return (await response.json()) as GitHubSourceRegisterResult;
}

export async function generateGitHubKnowledgeUnitDraftsApi(
  packId: string,
  input: {
    sourceDocumentIds?: string[];
    sourceDocumentPaths?: string[];
    generationMode?: "MINIMAL" | "STANDARD" | "FULL" | "CUSTOM";
    targetKnowledgeUnitCount?: number;
    minKnowledgeUnitCount?: number;
    maxKnowledgeUnitCount?: number;
    productProfileType?: string;
    overwriteExistingDrafts?: boolean;
    autoPrepareForReview?: boolean;
    autoRunRetrievalEvaluation?: boolean;
  },
): Promise<GitHubKnowledgeUnitDraftResult> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/auto-collect/github/knowledge-units/draft`,
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
  return (await response.json()) as GitHubKnowledgeUnitDraftResult;
}

export async function runProviderInspectionAutoPrepareApi(
  packId: string,
  input?: { runRetrievalEvaluation?: boolean; repairRetrievalData?: boolean },
): Promise<
  ProviderPackDetailResponse & {
    preparation?: {
      generatedChunkCount: number;
      structureQualityStatus: string;
      chunkQualityStatus: string;
      retrievalCaseCount: number;
      retrievalEvaluationStatus: string;
      warnings: string[];
    };
  }
> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/inspection/auto-prepare`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        input ?? { runRetrievalEvaluation: true, repairRetrievalData: false },
      ),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderPackDetailResponse & {
    preparation?: {
      generatedChunkCount: number;
      structureQualityStatus: string;
      chunkQualityStatus: string;
      retrievalCaseCount: number;
      retrievalEvaluationStatus: string;
      warnings: string[];
    };
  };
}

export async function fetchProviderKnowledgeUnitDraftsApi(
  packId: string,
  input?: {
    status?: "pending_review" | "superseded" | "all";
    sourceDocumentId?: string;
    limit?: number;
  },
): Promise<ProviderKnowledgeUnitDraftListResponse> {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.sourceDocumentId) params.set("sourceDocumentId", input.sourceDocumentId);
  if (input?.limit !== undefined) params.set("limit", String(input.limit));

  const query = params.toString();
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-unit-drafts${query ? `?${query}` : ""}`,
    {
      method: "GET",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ProviderKnowledgeUnitDraftListResponse;
}

export async function resetProviderKnowledgeUnitDraftsApi(
  packId: string,
  input?: {
    scope?: "pending_review_only" | "pending_and_superseded" | "all_auto_generated";
  },
): Promise<import("@/lib/provider-knowledge-unit-draft-dto").ProviderKnowledgeUnitDraftResetResponse> {
  const response = await fetch(
    `/api/v1/provider/packs/${encodeURIComponent(packId)}/knowledge-unit-drafts`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as import("@/lib/provider-knowledge-unit-draft-dto").ProviderKnowledgeUnitDraftResetResponse;
}
