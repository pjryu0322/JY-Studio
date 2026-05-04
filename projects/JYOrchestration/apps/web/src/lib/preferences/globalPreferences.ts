/** 동일 탭에서 `useGlobalPreferences` 등과 동기화 */
import type {
  PrototypePreviewMobileDevice,
  PrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";
import {
  isPrototypePreviewMobileDevice,
  isPrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";

export const GLOBAL_PREFERENCES_CHANGED_EVENT = "jyo:global-preferences-changed";

const KEYS = {
  aiFacilitatorAutoJoin: "jyo:pref:ai-facilitator-auto-join",
  devPanelVisible: "jyo:pref:dev-panel-visible",
  settingsMenuPersona: "jyo:pref:settings-menu-persona",
  prototypePreviewWorkMode: "jyo:pref:prototype-preview-work-mode",
  prototypePreviewMobileDevice: "jyo:pref:prototype-preview-mobile-device",
} as const;

export type SettingsMenuPersona = "user" | "admin";

function dispatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GLOBAL_PREFERENCES_CHANGED_EVENT));
}

function readBool(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeBool(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
    dispatchChanged();
  } catch {
    /* ignore */
  }
}

export function readAiFacilitatorAutoJoin(): boolean {
  return readBool(KEYS.aiFacilitatorAutoJoin, true);
}

export function writeAiFacilitatorAutoJoin(value: boolean): void {
  writeBool(KEYS.aiFacilitatorAutoJoin, value);
}

export function readDevPanelVisible(): boolean {
  return readBool(KEYS.devPanelVisible, false);
}

export function writeDevPanelVisible(value: boolean): void {
  writeBool(KEYS.devPanelVisible, value);
}

function readString(key: string, defaultValue: string): string {
  if (typeof window === "undefined") return defaultValue;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "admin" || v === "user") return v;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    dispatchChanged();
  } catch {
    /* ignore */
  }
}

export function readSettingsMenuPersona(): SettingsMenuPersona {
  return readString(KEYS.settingsMenuPersona, "user") as SettingsMenuPersona;
}

export function writeSettingsMenuPersona(value: SettingsMenuPersona): void {
  writeString(KEYS.settingsMenuPersona, value);
}

function readPrototypePreviewWorkMode(): PrototypePreviewWorkMode {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(KEYS.prototypePreviewWorkMode);
    if (v && isPrototypePreviewWorkMode(v)) return v;
    return "auto";
  } catch {
    return "auto";
  }
}

export function writePrototypePreviewWorkMode(value: PrototypePreviewWorkMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.prototypePreviewWorkMode, value);
    dispatchChanged();
  } catch {
    /* ignore */
  }
}

function readPrototypePreviewMobileDevice(): PrototypePreviewMobileDevice {
  if (typeof window === "undefined") return "iphone";
  try {
    const v = window.localStorage.getItem(KEYS.prototypePreviewMobileDevice);
    if (v && isPrototypePreviewMobileDevice(v)) return v;
    return "iphone";
  } catch {
    return "iphone";
  }
}

export function writePrototypePreviewMobileDevice(value: PrototypePreviewMobileDevice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.prototypePreviewMobileDevice, value);
    dispatchChanged();
  } catch {
    /* ignore */
  }
}

export type GlobalPreferencesSnapshot = {
  aiFacilitatorAutoJoin: boolean;
  devPanelVisible: boolean;
  settingsMenuPersona: SettingsMenuPersona;
  prototypePreviewWorkMode: PrototypePreviewWorkMode;
  prototypePreviewMobileDevice: PrototypePreviewMobileDevice;
};

export function readGlobalPreferencesSnapshot(): GlobalPreferencesSnapshot {
  return {
    aiFacilitatorAutoJoin: readAiFacilitatorAutoJoin(),
    devPanelVisible: readDevPanelVisible(),
    settingsMenuPersona: readSettingsMenuPersona(),
    prototypePreviewWorkMode: readPrototypePreviewWorkMode(),
    prototypePreviewMobileDevice: readPrototypePreviewMobileDevice(),
  };
}

const STORAGE_KEYS = new Set<string>(Object.values(KEYS));

export function subscribeGlobalPreferences(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = () => listener();
  window.addEventListener(GLOBAL_PREFERENCES_CHANGED_EVENT, on);
  const onStorage = (e: StorageEvent) => {
    if (e.key && !STORAGE_KEYS.has(e.key)) return;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GLOBAL_PREFERENCES_CHANGED_EVENT, on);
    window.removeEventListener("storage", onStorage);
  };
}
