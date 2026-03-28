/** 프로세스 내 실행 루프 일시정지 플래그 (초기 버전 — 다중 인스턴스 간 공유 없음) */
const paused = new Map<string, boolean>();

export function setExecutionLoopPaused(projectId: string, value: boolean): void {
  if (value) paused.set(projectId, true);
  else paused.delete(projectId);
}

export function isExecutionLoopPaused(projectId: string): boolean {
  return paused.get(projectId) === true;
}
