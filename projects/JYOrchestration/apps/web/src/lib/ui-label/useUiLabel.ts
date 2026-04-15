"use client";

import { useCallback, useEffect, useState } from "react";

/** 화면 라벨 표시 (요구 키명) */
export const UI_LABELS_STORAGE_KEY = "jy-show-screen-labels";

const LEGACY_SHOW_UI_LABELS = "showUiLabels";

/** 이전 키에서 한 번만 마이그레이션 */
const LEGACY_LABELS_STORAGE_KEY = "jy_debug_labels";

export const UI_LABELS_CHANGED_EVENT = "jy-ui-labels-changed";

function migrateLegacyIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(UI_LABELS_STORAGE_KEY);
    if (current === "true" || current === "false") return;
    const fromShowUi = window.localStorage.getItem(LEGACY_SHOW_UI_LABELS);
    if (fromShowUi === "true") {
      window.localStorage.setItem(UI_LABELS_STORAGE_KEY, "true");
      return;
    }
    if (fromShowUi === "false") {
      window.localStorage.setItem(UI_LABELS_STORAGE_KEY, "false");
      return;
    }
    const legacy = window.localStorage.getItem(LEGACY_LABELS_STORAGE_KEY);
    if (legacy === "true") {
      window.localStorage.setItem(UI_LABELS_STORAGE_KEY, "true");
    } else if (legacy === "false") {
      window.localStorage.setItem(UI_LABELS_STORAGE_KEY, "false");
    }
  } catch {
    /* private mode 등 */
  }
}

export function readUiLabelsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    migrateLegacyIfNeeded();
    return window.localStorage.getItem(UI_LABELS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeUiLabelsEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UI_LABELS_STORAGE_KEY, on ? "true" : "false");
    window.dispatchEvent(new Event(UI_LABELS_CHANGED_EVENT));
  } catch {
    /* private mode 등 */
  }
}

export function isEnabled(): boolean {
  return readUiLabelsEnabled();
}

export function toggle(): boolean {
  const next = !readUiLabelsEnabled();
  writeUiLabelsEnabled(next);
  return next;
}

export function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(UI_LABELS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(UI_LABELS_CHANGED_EVENT, handler);
}

export function useUiLabel() {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setEnabledState(readUiLabelsEnabled());
      setReady(true);
    });
    const off = subscribe(() => setEnabledState(readUiLabelsEnabled()));
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === UI_LABELS_STORAGE_KEY ||
        e.key === LEGACY_LABELS_STORAGE_KEY ||
        e.key === LEGACY_SHOW_UI_LABELS ||
        e.key === null
      ) {
        setEnabledState(readUiLabelsEnabled());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    writeUiLabelsEnabled(on);
    setEnabledState(readUiLabelsEnabled());
  }, []);

  const toggleLabel = useCallback(() => {
    const next = !readUiLabelsEnabled();
    writeUiLabelsEnabled(next);
    setEnabledState(next);
    return next;
  }, []);

  return {
    /** hydration 전에는 false */
    enabled: ready ? enabled : false,
    ready,
    setEnabled,
    toggle: toggleLabel,
  };
}
