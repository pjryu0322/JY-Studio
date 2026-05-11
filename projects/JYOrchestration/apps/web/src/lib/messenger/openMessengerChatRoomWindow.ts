import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import type { WorkspaceEffectiveLayout } from "@/lib/ui/workspaceMode";

export type OpenMessengerChatRoomWindowOptions = Readonly<{
  /** 현재 탭 작업모드와 맞추면, 새 창 크기를 모바일·데스크톱에 맞게 잡는다. */
  effectiveLayout?: WorkspaceEffectiveLayout;
  /**
   * true이면 URL에 `discardEmpty=1`을 붙인다.
   * 레일에서 새 방을 연 뒤 사용자가 한 건도 보내지 않고 창을 나가면 클라이언트가 방 삭제(DELETE)를 요청한다.
   */
  discardEmptyOnClose?: boolean;
}>;

/**
 * 메신저 대화방을 별도 브라우저 창(또는 탭)으로 연다.
 * 반드시 사용자 제스처(클릭 등)에서 호출해야 팝업 차단을 피할 수 있다.
 */
export function openMessengerChatRoomWindow(roomId: string, options?: OpenMessengerChatRoomWindowOptions): Window | null {
  if (typeof window === "undefined") return null;
  const id = roomId.trim();
  if (!id) return null;
  const q = options?.discardEmptyOnClose ? "?discardEmpty=1" : "";
  const url = `${window.location.origin}/chat/${encodeURIComponent(id)}${q}`;
  const layout = options?.effectiveLayout ?? "DESKTOP";

  let w: number;
  let h: number;
  if (layout === "MOBILE") {
    const margin = 12;
    // 좁은 작업 영역(모바일 모드·분할 창)에 맞춰 폭을 잡고, 높이는 사용 가능한 세로 공간을 쓴다.
    w = Math.min(430, Math.max(300, window.innerWidth - margin));
    h = Math.min(window.screen.availHeight - margin * 2, Math.max(480, window.innerHeight - margin));
  } else {
    const margin = 48;
    w = Math.min(1280, Math.max(520, window.screen.availWidth - margin));
    h = Math.min(960, Math.max(420, window.screen.availHeight - margin));
  }
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const features = [
    `popup=yes`,
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
    "menubar=no",
    "toolbar=no",
    "status=no",
    "location=yes",
  ].join(",");
  const win = window.open(url, `jyo-messenger-chat-${encodeURIComponent(id)}`, features);
  try {
    if (win) win.opener = null;
  } catch {
    /* noop */
  }
  registerPlatformPopupFromOpenedUrl(win, url);
  return win;
}
