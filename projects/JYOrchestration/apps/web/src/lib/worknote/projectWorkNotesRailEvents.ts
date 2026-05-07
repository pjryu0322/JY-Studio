/** 좌측 레일 등에서 프로젝트 작업메모 개수 배지를 다시 불러오기 위한 이벤트 */
export const PROJECT_WORK_NOTES_RAIL_REFRESH_EVENT = "jyo:project-work-notes-rail-refresh" as const;

export function notifyProjectWorkNotesRailRefresh(projectId: string): void {
  const id = projectId.trim();
  if (!id || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_WORK_NOTES_RAIL_REFRESH_EVENT, { detail: { projectId: id } }));
}
