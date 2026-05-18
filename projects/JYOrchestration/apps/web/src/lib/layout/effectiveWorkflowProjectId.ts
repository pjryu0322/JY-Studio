import type { ReadonlyURLSearchParams } from "next/navigation";
import { readLastFlowProjectId, resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

/**
 * `?projectId=` 없을 때 `readLastFlowProjectId` 폴백을 쓰지 않는 플랫폼 표면.
 * 여기서는 메신저형 좌측 레일(채팅·워크스페이스·지식팩 등)을 유지하고 프로젝트 워크플로 레일로 바꾸지 않는다.
 */
export function isPlatformGlobalMessengerRailPath(pathOnly: string): boolean {
  const p = (pathOnly.split("?")[0] || "/").trim() || "/";
  if (p === "/" || p === "/workspace") return true;
  if (p === "/work-notes" || p.startsWith("/work-notes/")) return true;
  if (p === "/knowledge-packs" || p.startsWith("/knowledge-packs/")) return true;
  if (p === "/notifications" || p.startsWith("/notifications/")) return true;
  if (p === "/account" || p.startsWith("/account/")) return true;
  if (p === "/settings" || p.startsWith("/settings/")) return true;
  if (p === "/admin" || p.startsWith("/admin/")) return true;
  if (p === "/integrations" || p.startsWith("/integrations/")) return true;
  if (p === "/prompt-timeline" || p.startsWith("/prompt-timeline/")) return true;
  return false;
}

/**
 * URL·쿼리의 projectId가 없을 때 session 마지막 프로젝트로 레일을 유지합니다.
 * 홈·워크스페이스·지식팩·알림·계정 등 플랫폼 표면과 메신저 대화(`/chat/…`)에서는 레일용 프로젝트 컨텍스트(폴백)를 넣지 않습니다.
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
  if (isPlatformGlobalMessengerRailPath(pathOnly)) return null;
  const fallback = readLastFlowProjectId()?.trim() ?? "";
  return fallback || null;
}
