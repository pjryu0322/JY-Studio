import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import { appFlowStepHref } from "@/lib/workflow/flow-state";

/**
 * 플랫폼 UI 전용 “화면 레이아웃”(데스크톱/모바일/자동). 프로토타입 생성/배포 설정과 무관합니다.
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

/** 작업 모드(데스크톱/모바일/자동)에 맞춘 팝업 창 크기 */
export function workspacePopupDimensions(mode: WorkspaceMode): Readonly<{ w: number; h: number }> {
  return PREVIEW_WIN[mode];
}

/**
 * 현재 URL을 그대로 두고 화면 레이아웃 미리보기용 창을 연다(사용자 클릭 핸들러에서만 호출).
 * `noopener`로 오프너와 분리; 대상 탭은 URL·세션으로 모드를 잡는다.
 */
export function openWorkspaceModePreviewWindow(mode: WorkspaceMode): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set(JYO_LAYOUT_PREVIEW_PARAM, mode.toLowerCase());
    const href = u.toString();
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
    const opened = window.open(href, `jyo-workspace-${mode}`, `noopener,noreferrer,${feats}`);
    registerPlatformPopupFromOpenedUrl(opened, href);
  } catch {
    /* popup 차단 등 */
  }
}

/**
 * 상대 경로+쿼리에 `__jyo_layout_preview`를 붙인 문자열 (href·복사용).
 * 호스트 없이 `pathname + search + hash`만 반환합니다.
 */
export function buildPathWithLayoutPreview(
  pathnameAndSearch: string,
  preview: "mobile" | "desktop" | "auto"
): string {
  const u = new URL(pathnameAndSearch, "http://localhost");
  u.searchParams.set(JYO_LAYOUT_PREVIEW_PARAM, preview);
  return `${u.pathname}${u.search}${u.hash}`;
}

/** 현재 저장된 화면 레이아웃과 동일한 미리보기 쿼리를 붙입니다. */
export function buildPathWithWorkspaceModePreview(pathnameAndSearch: string, mode: WorkspaceMode): string {
  return buildPathWithLayoutPreview(
    pathnameAndSearch,
    mode.toLowerCase() as "mobile" | "desktop" | "auto"
  );
}

/**
 * 지정 URL을 현재 화면 레이아웃에 맞는 레이아웃·창 크기로 연다 (`PREVIEW_WIN`과 URL 쿼리 동기화).
 * 모바일 브라우저에서는 보통 전체 탭으로 열리며, 쿼리로 레이아웃이 고정된다.
 */
export function openUrlInWorkspaceModePreviewWindow(
  pathnameAndSearch: string,
  windowName: string,
  mode: WorkspaceMode
): void {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(pathnameAndSearch, window.location.origin);
    u.searchParams.set(JYO_LAYOUT_PREVIEW_PARAM, mode.toLowerCase());
    const href = u.toString();
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
    let opened = window.open(href, windowName, `noopener,noreferrer,${feats}`);
    if (!opened) {
      opened = window.open(href, windowName, "noopener,noreferrer");
    }
    if (opened) {
      try {
        opened.focus();
      } catch {
        /* noop */
      }
    }
    registerPlatformPopupFromOpenedUrl(opened, href);
  } catch {
    /* popup 차단 등 */
  }
}

/** 동일 `projectId`는 항상 같은 보조 창에서만 열리도록 고정(`window.name`). 프로젝트 목록과 동일 접두사 유지. */
export function projectRoomWindowName(projectId: string): string {
  const id = String(projectId ?? "").trim();
  if (!id) return "jyo-idea-_";
  return `jyo-idea-${encodeURIComponent(id)}`;
}

/** 현재 탭이 이미 해당 프로젝트 룸 URL을 보고 있는지 */
function isCurrentWindowOnProjectRoomUrl(projectId: string, pathnameAndSearch: string): boolean {
  try {
    const pid = projectId.trim();
    const target = new URL(pathnameAndSearch, window.location.origin);
    const cur = new URL(window.location.href);
    if (cur.pathname !== target.pathname) return false;
    return (cur.searchParams.get("projectId") ?? "").trim() === pid;
  } catch {
    return false;
  }
}

/**
 * 프로젝트 룸(기본: 요구사항 SingleChat)을 전용 창으로 연다.
 * 같은 `projectId`로 다시 호출하면 기존 창이 포커스되고 URL이 갱신된다.
 */
export function openProjectRoomWindow(projectId: string, mode: WorkspaceMode, pathnameAndSearch?: string): Window | null {
  if (typeof window === "undefined") return null;
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;
  const path = (pathnameAndSearch ?? appFlowStepHref("requirements", pid)).trim();
  try {
    const u = new URL(path, window.location.origin);
    u.searchParams.set(JYO_LAYOUT_PREVIEW_PARAM, mode.toLowerCase());
    const href = u.toString();
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
    const name = projectRoomWindowName(pid);
    // 프로젝트 팝업에서 /chat 등으로 이동한 뒤에는 window.name이 jyo-idea-* 로 남을 수 있음.
    // 동일 name으로 open 하면 현재(메신저) 창이 프로젝트 URL로 바뀌므로, 별도 창으로 연다.
    const mustOpenSeparateWindow =
      window.name === name && !isCurrentWindowOnProjectRoomUrl(pid, path);
    const targetName = mustOpenSeparateWindow ? "_blank" : name;
    // `noopener` in windowFeatures makes `window.open` return null even when the popup opens.
    let opened = window.open(href, targetName, feats);
    if (!opened) {
      opened = window.open(href, targetName);
    }
    if (opened) {
      try {
        opened.opener = null;
      } catch {
        /* noop */
      }
      try {
        opened.focus();
      } catch {
        /* noop */
      }
    }
    registerPlatformPopupFromOpenedUrl(opened, href);
    return opened;
  } catch {
    return null;
  }
}
