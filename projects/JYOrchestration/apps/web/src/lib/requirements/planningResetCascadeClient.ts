import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { PlanningResetCascadeResult } from "@/lib/requirements/planningResetCascadeService";

export async function postPlanningResetCascade(input: {
  readonly projectId: string;
  readonly reason?: "planning_reset" | "planning_regenerated" | "manual";
}): Promise<{ readonly success: boolean; readonly result?: PlanningResetCascadeResult; readonly message?: string }> {
  const projectId = input.projectId.trim();
  if (!projectId) return { success: false, message: "projectId가 필요합니다." };
  const res = await credentialsIncludeFetch(
    `/api/projects/${encodeURIComponent(projectId)}/planning-reset-cascade`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason ?? "planning_reset" }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: PlanningResetCascadeResult;
    message?: string;
  };
  if (!res.ok) {
    return { success: false, message: data.message ?? `HTTP ${res.status}` };
  }
  return { success: true, result: data.result };
}
