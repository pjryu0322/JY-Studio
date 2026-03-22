/**
 * TaskRun.resultJson 에 저장하는 구조화 결과 (하위호환으로 resultText 병행).
 */

/** /api/task/run 일반 실행 및 후속 Git 연계용 공통 실행 결과 형태 */
export type TaskRunExecutionResult = {
  success: boolean;
  mode: "mock" | "cursor" | "git";
  updatedFiles: {
    path: string;
    changeType: "CREATE" | "MODIFY" | "DELETE";
  }[];
  commitMessage?: string;
  logs?: string[];
  error?: string | null;
};

export type TaskRunUpdatedFileJson = {
  path: string;
  changeType?: "MODIFY" | "CREATE" | "DELETE";
};

export type TaskRunResultJson = {
  success: boolean;
  mode?: string;
  updatedFiles?: TaskRunUpdatedFileJson[];
  commitMessage?: string | null;
  logs?: string[];
  error?: string | null;
  autoGitChangeRequestId?: string | null;
};

export function isTaskRunResultJson(value: unknown): value is TaskRunResultJson {
  return Boolean(value && typeof value === "object" && "success" in (value as object));
}

/** TaskRun.resultJson 저장용 (실행 결과 → JSON 스키마) */
export function taskRunExecutionResultToStoredJson(
  er: TaskRunExecutionResult
): TaskRunResultJson {
  return {
    success: er.success,
    mode: er.mode,
    updatedFiles: er.updatedFiles.map((f) => ({
      path: f.path,
      changeType: f.changeType,
    })),
    commitMessage: er.commitMessage ?? null,
    logs: er.logs,
    error: er.error ?? null,
  };
}

/** mock Task 실행 완료 시 기본 구조화 결과 (GitChangeRequest 자동/수동 페이로드 재사용). */
export function buildDefaultMockRunResultJson(taskId: string): TaskRunResultJson {
  return {
    success: true,
    mode: "mock",
    updatedFiles: [
      { path: "apps/web/src/app/page.tsx", changeType: "MODIFY" },
      { path: "apps/web/src/app/projects/[projectId]/page.tsx", changeType: "MODIFY" },
    ],
    commitMessage: `feat: apply task ${taskId}`,
    logs: ["Mock 실행 완료"],
    error: null,
  };
}
