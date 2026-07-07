import type {
  OpsAuditLogItemDto,
  OpsHealthDto,
  OpsRange,
  OpsSummaryDto,
  OpsUsageLogItemDto,
} from "@/lib/ops-dto";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchOpsSummary(range: OpsRange): Promise<OpsSummaryDto> {
  const response = await fetch(`/api/v1/admin/ops/summary?range=${encodeURIComponent(range)}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { summary: OpsSummaryDto };
  return data.summary;
}

export async function fetchOpsUsageLogs(params?: {
  limit?: number;
  status?: "success" | "error";
  endpoint?: string;
  packId?: string;
}): Promise<OpsUsageLogItemDto[]> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.status) search.set("status", params.status);
  if (params?.endpoint?.trim()) search.set("endpoint", params.endpoint.trim());
  if (params?.packId?.trim()) search.set("packId", params.packId.trim());
  const qs = search.toString();

  const response = await fetch(`/api/v1/admin/ops/usage${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { items: OpsUsageLogItemDto[] };
  return data.items;
}

export async function fetchOpsAuditLogs(params?: {
  limit?: number;
  action?: string;
  entityType?: string;
}): Promise<OpsAuditLogItemDto[]> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.action?.trim()) search.set("action", params.action.trim());
  if (params?.entityType?.trim()) search.set("entityType", params.entityType.trim());
  const qs = search.toString();

  const response = await fetch(`/api/v1/admin/ops/audit${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { items: OpsAuditLogItemDto[] };
  return data.items;
}

export async function fetchOpsHealth(): Promise<OpsHealthDto> {
  const response = await fetch("/api/v1/admin/ops/health", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { health: OpsHealthDto };
  return data.health;
}
