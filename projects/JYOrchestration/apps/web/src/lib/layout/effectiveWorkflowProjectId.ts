import type { ReadonlyURLSearchParams } from "next/navigation";
import { readLastFlowProjectId, resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

/**
 * URL·쿼리의 projectId가 없을 때 session 마지막 프로젝트로 레일을 유지합니다.
 * 홈·워크스페이스 목록·`:메모`(`/work-notes` 단독)·메신저 대화(`/chat/…`)에서는 레일용 프로젝트 컨텍스트를 넣지 않습니다.
 * (`/work-notes?projectId=`가 있으면 해당 프로젝트는 그대로 사용.)
 */
export function resolveEffectiveWorkflowProjectId(
  pathname: string,
  searchParams: ReadonlyURLSearchParams | URLSearchParams | null
): string | null {
  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  // 메신저 전용 경로: 세션 마지막 프로젝트 폴백으로 워크플로 레일이 덮어쓰이지 않게 한다.
  if (pathOnly.startsWith("/chat/")) return null;
  const projectId = resolveWorkflowProjectContextId(pathname, searchParams as URLSearchParams | null);
  const pid = String(projectId ?? "").trim();
  if (pid) return pid;
  if (pathOnly === "/" || pathOnly === "/workspace" || pathOnly === "/work-notes") return null;
  const fallback = readLastFlowProjectId()?.trim() ?? "";
  return fallback || null;
}
