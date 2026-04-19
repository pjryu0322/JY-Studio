/** 동일 탭에서 `useGlobalPreferences` 등과 동기화 */
export const GLOBAL_PREFERENCES_CHANGED_EVENT = "jyo:global-preferences-changed";

const KEYS = {
  compactMode: "jyo:pref:compact-mode",
  reduceMotion: "jyo:pref:reduce-motion",
  autoOpenLastProject: "jyo:pref:auto-open-last-project",
  autoEnterAfterCreate: "jyo:pref:auto-enter-after-create",
  aiFacilitatorAutoJoin: "jyo:pref:ai-facilitator-auto-join",
  aiResponseStyle: "jyo:pref:ai-response-style",
  devPanelVisible: "jyo:pref:dev-panel-visible",
} as const;

export type AiResponseStyle = "brief" | "standard" | "detailed";

export const AI_RESPONSE_STYLE_LABELS: Record<AiResponseStyle, string> = {
  brief: "간단히",
  standard: "표준",
  detailed: "상세히",
};

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

export function readCompactMode(): boolean {
  return readBool(KEYS.compactMode, false);
}

export function writeCompactMode(value: boolean): void {
  writeBool(KEYS.compactMode, value);
}

export function readReduceMotion(): boolean {
  return readBool(KEYS.reduceMotion, false);
}

export function writeReduceMotion(value: boolean): void {
  writeBool(KEYS.reduceMotion, value);
}

export function readAutoOpenLastProject(): boolean {
  return readBool(KEYS.autoOpenLastProject, false);
}

export function writeAutoOpenLastProject(value: boolean): void {
  writeBool(KEYS.autoOpenLastProject, value);
}

export function readAutoEnterAfterCreate(): boolean {
  return readBool(KEYS.autoEnterAfterCreate, true);
}

export function writeAutoEnterAfterCreate(value: boolean): void {
  writeBool(KEYS.autoEnterAfterCreate, value);
}

export function readAiFacilitatorAutoJoin(): boolean {
  return readBool(KEYS.aiFacilitatorAutoJoin, true);
}

export function writeAiFacilitatorAutoJoin(value: boolean): void {
  writeBool(KEYS.aiFacilitatorAutoJoin, value);
}

function parseAiResponseStyle(raw: string | null): AiResponseStyle {
  if (raw === "brief" || raw === "detailed" || raw === "standard") return raw;
  return "standard";
}

export function readAiResponseStyle(): AiResponseStyle {
  if (typeof window === "undefined") return "standard";
  try {
    return parseAiResponseStyle(window.localStorage.getItem(KEYS.aiResponseStyle));
  } catch {
    return "standard";
  }
}

export function writeAiResponseStyle(value: AiResponseStyle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.aiResponseStyle, value);
    dispatchChanged();
  } catch {
    /* ignore */
  }
}

export function readDevPanelVisible(): boolean {
  return readBool(KEYS.devPanelVisible, false);
}

export function writeDevPanelVisible(value: boolean): void {
  writeBool(KEYS.devPanelVisible, value);
}

export type GlobalPreferencesSnapshot = {
  compactMode: boolean;
  reduceMotion: boolean;
  autoOpenLastProject: boolean;
  autoEnterAfterCreate: boolean;
  aiFacilitatorAutoJoin: boolean;
  aiResponseStyle: AiResponseStyle;
  devPanelVisible: boolean;
};

export function readGlobalPreferencesSnapshot(): GlobalPreferencesSnapshot {
  return {
    compactMode: readCompactMode(),
    reduceMotion: readReduceMotion(),
    autoOpenLastProject: readAutoOpenLastProject(),
    autoEnterAfterCreate: readAutoEnterAfterCreate(),
    aiFacilitatorAutoJoin: readAiFacilitatorAutoJoin(),
    aiResponseStyle: readAiResponseStyle(),
    devPanelVisible: readDevPanelVisible(),
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
