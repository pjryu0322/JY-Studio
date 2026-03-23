/** GET /api/project/summary 응답 data (클라이언트·서버 공용, DB 의존 없음). */
export type ProjectObservabilitySnapshot = {
  task: {
    total: number;
    todo: number;
    running: number;
    done: number;
    failed: number;
  };
  taskRun: { total: number };
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
