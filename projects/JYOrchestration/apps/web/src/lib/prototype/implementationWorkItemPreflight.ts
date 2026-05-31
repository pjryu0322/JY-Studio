import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { isPathAllowedByGlobs } from "@/lib/prototype/targetRepositoryPathGuard";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type WorkItemPreflightResult = Readonly<{
  readonly status: "passed" | "failed";
  readonly workItemId: string;
  readonly taskId: string;
  readonly failedReasons: readonly string[];
  readonly requiredFixes: readonly string[];
}>;

export type WorkItemPreflightBatchResult = Readonly<{
  readonly status: "passed" | "failed";
  readonly results: readonly WorkItemPreflightResult[];
  readonly failedWorkItemIds: readonly string[];
}>;

function readStringArray(value: readonly string[] | null | undefined): readonly string[] {
  return (value ?? []).map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function runWorkItemPreflight(input: {
  readonly workItem: CursorWorkItem;
  readonly allowedPathGlobs?: readonly string[];
}): WorkItemPreflightResult {
  const workItem = input.workItem;
  const failedReasons: string[] = [];
  const requiredFixes: string[] = [];

  if (!String(workItem.taskId ?? "").trim()) {
    failedReasons.push("taskId 없음");
    requiredFixes.push("taskId를 지정하세요.");
  }
  if (!String(workItem.id ?? "").trim()) {
    failedReasons.push("workItem id 없음");
    requiredFixes.push("workItem id를 지정하세요.");
  }
  if (!String(workItem.objective ?? "").trim()) {
    failedReasons.push("objective 없음");
    requiredFixes.push("작업 목적(objective)을 작성하세요.");
  }
  if (!String(workItem.expectedChange ?? "").trim() && !String(workItem.prompt ?? "").trim()) {
    failedReasons.push("expectedChange 또는 구현 지시 없음");
    requiredFixes.push("변경 내용(expectedChange) 또는 prompt를 작성하세요.");
  }

  const candidateFiles = readStringArray(workItem.candidateFiles);
  const candidateFileHints = readStringArray(workItem.candidateFileHints);
  const requiredFilesHint = readStringArray(workItem.requiredFilesHint).filter(
    (hint) => !hint.startsWith("taskList:") && !hint.startsWith("task:"),
  );
  if (!candidateFiles.length && !candidateFileHints.length && !requiredFilesHint.length) {
    failedReasons.push("candidateFiles/candidateFileHints 없음");
    requiredFixes.push("수정 후보 파일 또는 탐색 기준을 추가하세요.");
  }

  const acceptanceCriteria = readStringArray(workItem.acceptanceCriteria);
  if (!acceptanceCriteria.length) {
    failedReasons.push("acceptanceCriteria 없음");
    requiredFixes.push("완료 조건(acceptanceCriteria)을 추가하세요.");
  }

  const verificationHints = readStringArray(workItem.verificationHints);
  if (!verificationHints.length && !readStringArray(workItem.testCommands).length) {
    failedReasons.push("verificationHints 없음");
    requiredFixes.push("검증 방법(verificationHints)을 추가하세요.");
  }

  const allowedPathGlobs = readStringArray(input.allowedPathGlobs);
  if (allowedPathGlobs.length) {
    const outside = candidateFiles.filter((file) => !isPathAllowedByGlobs(file, allowedPathGlobs));
    if (outside.length) {
      failedReasons.push(`allowedPathGlobs 충돌: ${outside.slice(0, 2).join(", ")}`);
      requiredFixes.push("허용 경로 밖 candidateFiles를 제거하거나 보정하세요.");
    }
  }

  if (!readStringArray(workItem.forbiddenPaths).length) {
    failedReasons.push("forbiddenScopes/forbiddenPaths 없음");
    requiredFixes.push("금지 경로(forbiddenPaths)를 지정하세요.");
  }

  return {
    status: failedReasons.length ? "failed" : "passed",
    workItemId: workItem.id,
    taskId: workItem.taskId,
    failedReasons,
    requiredFixes,
  };
}

export function runWorkItemPreflightBatch(input: {
  readonly workItems: readonly CursorWorkItem[];
  readonly allowedPathGlobs?: readonly string[];
}): WorkItemPreflightBatchResult {
  const results = input.workItems.map((workItem) =>
    runWorkItemPreflight({ workItem, allowedPathGlobs: input.allowedPathGlobs }),
  );
  const failedWorkItemIds = results.filter((result) => result.status === "failed").map((r) => r.workItemId);
  return {
    status: failedWorkItemIds.length ? "failed" : "passed",
    results,
    failedWorkItemIds,
  };
}

export function buildWorkItemPreflightTimelineEntry(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly result: WorkItemPreflightBatchResult;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const failed = input.result.results.filter((result) => result.status === "failed");
  const action =
    input.result.status === "passed"
      ? "implementation_work_item_preflight_passed"
      : "implementation_work_item_preflight_failed";
  const parts = [
    `projectId=${input.projectId.trim()}`,
    `taskId=${input.taskId.trim()}`,
    `status=${input.result.status}`,
    `workItemCount=${input.result.results.length}`,
  ];
  if (failed.length) {
    parts.push(`failedWorkItemIds=${failed.map((item) => item.workItemId).join(",")}`);
    parts.push(`reason=${failed[0]?.failedReasons.join("; ") ?? "unknown"}`);
  }
  return {
    stage: "implementation",
    action,
    source: "platform",
    responseText: parts.join(" "),
    createdAt: nowIso,
    orchestrationTraceGroup: "task_cursor_execution",
  };
}

export function formatWorkItemPreflightBlockedMessage(
  result: WorkItemPreflightBatchResult,
): string {
  const failed = result.results.filter((item) => item.status === "failed");
  const lines = ["WorkItem 보완이 필요합니다. Cursor 실행을 시작하지 않았습니다.", ""];
  for (const item of failed.slice(0, 3)) {
    lines.push(`- ${item.workItemId}: ${item.failedReasons.join(", ")}`);
    if (item.requiredFixes[0]) lines.push(`  → ${item.requiredFixes[0]}`);
  }
  return lines.join("\n");
}
