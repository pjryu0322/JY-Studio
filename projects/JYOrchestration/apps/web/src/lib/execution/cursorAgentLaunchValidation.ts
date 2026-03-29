/**
 * Cursor Cloud Agent POST /v0/agents 호출 전 페이로드 검증.
 * Git 브랜치 존재 여부 검증(verifyBaseBranchBeforeCursor 등)과는 별도입니다.
 */

export type CursorAgentLaunchPayloadInput = {
  gitRepoUrl: string;
  baseBranch: string;
  targetBranchName: string;
  promptText: string;
};

export function validateCursorAgentLaunchPayload(
  input: CursorAgentLaunchPayloadInput
): { ok: true } | { ok: false; message: string } {
  const repo = input.gitRepoUrl.trim();
  const ref = input.baseBranch.trim();
  const target = input.targetBranchName.trim();
  const prompt = input.promptText.trim();

  if (!repo) {
    return { ok: false, message: "저장소 URL이 비어 있어 Cursor 실행 요청을 보낼 수 없습니다." };
  }

  try {
    const u = new URL(repo);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, message: "저장소 URL은 http(s) 형식이어야 합니다." };
    }
  } catch {
    return { ok: false, message: "저장소 URL 형식이 올바르지 않습니다." };
  }

  if (!ref) {
    return { ok: false, message: "베이스 브랜치(ref)가 비어 있어 Cursor 실행 요청을 보낼 수 없습니다." };
  }

  if (!target) {
    return { ok: false, message: "작업 브랜치 이름이 비어 있어 Cursor 실행 요청을 보낼 수 없습니다." };
  }

  if (!prompt) {
    return {
      ok: false,
      message: "작업 설명(프롬프트)이 비어 있어 Cursor 실행 요청을 보낼 수 없습니다.",
    };
  }

  return { ok: true };
}
