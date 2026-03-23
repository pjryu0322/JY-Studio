/**
 * Cursor / 외부 에이전트 연동용 표준 페이로드 (Git apply · cursor 모드).
 * 실제 전송은 execution/cursorExecutor 및 integration/cursorExecutor에서 처리.
 */

export type CursorFileChangeType = "CREATE" | "MODIFY" | "DELETE";

export type CursorFileChange = {
  path: string;
  changeType: CursorFileChangeType;
};

export type CursorExecutionContext = {
  repoUrl?: string;
  defaultBranch?: string;
  /** 변경 대상 경로 (GCR files에서 정규화) */
  files?: string[];
  /** GCR 기준 원문 (에이전트 컨텍스트) */
  diffText?: string | null;
  commitMessage?: string | null;
};

export type CursorExecutionPayload = {
  taskId: string;
  taskPromptId: string;
  projectId: string;
  branchName: string;
  prompt: string;
  context?: CursorExecutionContext;
};

/** 웹훅 응답 등에서 파싱 가능한 구조화 힌트 (선택) */
export type CursorExecutionReceivedHints = {
  updatedFiles?: string[];
  commitSha?: string;
  prUrl?: string;
  branchPushed?: string;
  notes?: string;
};

export function serializeCursorExecutionPayload(payload: CursorExecutionPayload): string {
  return JSON.stringify(payload, null, 2);
}
