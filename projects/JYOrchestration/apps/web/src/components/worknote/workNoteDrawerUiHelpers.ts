import type { WorkNoteSaveState } from "@/hooks/useWorkNotesPanel";

export function workNoteMemoDisplayTitle(title: string): string {
  return title.trim() ? title.trim() : "제목 없음";
}

/** 접힌 목록: 선택된 메모만 id 기반 색, 나머지는 무채색 */
export function workNoteMemoSwatchColors(noteId: string, active: boolean): { background: string; borderColor: string } {
  if (!active) {
    return {
      background: "#e2e8f0",
      borderColor: "#94a3b8",
    };
  }
  let h = 0;
  for (let i = 0; i < noteId.length; i++) h = (h * 31 + noteId.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return {
    background: `hsl(${hue} 62% 90%)`,
    borderColor: `hsl(${hue} 58% 48%)`,
  };
}

export function workNotePlainTextFromSelectionWithinEditor(root: HTMLElement | null): string {
  if (!root) return "";
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return "";
  const frag = range.cloneContents();
  const wrap = document.createElement("div");
  wrap.appendChild(frag);
  return wrap.innerText.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function workNoteSaveStateLabel(state: WorkNoteSaveState, saveError: string | null): string {
  if (state === "saving") return "저장 중…";
  if (state === "error") return saveError ? `저장 실패 · ${saveError}` : "저장 실패";
  if (state === "saved") return "자동 저장됨";
  return "";
}
