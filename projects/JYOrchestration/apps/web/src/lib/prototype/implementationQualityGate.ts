import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markRoleTasksDone,
  markRoleTasksFailed,
  markRoleTasksInProgress,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export const IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION =
  "implementation_quality_gate_result_v1" as const;

export type ImplementationQualityGateRole = "reviewer" | "security";

export type ImplementationQualityGateStatus = "passed" | "failed";

export type ImplementationQualityGateCheckItem = Readonly<{
  id: string;
  title: string;
  status: "passed" | "failed" | "warning";
  severity?: "low" | "medium" | "high";
  detail?: string;
  targetTaskIds?: readonly string[];
}>;

export type ImplementationQualityGateResultV1 = Readonly<{
  version: typeof IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION;
  role: ImplementationQualityGateRole;
  status: ImplementationQualityGateStatus;
  createdAt: string;
  updatedAt: string;
  source: "mock_local_gate";
  summary: string;
  checks: readonly ImplementationQualityGateCheckItem[];
  failedTaskIds: readonly string[];
}>;

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseCheckItem(raw: unknown): ImplementationQualityGateCheckItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = readString(o.id);
  const title = readString(o.title);
  const status = readString(o.status);
  if (!id || !title) return null;
  if (status !== "passed" && status !== "failed" && status !== "warning") return null;
  const severityRaw = readString(o.severity);
  const severity =
    severityRaw === "low" || severityRaw === "medium" || severityRaw === "high" ? severityRaw : undefined;
  const targetTaskIds = Array.isArray(o.targetTaskIds)
    ? o.targetTaskIds.map((x) => readString(x)).filter(Boolean)
    : undefined;
  return {
    id,
    title,
    status,
    ...(severity ? { severity } : {}),
    ...(typeof o.detail === "string" && o.detail.trim() ? { detail: o.detail.trim() } : {}),
    ...(targetTaskIds?.length ? { targetTaskIds } : {}),
  };
}

export function parseImplementationQualityGateResultV1(
  raw: unknown,
): ImplementationQualityGateResultV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION) return null;
  const role = readString(o.role);
  if (role !== "reviewer" && role !== "security") return null;
  const status = readString(o.status);
  if (status !== "passed" && status !== "failed") return null;
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  const summary = readString(o.summary);
  if (!createdAt || !updatedAt || !summary) return null;
  const checks: ImplementationQualityGateCheckItem[] = [];
  if (Array.isArray(o.checks)) {
    for (const row of o.checks) {
      const parsed = parseCheckItem(row);
      if (parsed) checks.push(parsed);
    }
  }
  const failedTaskIds = Array.isArray(o.failedTaskIds)
    ? o.failedTaskIds.map((x) => readString(x)).filter(Boolean)
    : [];
  return {
    version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
    role,
    status,
    createdAt,
    updatedAt,
    source: "mock_local_gate",
    summary,
    checks,
    failedTaskIds,
  };
}

export function parseImplementationQualityGateResultsV1(
  raw: unknown,
): readonly ImplementationQualityGateResultV1[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out: ImplementationQualityGateResultV1[] = [];
  for (const row of raw) {
    const parsed = parseImplementationQualityGateResultV1(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function getLatestImplementationQualityGateResultForRole(
  results: readonly ImplementationQualityGateResultV1[] | null | undefined,
  role: ImplementationQualityGateRole,
): ImplementationQualityGateResultV1 | null {
  if (!results?.length) return null;
  let latest: ImplementationQualityGateResultV1 | null = null;
  for (const row of results) {
    if (row.role !== role) continue;
    if (!latest || row.updatedAt >= latest.updatedAt) latest = row;
  }
  return latest;
}

export function appendImplementationQualityGateResult(input: {
  readonly existing: readonly ImplementationQualityGateResultV1[] | null | undefined;
  readonly result: ImplementationQualityGateResultV1;
}): readonly ImplementationQualityGateResultV1[] {
  return [...(input.existing ?? []), input.result];
}

export function formatImplementationQualityGateResultLines(
  result: ImplementationQualityGateResultV1 | null | undefined,
): readonly string[] {
  if (!result) return ["아직 실행된 점검 결과가 없습니다."];
  const statusLabel = result.status === "passed" ? "통과" : "실패";
  const lines = [`점검 결과: ${statusLabel}`, `- ${result.summary}`];
  for (const check of result.checks.slice(0, 6)) {
    const mark = check.status === "passed" ? "✓" : check.status === "warning" ? "!" : "✗";
    lines.push(`${mark} ${check.title}${check.detail ? `: ${check.detail}` : ""}`);
  }
  return lines;
}

export function buildMockImplementationQualityGateResult(input: {
  readonly role: ImplementationQualityGateRole;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState: ImplementationTaskExecutionStateV1 | null | undefined;
  readonly nowIso?: string;
}): ImplementationQualityGateResultV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const developerItems = (input.executionState?.items ?? []).filter((i) => i.ownerRole === "developer");
  const developerFailed = developerItems.filter((i) => i.status === "failed");
  const developerDone = developerItems.some((i) => i.status === "done");

  if (input.role === "reviewer") {
    if (developerFailed.length > 0) {
      return {
        version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
        role: "reviewer",
        status: "failed",
        createdAt: now,
        updatedAt: now,
        source: "mock_local_gate",
        summary: "실패한 개발 작업이 있어 검수를 통과할 수 없습니다.",
        checks: [
          {
            id: "dev-failed",
            title: "개발 작업 실패 여부",
            status: "failed",
            severity: "high",
            detail: `${developerFailed.length}개 개발 작업 실패`,
            targetTaskIds: developerFailed.map((i) => i.taskId),
          },
        ],
        failedTaskIds: developerFailed.map((i) => i.taskId),
      };
    }
    if (!developerDone) {
      return {
        version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
        role: "reviewer",
        status: "failed",
        createdAt: now,
        updatedAt: now,
        source: "mock_local_gate",
        summary: "완료된 개발 작업이 없어 검수를 진행할 수 없습니다.",
        checks: [
          {
            id: "dev-done",
            title: "개발 작업 완료 여부",
            status: "failed",
            severity: "high",
            detail: "developer task done 없음",
          },
        ],
        failedTaskIds: [],
      };
    }
    return {
      version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
      role: "reviewer",
      status: "passed",
      createdAt: now,
      updatedAt: now,
      source: "mock_local_gate",
      summary: "핵심 작업 흐름 기준 검수 통과",
      checks: [
        {
          id: "dev-flow",
          title: "핵심 작업 흐름 기준 검수",
          status: "passed",
        },
        {
          id: "dev-no-failed",
          title: "실패한 개발 작업 없음",
          status: "passed",
        },
      ],
      failedTaskIds: [],
    };
  }

  if (developerFailed.length > 0) {
    return {
      version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
      role: "security",
      status: "failed",
      createdAt: now,
      updatedAt: now,
      source: "mock_local_gate",
      summary: "실패한 개발 작업이 있어 보안 점검을 통과할 수 없습니다.",
      checks: [
        {
          id: "dev-failed",
          title: "개발 작업 실패 여부",
          status: "failed",
          severity: "high",
          detail: `${developerFailed.length}개 개발 작업 실패`,
          targetTaskIds: developerFailed.map((i) => i.taskId),
        },
      ],
      failedTaskIds: developerFailed.map((i) => i.taskId),
    };
  }

  return {
    version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
    role: "security",
    status: "passed",
    createdAt: now,
    updatedAt: now,
    source: "mock_local_gate",
    summary: "기본 보안 점검 기준 통과",
    checks: [
      {
        id: "dev-done",
        title: "개발 작업 완료 확인",
        status: developerDone ? "passed" : "warning",
        detail: developerDone ? undefined : "developer task done 없음 — 경고만 표시",
      },
      {
        id: "security-baseline",
        title: "기본 보안 점검",
        status: "passed",
      },
    ],
    failedTaskIds: [],
  };
}

export type ImplementationQualityGateCheckOutcome = Readonly<{
  executionState: ImplementationTaskExecutionStateV1;
  qualityGateResult: ImplementationQualityGateResultV1;
  qualityGateResults: readonly ImplementationQualityGateResultV1[];
  aiMessageContent: string;
  passed: boolean;
}>;

export function buildImplementationQualityGateRunMessageContent(input: {
  readonly role: ImplementationQualityGateRole;
  readonly result: ImplementationQualityGateResultV1;
}): string {
  const roleLabel = input.role === "reviewer" ? "AI 검수자" : "AI 보안관";
  const statusLabel = input.result.status === "passed" ? "통과" : "실패";
  const lines = formatImplementationQualityGateResultLines(input.result);
  if (input.result.status === "passed") {
    return [
      `${roleLabel} 점검이 완료되었습니다.`,
      `결과: ${statusLabel}`,
      ...lines.slice(1).map((l) => (l.startsWith("-") ? l : `- ${l}`)),
    ].join("\n");
  }
  return [
    `${roleLabel} 점검에서 보완이 필요합니다.`,
    `결과: ${statusLabel}`,
    ...lines.slice(1).map((l) => (l.startsWith("-") || l.startsWith("✓") || l.startsWith("✗") || l.startsWith("!") ? l : `- ${l}`)),
    "",
    "다음 작업으로 AI 개발자에게 보완 요청을 진행해 주세요.",
  ].join("\n");
}

export function executeImplementationQualityGateCheck(input: {
  readonly role: ImplementationQualityGateRole;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState: ImplementationTaskExecutionStateV1 | null | undefined;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly projectId: string;
  readonly nowIso?: string;
}): ImplementationQualityGateCheckOutcome | Readonly<{ blocked: string }> {
  const now = input.nowIso ?? new Date().toISOString();
  const roleTasks = (input.taskList.tasks ?? []).filter((t) => t.ownerRole === input.role);
  if (!roleTasks.length) {
    return {
      blocked: input.role === "reviewer" ? "검수자 작업이 없어 점검을 실행할 수 없습니다." : "보안 점검 작업이 없어 점검을 실행할 수 없습니다.",
    };
  }

  let state =
    input.executionState ??
    buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: input.projectId,
      taskList: input.taskList,
      nowIso: now,
    });

  const inProgressSummary =
    input.role === "reviewer" ? "AI 검수자 점검 진행 중" : "AI 보안관 점검 진행 중";
  state = markRoleTasksInProgress({
    state,
    ownerRole: input.role,
    nowIso: now,
    resultSummary: inProgressSummary,
  });

  const gateResult = buildMockImplementationQualityGateResult({
    role: input.role,
    taskList: input.taskList,
    executionState: state,
    nowIso: now,
  });

  if (gateResult.status === "passed") {
    state = markRoleTasksDone({
      state,
      ownerRole: input.role,
      nowIso: now,
      resultSummary: gateResult.summary,
    });
  } else {
    state = markRoleTasksFailed({
      state,
      ownerRole: input.role,
      nowIso: now,
      errorMessage: gateResult.summary,
      resultSummary: gateResult.summary,
    });
  }

  const qualityGateResults = appendImplementationQualityGateResult({
    existing: input.qualityGateResults,
    result: gateResult,
  });

  return {
    executionState: state,
    qualityGateResult: gateResult,
    qualityGateResults,
    aiMessageContent: buildImplementationQualityGateRunMessageContent({ role: input.role, result: gateResult }),
    passed: gateResult.status === "passed",
  };
}
