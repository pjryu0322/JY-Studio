import type { ReadonlyURLSearchParams } from "next/navigation";
import { readLastFlowProjectId, resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

/**
 * URL·쿼리의 projectId가 없을 때 session 마지막 프로젝트로 레일을 유지합니다.
 * 홈·워크스페이스 목록에서는 레일용 프로젝트 컨텍스트를 넣지 않습니다.
 */
export function resolveEffectiveWorkflowProjectId(
  pathname: string,
  searchParams: ReadonlyURLSearchParams | URLSearchParams | null
): string | null {
  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  const projectId = resolveWorkflowProjectContextId(pathname, searchParams as URLSearchParams | null);
  const pid = String(projectId ?? "").trim();
  if (pid) return pid;
  if (pathOnly === "/" || pathOnly === "/workspace") return null;
  const fallback = readLastFlowProjectId()?.trim() ?? "";
  return fallback || null;
}
