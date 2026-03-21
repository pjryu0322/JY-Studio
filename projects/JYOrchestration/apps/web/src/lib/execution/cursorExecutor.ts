/**
 * GitChangeRequest 기반 Cursor 실행 계층 (스텁).
 * 실제 Cursor CLI/API 호출은 하지 않으며, 이후 실제 연동 시 이 모듈만 교체/확장하면 됩니다.
 */

export type CursorExecutionInput = {
  taskId: string;
  files: unknown;
  diffText: string | null;
  commitMessage: string | null;
};

export type CursorExecutionResult = {
  success: boolean;
  /** Cursor가 반영했다고 가정하는 경로 목록 (스텁: files에서 추출) */
  updatedFiles: string[];
  /** 실행 단계 로그 */
  logs: string[];
  error: string | null;
};

function extractFilePaths(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  const paths: string[] = [];
  for (const item of files) {
    if (item && typeof item === "object" && "path" in item) {
      const p = (item as { path: unknown }).path;
      if (typeof p === "string" && p.trim()) paths.push(p.trim());
    }
  }
  return paths;
}

/**
 * GitChangeRequest → Cursor 실행 요청 변환 후 스텁 실행.
 * 실제 외부 호출 없음.
 */
export async function executeCursorForGitChangeRequest(
  input: CursorExecutionInput
): Promise<CursorExecutionResult> {
  const updatedFiles = extractFilePaths(input.files);
  const logs: string[] = [
    "[STUB] 외부 Cursor API/CLI 미호출 (feat(cursor): integration stub)",
    `[STUB] taskId=${input.taskId}`,
    `[STUB] commitMessage 길이=${(input.commitMessage ?? "").length}`,
    `[STUB] diffText 길이=${(input.diffText ?? "").length}`,
    `[STUB] 파일 항목 수=${Array.isArray(input.files) ? input.files.length : 0}`,
  ];

  return {
    success: true,
    updatedFiles,
    logs,
    error: null,
  };
}

/** applyLog에 기록할 성공 블록 (planned Git 플로우 + 실행 결과) */
export function formatCursorApplyLogSuccess(
  plannedGitFlowSection: string,
  result: CursorExecutionResult
): string {
  const lines = [
    "[mode: cursor]",
    plannedGitFlowSection,
    "[CURSOR_EXECUTION_START]",
    ...result.logs,
    `[CURSOR] updatedFiles: ${JSON.stringify(result.updatedFiles)}`,
    "[CURSOR_EXECUTION_DONE]",
    "[END]",
  ];
  return lines.join("\n");
}
