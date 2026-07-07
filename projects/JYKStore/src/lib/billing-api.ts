import type { AdminPlanOverviewDto, PlanUsageSummaryDto } from "@/lib/billing-dto";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message ?? data.error ?? `요청에 실패했습니다. (${response.status})`;
  } catch {
    return `요청에 실패했습니다. (${response.status})`;
  }
}

export async function fetchAccountPlanSummary(): Promise<PlanUsageSummaryDto> {
  const response = await fetch("/api/v1/account/plan", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { summary: PlanUsageSummaryDto };
  return data.summary;
}

export async function fetchAdminPlanOverview(): Promise<AdminPlanOverviewDto> {
  const response = await fetch("/api/v1/admin/ops/plans", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { overview: AdminPlanOverviewDto };
  return data.overview;
}
