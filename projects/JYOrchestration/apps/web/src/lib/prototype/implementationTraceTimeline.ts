import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function maskWorkspacePathForTimeline(workspacePath: string | undefined): string {
  const raw = String(workspacePath ?? "").trim();
  if (!raw) return "(없음)";
  if (raw.length <= 8) return raw;
  return `${raw.slice(0, 4)}…${raw.slice(-3)}`;
}

export type ImplementationTraceTimelineGroup = "target_repo_e2e" | "platform_scm";

export type ImplementationTraceTimelineFieldValue = string | number | boolean | undefined;

export type ImplementationTraceTimelineFields = Readonly<
  Record<string, ImplementationTraceTimelineFieldValue>
>;

const TIMELINE_FIELD_FORMATTERS: Readonly<
  Record<string, (value: ImplementationTraceTimelineFieldValue) => string | undefined>
> = {
  workspacePath: (value) =>
    value === undefined ? undefined : `workspacePath=${maskWorkspacePathForTimeline(String(value))}`,
  commitSha: (value) => (value === undefined ? undefined : `commitSha=${String(value).slice(0, 12)}`),
  reason: (value) =>
    value === undefined
      ? undefined
      : `reason=${String(value).replace(/\s+/g, "_").slice(0, 120)}`,
  repoFullName: (value) => (value === undefined ? undefined : `repoFullName=${value}`),
  branchName: (value) => (value === undefined ? undefined : `branchName=${value}`),
  status: (value) => (value === undefined ? undefined : `status=${value}`),
  selectedTaskId: (value) => (value === undefined ? undefined : `selectedTaskId=${value}`),
  runId: (value) => (value === undefined ? undefined : `runId=${value}`),
  pushStatus: (value) => (value === undefined ? undefined : `pushStatus=${value}`),
  prStatus: (value) => (value === undefined ? undefined : `prStatus=${value}`),
  prNumber: (value) =>
    value === undefined || value === null ? undefined : `prNumber=${value}`,
  changedFilesCount: (value) =>
    value === undefined || value === null ? undefined : `changedFilesCount=${value}`,
  hasCommitSha: (value) =>
    value === undefined ? undefined : `hasCommitSha=${value ? "yes" : "no"}`,
  baseBranch: (value) => (value === undefined ? undefined : `baseBranch=${value}`),
};

function formatTimelineField(key: string, value: ImplementationTraceTimelineFieldValue): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const formatter = TIMELINE_FIELD_FORMATTERS[key];
  if (formatter) return formatter(value);
  return `${key}=${value}`;
}

export function buildImplementationTraceTimelineEntry(input: {
  readonly action: string;
  readonly orchestrationTraceGroup: ImplementationTraceTimelineGroup;
  readonly projectId: string;
  readonly mode?: string;
  readonly fields?: ImplementationTraceTimelineFields;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const parts = [
    `type=${input.action}`,
    ...(input.mode ? [`mode=${input.mode}`] : []),
    `projectId=${input.projectId}`,
    ...Object.entries(input.fields ?? {})
      .flatMap(([key, value]) => {
        const formatted = formatTimelineField(key, value);
        return formatted ? [formatted] : [];
      }),
  ];
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: parts.join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: input.orchestrationTraceGroup,
  };
}
