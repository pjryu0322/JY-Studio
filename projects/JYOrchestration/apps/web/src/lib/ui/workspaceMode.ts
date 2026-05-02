/**
 * 플랫폼 UI 전용 “작업모드”. 프로토타입 생성/배포 설정과 무관합니다.
 */
export const WORKSPACE_MODE_STORAGE_KEY = "jyo:workspaceMode";

export type WorkspaceMode = "DESKTOP" | "MOBILE" | "AUTO";

export type WorkspaceEffectiveLayout = "DESKTOP" | "MOBILE";

/** `useLayoutMobileBreakpoint` / AUTO 판별과 동일 (1024px 미만 → 모바일). */
export const WORKSPACE_AUTO_BREAKPOINT_PX = 1024;

export function parseWorkspaceMode(raw: string | null | undefined): WorkspaceMode | null {
  const u = String(raw ?? "").trim().toUpperCase();
  if (u === "DESKTOP" || u === "MOBILE" || u === "AUTO") return u;
  return null;
}

export function readStoredWorkspaceMode(): WorkspaceMode | null {
  try {
    if (typeof window === "undefined") return null;
    return parseWorkspaceMode(window.localStorage.getItem(WORKSPACE_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredWorkspaceMode(mode: WorkspaceMode): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WORKSPACE_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

/** 저장값 없을 때: 뷰포트 너비로 기본(모바일 접속 → MOBILE, PC → DESKTOP). */
export function inferDefaultWorkspaceModeFromWidth(widthPx: number): WorkspaceMode {
  return widthPx < WORKSPACE_AUTO_BREAKPOINT_PX ? "MOBILE" : "DESKTOP";
}

export function resolveEffectiveLayout(mode: WorkspaceMode, layoutMqIsMobile: boolean): WorkspaceEffectiveLayout {
  if (mode === "DESKTOP") return "DESKTOP";
  if (mode === "MOBILE") return "MOBILE";
  return layoutMqIsMobile ? "MOBILE" : "DESKTOP";
}
