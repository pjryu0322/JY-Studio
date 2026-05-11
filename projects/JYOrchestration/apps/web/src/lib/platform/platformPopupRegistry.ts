/**
 * 플랫폼에서 `window.open`으로 연 같은 출처 창을 추적하고, 로그아웃 시 닫는다.
 * `noopener`로 오프너가 끊겨도 반환된 `Window` 참조로 `close()` 할 수 있다.
 */

export const JYO_PLATFORM_LOGOUT_BROADCAST = "jyo-platform-logout-v1";

const tracked = new Set<Window>();

function pruneClosed(): void {
  for (const w of tracked) {
    if (w.closed) tracked.delete(w);
  }
}

/** 로그아웃 시 자동으로 닫을 보조 창(`window.name` 접두사). */
export function isJyoPlatformAuxiliaryWindowName(name: string | undefined | null): boolean {
  const n = String(name ?? "");
  return (
    n.startsWith("jyo-messenger-chat-") ||
    n.startsWith("jyo-workspace-") ||
    n.startsWith("jyo-idea-")
  );
}

/**
 * 같은 출처로 열린 창만 등록한다(외부 PR·배포 URL 등은 제외).
 * `openedUrl`은 절대 또는 경로+쿼리 문자열.
 */
export function registerPlatformPopupFromOpenedUrl(opened: Window | null | undefined, openedUrl: string): void {
  if (typeof window === "undefined" || !opened || opened.closed) return;
  try {
    const origin = new URL(openedUrl, window.location.origin).origin;
    if (origin !== window.location.origin) return;
  } catch {
    return;
  }
  pruneClosed();
  tracked.add(opened);
}

export function notifyPlatformLogoutCloseWindows(): void {
  pruneClosed();
  for (const w of [...tracked]) {
    try {
      if (!w.closed) w.close();
    } catch {
      /* ignore */
    }
    tracked.delete(w);
  }
  try {
    const bc = new BroadcastChannel(JYO_PLATFORM_LOGOUT_BROADCAST);
    bc.postMessage({ type: "logout" } as const);
    bc.close();
  } catch {
    /* ignore */
  }
}

/** 루트 클라이언트에서 한 번 구독: 다른 탭에서 로그아웃 시 이 창이 보조 창이면 닫는다. */
export function subscribePlatformLogoutCloseSelf(): () => void {
  if (typeof window === "undefined") return () => {};
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(JYO_PLATFORM_LOGOUT_BROADCAST);
    bc.onmessage = (ev: MessageEvent<{ readonly type?: string }>) => {
      if (ev.data?.type !== "logout") return;
      if (isJyoPlatformAuxiliaryWindowName(window.name)) {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }
    };
  } catch {
    return () => {};
  }
  return () => {
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
    bc = null;
  };
}
