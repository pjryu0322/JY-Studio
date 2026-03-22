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
  };
  retry: { total: number };
};
