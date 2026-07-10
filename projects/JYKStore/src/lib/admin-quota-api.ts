import type { QuotaSummaryDto, QuotaSummaryRange } from "@/lib/quota-service";

export type AdminQuotaSummaryResponse = {
  clientId: string;
  summary: QuotaSummaryDto;
};

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { code?: string; message?: string };
    };
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object" && data.error.message) {
      return data.error.message;
    }
    return `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchAdminQuotaSummary(input: {
  range: QuotaSummaryRange;
  clientId?: string;
}): Promise<AdminQuotaSummaryResponse> {
  const params = new URLSearchParams();
  params.set("range", input.range);
  if (input.clientId?.trim()) params.set("clientId", input.clientId.trim());
  const response = await fetch(`/api/v1/admin/quota/summary?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AdminQuotaSummaryResponse;
}
