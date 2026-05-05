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

/** 새 창 미리보기 URL — 이 탭만 `sessionStorage`와 함께 쓰면 부모 탭 `localStorage`와 섞이지 않음 */
export const JYO_LAYOUT_PREVIEW_PARAM = "__jyo_layout_preview";

const LAYOUT_PREVIEW_SESSION_KEY = "jyo:workspaceLayoutPreviewTab";

export function readLayoutPreviewSessionMode(): WorkspaceMode | null {
  try {
    if (typeof window === "undefined") return null;
    return parseWorkspaceMode(window.sessionStorage.getItem(LAYOUT_PREVIEW_SESSION_KEY));
  } catch {
    return null;
  }
}

export function writeLayoutPreviewSessionMode(mode: WorkspaceMode): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(LAYOUT_PREVIEW_SESSION_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** `?__jyo_layout_preview=mobile|desktop|auto` */
export function parseLayoutPreviewParam(search: string): WorkspaceMode | null {
  try {
    const q = new URLSearchParams(String(search).replace(/^\?/, ""));
    const raw = String(q.get(JYO_LAYOUT_PREVIEW_PARAM) ?? "").trim().toLowerCase();
    if (raw === "mobile") return "MOBILE";
    if (raw === "desktop") return "DESKTOP";
    if (raw === "auto") return "AUTO";
    return null;
  } catch {
    return null;
  }
}

export function stripLayoutPreviewParamFromAddressBar(): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(JYO_LAYOUT_PREVIEW_PARAM)) return;
    u.searchParams.delete(JYO_LAYOUT_PREVIEW_PARAM);
    const s = u.searchParams.toString();
    const qs = s ? `?${s}` : "";
    window.history.replaceState(null, "", `${u.pathname}${qs}${u.hash}`);
  } catch {
    /* ignore */
  }
}

/** 미리보기 탭에서만 세션을 `localStorage`와 동기화(새로고침 유지) */
export function syncLayoutPreviewSessionIfOpen(next: WorkspaceMode): void {
  try {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(LAYOUT_PREVIEW_SESSION_KEY) === null) return;
    window.sessionStorage.setItem(LAYOUT_PREVIEW_SESSION_KEY, next);
  } catch {
    /* ignore */
  }
}

const PREVIEW_WIN: Record<WorkspaceMode, { w: number; h: number }> = {
  MOBILE: { w: 430, h: 900 },
  DESKTOP: { w: 1360, h: 880 },
  AUTO: { w: 1180, h: 860 },
};

/**
 * 현재 URL을 그대로 두고 작업모드 미리보기용 창을 연다(사용자 클릭 핸들러에서만 호출).
 * `noopener`로 오프너와 분리; 대상 탭은 URL·세션으로 모드를 잡는다.
 */
export function openWorkspaceModePreviewWindow(mode: WorkspaceMode): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set(JYO_LAYOUT_PREVIEW_PARAM, mode.toLowerCase());
    const { w, h } = PREVIEW_WIN[mode];
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
    const feats = [
      `width=${w}`,
      `height=${h}`,
      `left=${left}`,
      `top=${top}`,
      "scrollbars=yes",
      "resizable=yes",
      "menubar=no",
      "toolbar=no",
    ].join(",");
    window.open(u.toString(), `jyo-workspace-${mode}`, `noopener,noreferrer,${feats}`);
  } catch {
    /* popup 차단 등 */
  }
}
