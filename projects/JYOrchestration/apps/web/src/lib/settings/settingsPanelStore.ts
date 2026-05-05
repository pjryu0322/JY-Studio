/** 동일 탭 전역: 설정 패널 열림·앵커(헤더 톱니 vs 뷰포트 중앙 등). */

export type SettingsPanelSnapshot = {
  readonly open: boolean;
  /** 열 때 기준 요소(스크롤·리사이즈 시 위치 재계산). 뷰포트 중앙 모드면 null */
  readonly anchorEl: HTMLElement | null;
  readonly placement: "anchor" | "viewport";
};

const SERVER_SNAPSHOT: SettingsPanelSnapshot = {
  open: false,
  anchorEl: null,
  placement: "viewport",
};

let snapshot: SettingsPanelSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeSettingsPanel(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettingsPanelSnapshot(): SettingsPanelSnapshot {
  return snapshot;
}

export function getSettingsPanelServerSnapshot(): SettingsPanelSnapshot {
  return SERVER_SNAPSHOT;
}

export function openSettingsPanel(opts?: { readonly anchorEl?: HTMLElement | null }): void {
  const anchorEl = opts?.anchorEl ?? null;
  snapshot = {
    open: true,
    anchorEl,
    placement: anchorEl ? "anchor" : "viewport",
  };
  notify();
}

export function closeSettingsPanel(): void {
  snapshot = { open: false, anchorEl: null, placement: "viewport" };
  notify();
}

/** 헤더 톱니: 같은 버튼으로 열고 닫기 */
export function toggleSettingsPanel(opts?: { readonly anchorEl?: HTMLElement | null }): void {
  if (snapshot.open) {
    closeSettingsPanel();
    return;
  }
  openSettingsPanel(opts);
}
