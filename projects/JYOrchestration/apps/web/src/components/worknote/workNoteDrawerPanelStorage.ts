/** 작업 메모 플로팅 패널 위치·크기 sessionStorage 키 */
export const WORK_NOTE_PANEL_GEOM_KEY = "jyo-work-note-panel-geom-v1";

/** 패널 배경 투명도 sessionStorage 키 */
export const WORK_NOTE_PANEL_OPACITY_KEY = "jyo-work-note-panel-opacity-v1";

export type WorkNotePanelGeom = { x: number; y: number; w: number; h: number };

export function workNotePanelClamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function workNotePanelDefaultGeom(isNarrow: boolean): WorkNotePanelGeom {
  if (typeof window === "undefined") return { x: 24, y: 80, w: 360, h: 440 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (isNarrow) {
    const w = vw;
    const h = Math.min(Math.round(vh * 0.92), Math.max(280, vh - 56));
    const y = vh - h;
    return { x: 0, y, w, h };
  }
  const w = Math.max(400, Math.min(520, vw - 24));
  const h = workNotePanelClamp(Math.round(vh * 0.58), 320, 560);
  return { x: vw - w - 16, y: 72, w, h };
}

export function readWorkNotePanelStoredGeom(): WorkNotePanelGeom | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(WORK_NOTE_PANEL_GEOM_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<WorkNotePanelGeom>;
    if (typeof o.x !== "number" || typeof o.y !== "number" || typeof o.w !== "number" || typeof o.h !== "number") return null;
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  } catch {
    return null;
  }
}

export function writeWorkNotePanelStoredGeom(g: WorkNotePanelGeom) {
  try {
    sessionStorage.setItem(WORK_NOTE_PANEL_GEOM_KEY, JSON.stringify(g));
  } catch {
    /* ignore */
  }
}

export function readWorkNotePanelStoredOpacity(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = sessionStorage.getItem(WORK_NOTE_PANEL_OPACITY_KEY);
    if (raw == null || raw === "") return 1;
    const n = Number(raw);
    if (Number.isNaN(n)) return 1;
    return workNotePanelClamp(n, 0.35, 1);
  } catch {
    return 1;
  }
}

export function writeWorkNotePanelStoredOpacity(alpha: number) {
  try {
    sessionStorage.setItem(WORK_NOTE_PANEL_OPACITY_KEY, String(workNotePanelClamp(alpha, 0.35, 1)));
  } catch {
    /* ignore */
  }
}
