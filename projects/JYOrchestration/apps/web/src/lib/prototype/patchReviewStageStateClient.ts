import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export async function patchProjectRequirementsStateJsonClient(
  projectId: string,
  currentRequirementsStateJson: unknown,
  patch: Partial<RequirementsStateJson>,
): Promise<{ success: boolean; merged?: RequirementsStateJson; message?: string }> {
  const pid = projectId.trim();
  if (!pid) {
    return { success: false, message: "projectId가 없습니다." };
  }
  const base = parseRequirementsStateJson(currentRequirementsStateJson);
  const merged = mergeRequirementsStateJson(base, patch);
  const { res, json } = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
  const body = json as { success?: boolean; message?: string };
  if (!res.ok || !body.success) {
    return {
      success: false,
      message: body.message ?? "requirementsStateJson 저장에 실패했습니다.",
    };
  }
  return { success: true, merged };
}
