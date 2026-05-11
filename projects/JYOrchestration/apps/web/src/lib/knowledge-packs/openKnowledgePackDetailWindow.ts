import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import { suggestedOuterWindowSize } from "@/lib/ui/workingSurfaceLayout";
import {
  inferDefaultWorkspaceModeFromWidth,
  JYO_LAYOUT_PREVIEW_PARAM,
  parseLayoutPreviewParam,
  readLayoutPreviewSessionMode,
  readStoredWorkspaceMode,
  resolveEffectiveLayout,
  WORKSPACE_AUTO_BREAKPOINT_PX,
  type WorkspaceEffectiveLayout,
  type WorkspaceMode,
} from "@/lib/ui/workspaceMode";

export type OpenKnowledgePackDetailWindowOptions = Readonly<{
  /** 설정 > 화면 레이아웃과 동일 소스(`useWorkspaceMode`)에서 넘기면 창 크기·미리보기 URL이 맞춰진다. */
  workspaceMode?: WorkspaceMode;
  effectiveLayout?: WorkspaceEffectiveLayout;
}>;

/**
 * `WorkspaceModeProvider` 부트스트랩 순서와 동일하게 모드·유효 레이아웃을 정한다.
 * (세션 미리보기 → URL 파라미터 → localStorage → 뷰포트 추정)
 */
export function resolveKnowledgePackOpenLayout(
  opts?: OpenKnowledgePackDetailWindowOptions
): Readonly<{ mode: WorkspaceMode; effectiveLayout: WorkspaceEffectiveLayout }> {
  if (typeof window === "undefined") {
    return { mode: "AUTO", effectiveLayout: "DESKTOP" };
  }
  if (opts?.workspaceMode != null && opts?.effectiveLayout != null) {
    return { mode: opts.workspaceMode, effectiveLayout: opts.effectiveLayout };
  }

  const mqMobile = window.innerWidth < WORKSPACE_AUTO_BREAKPOINT_PX;

  const fromSession = readLayoutPreviewSessionMode();
  if (fromSession) {
    return { mode: fromSession, effectiveLayout: resolveEffectiveLayout(fromSession, mqMobile) };
  }
  const fromUrl = parseLayoutPreviewParam(window.location.search);
  if (fromUrl) {
    return { mode: fromUrl, effectiveLayout: resolveEffectiveLayout(fromUrl, mqMobile) };
  }
  const stored = readStoredWorkspaceMode();
  if (stored) {
    return { mode: stored, effectiveLayout: resolveEffectiveLayout(stored, mqMobile) };
  }
  const inferred = inferDefaultWorkspaceModeFromWidth(window.innerWidth);
  return { mode: inferred, effectiveLayout: resolveEffectiveLayout(inferred, mqMobile) };
}

function pickPopupDimensions(effectiveLayout: WorkspaceEffectiveLayout): Readonly<{ w: number; h: number }> {
  if (typeof window === "undefined") return { w: 960, h: 820 };
  if (effectiveLayout === "MOBILE") {
    const margin = 12;
    const ah = typeof window.screen?.availHeight === "number" ? window.screen.availHeight : 800;
    const w = Math.min(430, Math.max(300, window.innerWidth - margin));
    const h = Math.min(ah - margin * 2, Math.max(480, window.innerHeight - margin));
    return { w, h };
  }
  const aw = typeof window.screen?.availWidth === "number" ? window.screen.availWidth : 1280;
  const ah = typeof window.screen?.availHeight === "number" ? window.screen.availHeight : 800;
  return suggestedOuterWindowSize("knowledge", aw, ah);
}

/** 팝업 차단 시 `_blank`용 — `__jyo_layout_preview`로 새 탭 레이아웃과 맞춘다. */
export function buildKnowledgePackDetailAbsoluteUrl(packId: string, mode: WorkspaceMode): string {
  const id = packId.trim();
  const u = new URL(`${window.location.origin}/knowledge-packs/detail`);
  u.searchParams.set("id", id);
  u.searchParams.set(JYO_LAYOUT_PREVIEW_PARAM, mode.toLowerCase());
  return u.toString();
}

/**
 * 지식팩 상세를 별도 창으로 연다. 사용자 클릭 핸들러에서만 호출(팝업 차단 방지).
 * 화면 레이아웃(데스크톱/모바일/자동)에 맞춰 창 크기를 잡고, URL에 미리보기 쿼리를 붙여 새 창 UI와 동기화한다.
 *
 * **브라우저 헤더(주소창·탭):** `menubar`/`toolbar`/`location` 등은 요청만 가능하며,
 * Chromium 계열은 피싱 방지를 위해 **주소창(오리진)을 숨기지 않는다.**
 * 완전 무크롬 창은 웹 `window.open`만으로는 불가이며, 데스크톱 래퍼(Electron 등)나
 * PWA `display: standalone` 설치 화면 등 별도 배포가 필요하다.
 */
export function openKnowledgePackDetailWindow(
  packId: string,
  options?: OpenKnowledgePackDetailWindowOptions
): Window | null {
  if (typeof window === "undefined") return null;
  const id = packId.trim();
  if (!id) return null;

  const { mode, effectiveLayout } = resolveKnowledgePackOpenLayout(options);
  const url = buildKnowledgePackDetailAbsoluteUrl(id, mode);
  const { w, h } = pickPopupDimensions(effectiveLayout);
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const features = [
    "popup=yes",
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
    "menubar=no",
    "toolbar=no",
    "status=no",
    /** 요청만 가능 — Chromium 등은 보안상 무시하고 주소창을 띄운다. */
    "location=no",
  ].join(",");
  const win = window.open(url, `jyo-knowledge-pack-${encodeURIComponent(id)}`, features);
  try {
    if (win) win.opener = null;
  } catch {
    /* noop */
  }
  registerPlatformPopupFromOpenedUrl(win, url);
  return win;
}
