import type { ExecutionMode } from "@/lib/git-apply/execution";

/** git-apply 사전검사에 사용하는 GitChangeRequest 부분 필드 */
export type PrecheckRecord = {
  taskId: string;
  commitMessage: string | null;
  files: unknown;
  diffText: string | null;
};

export type PrecheckResult = { ok: true } | { ok: false; message: string };

function hasNonEmptyFiles(files: unknown): boolean {
  return Array.isArray(files) && files.length > 0;
}

function hasNonEmptyCommitMessage(cm: string | null | undefined): boolean {
  return typeof cm === "string" && cm.trim().length > 0;
}

function hasNonEmptyDiff(diff: string | null | undefined): boolean {
  return typeof diff === "string" && diff.trim().length > 0;
}

/** mock: 항상 통과 */
export function validateMockExecution(): PrecheckResult {
  return { ok: true };
}

/** cursor: files / diff / commitMessage 필수 */
export function validateCursorExecution(record: PrecheckRecord): PrecheckResult {
  if (!hasNonEmptyFiles(record.files)) {
    return {
      ok: false,
      message: "Cursor 실행에 필요한 변경 파일 정보가 없습니다.",
    };
  }
  if (!hasNonEmptyCommitMessage(record.commitMessage)) {
    return {
      ok: false,
      message: "Cursor 실행에 필요한 커밋 메시지가 없습니다.",
    };
  }
  if (!hasNonEmptyDiff(record.diffText)) {
    return {
      ok: false,
      message: "Cursor 실행에 필요한 diff 정보가 없습니다.",
    };
  }
  return { ok: true };
}

/** git: 브랜치용 taskId + files / diff / commitMessage */
export function validateGitExecution(record: PrecheckRecord): PrecheckResult {
  if (!record.taskId?.trim()) {
    return {
      ok: false,
      message: "Git 실행에 필요한 브랜치명을 생성할 수 없습니다.",
    };
  }
  if (!hasNonEmptyDiff(record.diffText)) {
    return {
      ok: false,
      message: "Git 실행에 필요한 diff 정보가 없습니다.",
    };
  }
  if (!hasNonEmptyFiles(record.files)) {
    return {
      ok: false,
      message: "Git 실행에 필요한 변경 파일 정보가 없습니다.",
    };
  }
  if (!hasNonEmptyCommitMessage(record.commitMessage)) {
    return {
      ok: false,
      message: "Git 실행에 필요한 커밋 메시지가 없습니다.",
    };
  }
  return { ok: true };
}

export function validateExecutionPrecheck(
  mode: ExecutionMode,
  record: PrecheckRecord
): PrecheckResult {
  switch (mode) {
    case "mock":
      return validateMockExecution();
    case "cursor":
      return validateCursorExecution(record);
    case "git":
      return validateGitExecution(record);
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}
