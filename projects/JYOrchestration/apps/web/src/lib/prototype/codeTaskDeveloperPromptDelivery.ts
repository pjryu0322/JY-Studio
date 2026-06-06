import { createHash } from "node:crypto";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { buildTaskCursorTimelineEntry } from "@/lib/prototype/taskCursorExecution";

export const CODE_TASK_DEVELOPER_PROMPT_VERSION = "v1" as const;

const LEGACY_TRACKING_HEADINGS = [
  "## 참조 ID",
  "## 실행 추적 정보",
  "## 플랫폼 추적 ID",
] as const;

const LEGACY_TRACKING_LINE =
  /^(?:-\s*)?(?:Process Task ID|CodeTask ID|Run ID|Project ID|Process Task):\s/i;

export function formatDeveloperPromptHashSha256(prompt: string): string {
  const hex = createHash("sha256").update(String(prompt ?? ""), "utf8").digest("hex");
  return `sha256:${hex}`;
}

export function developerPromptContainsPlatformTrackingSections(prompt: string): boolean {
  const text = String(prompt ?? "");
  for (const heading of LEGACY_TRACKING_HEADINGS) {
    if (text.includes(heading)) return true;
  }
  return text.split("\n").some((line) => LEGACY_TRACKING_LINE.test(line.trim()));
}

export function logTaskCursorPromptCopyHashMismatch(input: {
  readonly projectId: string;
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly runId?: string | null;
  readonly copyHash: string;
  readonly executeHash: string;
}): void {
  console.warn(
    "[task_cursor_prompt_copy_hash_mismatch]",
    JSON.stringify({
      event: "task_cursor_prompt_copy_hash_mismatch",
      projectId: input.projectId.trim(),
      processTaskId: input.processTaskId.trim(),
      codeTaskId: input.codeTaskId.trim(),
      runId: String(input.runId ?? "").trim() || undefined,
      copyHash: input.copyHash,
      executeHash: input.executeHash,
      developerPromptVersion: CODE_TASK_DEVELOPER_PROMPT_VERSION,
    }),
  );
}

export function buildCodeTaskPromptBuiltTimelineEntry(input: {
  readonly projectId: string;
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly runId?: string | null;
  readonly developerPrompt: string;
  readonly workBranch?: string;
  readonly targetRepository?: string;
  readonly baseBranch?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const developerPromptHash = formatDeveloperPromptHashSha256(input.developerPrompt);
  const entry = buildTaskCursorTimelineEntry({
    action: "task_cursor_prompt_built",
    projectId: input.projectId,
    taskId: input.processTaskId,
    status: "prompt_ready",
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    workBranch: input.workBranch,
    runId: input.runId ?? undefined,
    nowIso: input.nowIso,
  });
  return {
    ...entry,
    responseText: [
      entry.responseText,
      `codeTaskId=${input.codeTaskId.trim()}`,
      `developerPromptVersion=${CODE_TASK_DEVELOPER_PROMPT_VERSION}`,
      `developerPromptHash=${developerPromptHash}`,
      `processTaskId=${input.processTaskId.trim()}`,
    ].join(" "),
  };
}
