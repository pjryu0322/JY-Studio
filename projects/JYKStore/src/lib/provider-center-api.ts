import type { ProviderPackDetailDto, ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";

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

export async function fetchProviderPackPayloadApi(packId: string): Promise<{
  clientId: string;
  payload: import("@/lib/distribution/payload-service").KnowledgePayloadPublicDto | null;
}> {
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}/payload`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    payload: import("@/lib/distribution/payload-service").KnowledgePayloadPublicDto | null;
  };
}

export async function uploadProviderPackPayloadApi(
  packId: string,
  input: {
    file: File;
    profile: string;
    generatorType: string;
    generatorVersion?: string;
  },
): Promise<{
  clientId: string;
  payload: import("@/lib/distribution/payload-service").KnowledgePayloadPublicDto;
}> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("profile", input.profile);
  form.append("generatorType", input.generatorType);
  if (input.generatorVersion) {
    form.append("generatorVersion", input.generatorVersion);
  }
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}/payload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as {
    clientId: string;
    payload: import("@/lib/distribution/payload-service").KnowledgePayloadPublicDto;
  };
}

export async function deleteProviderPackPayloadApi(packId: string): Promise<{ deleted: true }> {
  const response = await fetch(`/api/v1/provider/packs/${encodeURIComponent(packId)}/payload`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { deleted: true };
}

export async function fetchProviderPackDistributionApi(packId: string): Promise<{
  clientId: string;
  distribution: import("@/lib/distribution/distribution-metadata-service").PackDistributionMetadataDto | null;
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
  };
}

export async function upsertProviderPackDistributionApi(
  packId: string,
  input: {
    sourceTitle?: string;
    sourceUrl?: string;
    licenseName: string;
    licenseUrl?: string;
    usageTerms?: string;
    readmeText?: string;
    visibility?: string;
    allowDownload?: boolean;
  },
): Promise<{
  clientId: string;
  distribution: import("@/lib/distribution/distribution-metadata-service").PackDistributionMetadataDto;
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
  };
}
