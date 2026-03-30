/** GET /api/project/summary 응답 data (클라이언트·서버 공용, DB 의존 없음). */
export type ProjectObservabilitySnapshot = {
  /** 활성 스펙 버전(없으면 Task 집계는 비어 있음) */
  currentSpecVersionId: string | null;
  task: {
    total: number;
    todo: number;
    running: number;
    done: number;
    failed: number;
  };
  /** 이전 스펙에서 보관된 Task / Run (읽기 전용 이력) */
  historical: {
    archivedTaskCount: number;
    promptRunCount: number;
    cursorRunCount: number;
  };
  taskRun: { total: number };
  /** Cursor 오케스트레이션 실행 기록(TaskExecutionRun) */
  cursorExecutionRun: { activeCount: number; archivedCount: number };
  git: {
    total: number;
    requested: number;
    applying: number;
    done: number;
    failed: number;
    /** GitChangeRequest에 PR 번호가 연결된 건수·OPEN·병합 반영 건수 */
    pullRequest: {
      linked: number;
      open: number;
      merged: number;
    };
  };
  retry: { total: number };
};
