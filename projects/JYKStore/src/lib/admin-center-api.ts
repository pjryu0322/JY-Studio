import type {
  AdminKnowledgeUnitDraftDecisionResponse,
  AdminKnowledgeUnitDraftListResponse,
} from "@/lib/admin-knowledge-unit-draft-dto";
import type { AdminKnowledgeUnitDraftActivationResponse } from "@/lib/admin-knowledge-unit-draft-activation-dto";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchAdminKnowledgeUnitDraftsApi(input?: {
  status?: "pending_review" | "approved" | "rejected" | "superseded" | "all";
  packId?: string;
  limit?: number;
}): Promise<AdminKnowledgeUnitDraftListResponse> {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.packId?.trim()) params.set("packId", input.packId.trim());
  if (input?.limit !== undefined) params.set("limit", String(input.limit));

  const query = params.toString();
  const response = await fetch(
    `/api/v1/admin/knowledge-unit-drafts${query ? `?${query}` : ""}`,
    {
      method: "GET",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminKnowledgeUnitDraftListResponse;
}

export async function decideAdminKnowledgeUnitDraftApi(
  draftId: string,
  input: {
    decision: "approve" | "reject";
    memo?: string;
    rejectionReason?: string;
  },
): Promise<AdminKnowledgeUnitDraftDecisionResponse> {
  const response = await fetch(
    `/api/v1/admin/knowledge-unit-drafts/${encodeURIComponent(draftId)}/decision`,
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
  return (await response.json()) as AdminKnowledgeUnitDraftDecisionResponse;
}

export async function activateAdminKnowledgeUnitDraftApi(
  draftId: string,
  input?: { memo?: string },
): Promise<AdminKnowledgeUnitDraftActivationResponse> {
  const response = await fetch(
    `/api/v1/admin/knowledge-unit-drafts/${encodeURIComponent(draftId)}/activate`,
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
  return (await response.json()) as AdminKnowledgeUnitDraftActivationResponse;
}
