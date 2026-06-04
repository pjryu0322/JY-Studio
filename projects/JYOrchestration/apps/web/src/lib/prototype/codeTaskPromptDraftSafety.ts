const PROMPT_DRAFT_BANNED_SNIPPETS = [
  "GitHub 정책",
  "GitHub 저장소",
  "GitHub verify",
  "GitHub",
  "base branch",
  "work branch",
  "commit/push",
  "commit 후",
  " push",
  "PR 생성",
  "PR 생성·merge",
  "Cursor API",
  "allowed path",
  "허용 경로",
  "JY Orchestration",
  "JYOrchestration",
  "projects/JYOrchestration",
  "모노레포",
  "Stage1/Stage2/ENV_TEST",
  "target repo:",
  "작업 저장소",
] as const;

export function validateCodeTaskPromptDraftSafety(input: {
  readonly prompt: string;
}): Readonly<{ readonly ok: boolean; readonly errors: readonly string[] }> {
  const prompt = String(input.prompt ?? "");
  const errors: string[] = [];
  if (!prompt.trim()) {
    errors.push("empty_prompt");
    return { ok: false, errors };
  }
  for (const snippet of PROMPT_DRAFT_BANNED_SNIPPETS) {
    if (prompt.includes(snippet)) {
      errors.push(`banned_snippet:${snippet}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
