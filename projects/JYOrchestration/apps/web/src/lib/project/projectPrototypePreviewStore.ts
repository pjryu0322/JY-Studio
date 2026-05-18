/** 프로젝트별 프로토타입 Preview 뷰포트 설정 (localStorage, 브라우저 단위) */

import type {
  PrototypePreviewMobileDevice,
  PrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";
import {
  isPrototypePreviewMobileDevice,
  isPrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";

export type ProjectPrototypePreviewSnapshot = {
  prototypePreviewWorkMode: PrototypePreviewWorkMode;
  prototypePreviewMobileDevice: PrototypePreviewMobileDevice;
};

export const PROJECT_PROTOTYPE_PREVIEW_CHANGED_EVENT = "jyo:project-prototype-preview-changed";

const LEGACY_KEYS = {
  workMode: "jyo:pref:prototype-preview-work-mode",
  mobileDevice: "jyo:pref:prototype-preview-mobile-device",
} as const;

function storageKey(projectId: string): string {
  return `jyo:proj:${encodeURIComponent(projectId.trim())}:prototypePreview`;
}

function dispatch(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROJECT_PROTOTYPE_PREVIEW_CHANGED_EVENT, { detail: { projectId: projectId.trim() } }),
  );
}

function migrateLegacyOnce(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    const k = storageKey(projectId);
    if (window.localStorage.getItem(k)) return;
    const lw = window.localStorage.getItem(LEGACY_KEYS.workMode);
    const lm = window.localStorage.getItem(LEGACY_KEYS.mobileDevice);
    if (!lw && !lm) return;
    const wm =
      lw && isPrototypePreviewWorkMode(lw) ? lw : ("auto" satisfies PrototypePreviewWorkMode);
    const md =
      lm && isPrototypePreviewMobileDevice(lm) ? lm : ("iphone" satisfies PrototypePreviewMobileDevice);
    window.localStorage.setItem(k, JSON.stringify({ workMode: wm, mobileDevice: md }));
    window.localStorage.removeItem(LEGACY_KEYS.workMode);
    window.localStorage.removeItem(LEGACY_KEYS.mobileDevice);
    dispatch(projectId);
  } catch {
    /* ignore */
  }
}

export function readProjectPrototypePreviewSnapshot(projectId: string): ProjectPrototypePreviewSnapshot {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return { prototypePreviewWorkMode: "auto", prototypePreviewMobileDevice: "iphone" };
  }
  if (typeof window === "undefined") {
    return { prototypePreviewWorkMode: "auto", prototypePreviewMobileDevice: "iphone" };
  }
  migrateLegacyOnce(pid);
  try {
    const raw = window.localStorage.getItem(storageKey(pid));
    if (!raw) {
      return { prototypePreviewWorkMode: "auto", prototypePreviewMobileDevice: "iphone" };
    }
    const parsed = JSON.parse(raw) as { workMode?: unknown; mobileDevice?: unknown };
    const ws = parsed.workMode != null ? String(parsed.workMode) : "";
    const ds = parsed.mobileDevice != null ? String(parsed.mobileDevice) : "";
    const wm: PrototypePreviewWorkMode = isPrototypePreviewWorkMode(ws) ? ws : "auto";
    const md: PrototypePreviewMobileDevice = isPrototypePreviewMobileDevice(ds) ? ds : "iphone";
    return { prototypePreviewWorkMode: wm, prototypePreviewMobileDevice: md };
  } catch {
    return { prototypePreviewWorkMode: "auto", prototypePreviewMobileDevice: "iphone" };
  }
}

function writeSnapshot(projectId: string, next: ProjectPrototypePreviewSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(projectId),
      JSON.stringify({
        workMode: next.prototypePreviewWorkMode,
        mobileDevice: next.prototypePreviewMobileDevice,
      }),
    );
    dispatch(projectId);
  } catch {
    /* ignore */
  }
}

export function writeProjectPrototypePreviewWorkMode(
  projectId: string,
  value: PrototypePreviewWorkMode,
): void {
  const pid = String(projectId ?? "").trim();
  if (!pid) return;
  const cur = readProjectPrototypePreviewSnapshot(pid);
  writeSnapshot(pid, { ...cur, prototypePreviewWorkMode: value });
}

export function writeProjectPrototypePreviewMobileDevice(
  projectId: string,
  value: PrototypePreviewMobileDevice,
): void {
  const pid = String(projectId ?? "").trim();
  if (!pid) return;
  const cur = readProjectPrototypePreviewSnapshot(pid);
  writeSnapshot(pid, { ...cur, prototypePreviewMobileDevice: value });
}

/** `useSyncExternalStore` 첫 인자: `(onStoreChange) => unsubscribe` */
export function subscribeProjectPrototypePreview(
  onStoreChange: () => void,
  projectId: string,
): () => void {
  if (typeof window === "undefined") return () => {};
  const pid = String(projectId ?? "").trim();
  if (!pid) return () => {};
  const KEY = storageKey(pid);
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<{ projectId?: string }>).detail?.projectId;
    if (d === pid) onStoreChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onStoreChange();
  };
  window.addEventListener(PROJECT_PROTOTYPE_PREVIEW_CHANGED_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PROJECT_PROTOTYPE_PREVIEW_CHANGED_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
