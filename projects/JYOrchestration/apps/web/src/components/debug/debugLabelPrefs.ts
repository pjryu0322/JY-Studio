/** localStorage: ON "true" / OFF "false". 미설정·그 외 값은 OFF(라벨 숨김). */
export const JY_DEBUG_LABELS_STORAGE_KEY = "jy_debug_labels";

/** 같은 탭에서 토글 후 DebugLabelLayer 등이 동기화할 때 사용 */
export const JY_DEBUG_LABELS_CHANGED_EVENT = "jy-debug-labels-changed";

export function readDebugLabelsStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(JY_DEBUG_LABELS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeDebugLabelsStorage(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JY_DEBUG_LABELS_STORAGE_KEY, on ? "true" : "false");
    window.dispatchEvent(new Event(JY_DEBUG_LABELS_CHANGED_EVENT));
  } catch {
    /* private mode 등 */
  }
}
