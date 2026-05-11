"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  desktopMainMaxWidthPx,
  normalizePathnameOnly,
  POST_LOGIN_WINDOW_LAYOUT_KEY,
  resolveWorkingSurfaceFromPathname,
  suggestedOuterWindowSize,
  type PostLoginWindowLayoutPayload,
} from "@/lib/ui/workingSurfaceLayout";

function applyPostLoginWindowSizingIfQueued(pathname: string): void {
  if (typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(POST_LOGIN_WINDOW_LAYOUT_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let parsed: PostLoginWindowLayoutPayload | null = null;
  try {
    parsed = JSON.parse(raw) as PostLoginWindowLayoutPayload;
  } catch {
    try {
      sessionStorage.removeItem(POST_LOGIN_WINDOW_LAYOUT_KEY);
    } catch {
      /* noop */
    }
    return;
  }
  const want = normalizePathnameOnly(String(parsed?.path ?? "/"));
  const cur = normalizePathnameOnly(pathname);
  if (want !== cur) return;
  try {
    sessionStorage.removeItem(POST_LOGIN_WINDOW_LAYOUT_KEY);
  } catch {
    /* noop */
  }
  const surface = resolveWorkingSurfaceFromPathname(cur);
  const aw = typeof window.screen?.availWidth === "number" ? window.screen.availWidth : 1280;
  const ah = typeof window.screen?.availHeight === "number" ? window.screen.availHeight : 800;
  const { w, h } = suggestedOuterWindowSize(surface, aw, ah);
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  try {
    window.resizeTo(w, h);
    window.moveTo(left, top);
  } catch {
    /* 일반 탭에서는 브라우저가 resize/move 를 막을 수 있음 */
  }
}

/**
 * 경로에 따라 `document.documentElement`에 작업 표면을 기록하고,
 * 로그인 직후 한 번 바깥 창 크기를 권장 크기로 맞추려 시도합니다.
 */
export function WorkingSurfaceLayoutEffect() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const pathOnly = normalizePathnameOnly(pathname);
    if (pathOnly === "/login" || pathOnly.startsWith("/login/")) {
      delete document.documentElement.dataset.jyoWorkingSurface;
      document.documentElement.style.removeProperty("--jyo-platform-main-max-width");
      return;
    }
    const surface = resolveWorkingSurfaceFromPathname(pathOnly);
    document.documentElement.dataset.jyoWorkingSurface = surface;
    document.documentElement.style.setProperty("--jyo-platform-main-max-width", `${desktopMainMaxWidthPx(surface)}px`);
    applyPostLoginWindowSizingIfQueued(pathOnly);
  }, [pathname]);

  return null;
}
