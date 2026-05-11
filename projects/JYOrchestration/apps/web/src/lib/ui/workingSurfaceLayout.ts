/**
 * 플랫폼 본문(PlatformMainFrame) 가로 폭·로그인 직후 창 크기 힌트용 “작업 표면”.
 * 프로토타입 실행 설정과 무관합니다.
 */
export type WorkingSurfaceId = "messenger" | "workspace" | "knowledge" | "requirements" | "settings" | "general";

export const POST_LOGIN_WINDOW_LAYOUT_KEY = "jyo:postLoginWindowLayout";

export type PostLoginWindowLayoutPayload = Readonly<{
  /** 로그인 후 이동할 경로(pathname; 쿼리 없이). */
  readonly path: string;
}>;

export function normalizePathnameOnly(hrefOrPath: string): string {
  const s = String(hrefOrPath ?? "").trim();
  if (!s) return "/";
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const u = new URL(s.startsWith("/") ? `${base}${s}` : s, base);
    const p = u.pathname.trim() || "/";
    return p.startsWith("/") ? p : `/${p}`;
  } catch {
    const q = s.split("?")[0]?.trim() || "/";
    return q.startsWith("/") ? q : `/${q}`;
  }
}

export function resolveWorkingSurfaceFromPathname(pathname: string): WorkingSurfaceId {
  const p = normalizePathnameOnly(pathname);

  if (p === "/knowledge-packs" || p.startsWith("/knowledge-packs/")) return "knowledge";
  if (p === "/workspace" || p.startsWith("/workspace/")) return "workspace";

  if (
    p === "/requirements" ||
    p.startsWith("/requirements/") ||
    p === "/features" ||
    p === "/tasks" ||
    p === "/execution" ||
    p === "/prototype-review" ||
    p === "/trace" ||
    p === "/planning-execution" ||
    p.startsWith("/projects/") ||
    p.startsWith("/collaboration/") ||
    p.startsWith("/project-members") ||
    p.startsWith("/project-admin") ||
    p === "/integrations"
  ) {
    return "requirements";
  }

  if (p === "/account" || p === "/settings" || p.startsWith("/settings/") || p.startsWith("/admin/")) {
    return "settings";
  }

  if (
    p === "/" ||
    p.startsWith("/chat/") ||
    p === "/notifications" ||
    p.startsWith("/notifications/") ||
    p === "/work-notes" ||
    p.startsWith("/work-notes/")
  ) {
    return "messenger";
  }

  return "general";
}

/** 데스크톱 본문 max-width(px) — CSS에서 min(100%, Npx)로 쓰임 */
export function desktopMainMaxWidthPx(surface: WorkingSurfaceId): number {
  switch (surface) {
    case "messenger":
      return 1220;
    case "workspace":
      return 1760;
    case "knowledge":
      return 1680;
    case "requirements":
      return 1920;
    case "settings":
      return 960;
    default:
      return 1920;
  }
}

/**
 * 로그인 직후 한 번 적용할 바깥 창 크기(브라우저가 허용하는 경우에만).
 * `screen.avail*` 안에서 클램프합니다.
 */
export function suggestedOuterWindowSize(
  surface: WorkingSurfaceId,
  availW: number,
  availH: number
): Readonly<{ w: number; h: number }> {
  const margin = 40;
  const caps: Record<WorkingSurfaceId, { w: number; h: number }> = {
    messenger: { w: 1320, h: 860 },
    workspace: { w: 1540, h: 920 },
    knowledge: { w: 1480, h: 900 },
    requirements: { w: 1680, h: 960 },
    settings: { w: 1100, h: 820 },
    general: { w: 1440, h: 880 },
  };
  const target = caps[surface];
  const w = Math.min(availW - margin, Math.max(720, target.w));
  const h = Math.min(availH - margin, Math.max(560, target.h));
  return { w, h };
}

export function queuePostLoginWindowLayout(targetPath: string): void {
  if (typeof window === "undefined") return;
  try {
    const path = normalizePathnameOnly(targetPath);
    const payload: PostLoginWindowLayoutPayload = { path };
    sessionStorage.setItem(POST_LOGIN_WINDOW_LAYOUT_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}
