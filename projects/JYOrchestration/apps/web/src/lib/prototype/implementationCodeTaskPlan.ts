import {
  parseCodeTaskFileBoundaryV1,
  type CodeTaskFileBoundaryV1,
} from "@/lib/prototype/codeTaskFileBoundary";
import type { CodeTaskConflictPlanV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import type {
  CodeTaskBranchPlanV1,
  ImplementationBranchPlanV1,
} from "@/lib/prototype/implementationBranchPlan";
import {
  parseCodeTaskBranchPlanV1,
  parseImplementationBranchPlanV1,
} from "@/lib/prototype/implementationBranchPlan";
import { repairCodeTaskPlanFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { appendIntegrationWiringCodeTaskToPlan } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { applyBranchPlanToCodeTaskPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import { inferCodeTaskFileBoundary } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  buildImplementationTaskExecutionHints,
  COMMON_FORBIDDEN_PATHS,
} from "@/lib/prototype/implementationExecutionHints";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  ImplementationTaskListV1,
  ImplementationTaskPriority,
  ImplementationTaskType,
  ImplementationTaskV1,
} from "@/lib/requirements/implementationTaskList";

export const IMPLEMENTATION_CODE_TASK_PLAN_VERSION = "implementation_code_task_plan_v1" as const;

export type ImplementationCodeTaskChangeType =
  | "component"
  | "state"
  | "api"
  | "data"
  | "test"
  | "style"
  | "config"
  | "integration"
  | "unknown";

export type ImplementationCodeTaskStatus =
  | "draft"
  | "ready"
  | "blocked"
  | "running"
  | "done"
  | "failed";

export type ImplementationCodeTaskV1 = Readonly<{
  codeTaskId: string;
  parentTaskId: string;
  title: string;
  description: string;
  changeType: ImplementationCodeTaskChangeType;
  targetHints: readonly string[];
  candidateFiles?: readonly string[];
  candidateFileHints?: readonly string[];
  /** @deprecated 호환용 — parentTaskDependencies + codeTaskDependencies 합산 */
  dependencies: readonly string[];
  parentTaskDependencies?: readonly string[];
  codeTaskDependencies?: readonly string[];
  acceptanceCriteria: readonly string[];
  verificationHints: readonly string[];
  forbiddenPaths: readonly string[];
  priority: "P0" | "P1" | "P2";
  status: ImplementationCodeTaskStatus;
  blockers: readonly string[];
  refinementSource?: "heuristic" | "llm";
  llmRationale?: string;
  fileBoundary?: CodeTaskFileBoundaryV1 | null;
  branchPlan?: CodeTaskBranchPlanV1 | null;
}>;

export type ImplementationCodeTaskPlanRefinementSource =
  | "heuristic"
  | "llm_refined"
  | "llm_partial_refined"
  | "llm_failed_heuristic_fallback";

export type ImplementationCodeTaskPlanRefinementStatus =
  | "heuristic_only"
  | "llm_refined"
  | "llm_partial_refined"
  | "llm_validation_failed"
  | "llm_validation_failed_fallback"
  | "llm_unavailable_fallback"
  | "llm_parse_failed_fallback"
  | "llm_shape_invalid_fallback"
  | "llm_timeout_fallback";

export type ImplementationCodeTaskPlanLlmRefinementSummaryV1 = Readonly<{
  readonly totalBatches: number;
  readonly llmRefinedBatches: number;
  readonly fallbackBatches: number;
  readonly llmRefinedTaskCount: number;
  readonly fallbackTaskCount: number;
  readonly concurrency?: number;
  readonly elapsedMs?: number;
}>;

export type ImplementationCodeTaskPlanValidationReportV1 = Readonly<{
  status: "passed" | "failed";
  checkedAt: string;
  errors: readonly string[];
  warnings: readonly string[];
}>;

export type ImplementationCodeTaskPlanV1 = Readonly<{
  version: typeof IMPLEMENTATION_CODE_TASK_PLAN_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  source: "implementation_task_list";
  parentTaskCount: number;
  codeTaskCount: number;
  tasks: readonly ImplementationCodeTaskV1[];
  readiness: Readonly<{
    ready: boolean;
    missing: readonly string[];
  }>;
  refinementSource?: ImplementationCodeTaskPlanRefinementSource;
  refinementStatus?: ImplementationCodeTaskPlanRefinementStatus;
  validationReport?: ImplementationCodeTaskPlanValidationReportV1;
  llmRefinedAt?: string;
  heuristicTaskCount?: number;
  refinedTaskCount?: number;
  llmPromptFingerprint?: string;
  llmResultFingerprint?: string;
  sourceTaskListFingerprint?: string;
  sourceSeedFingerprint?: string;
  refinementRequestedAt?: string;
  refinementCompletedAt?: string;
  llmUsage?: Readonly<{
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalTokens?: number;
    readonly model?: string;
  }>;
  llmRefinementSummary?: ImplementationCodeTaskPlanLlmRefinementSummaryV1;
  codeTaskConflictPlanV1?: CodeTaskConflictPlanV1 | null;
  implementationBranchPlanV1?: ImplementationBranchPlanV1 | null;
}>;

export const IMPLEMENTATION_CODE_TASK_CONSOLIDATION_LLM_GUIDELINES = [
  "Consolidation policy:",
  "- CodeTask를 너무 작게 쪼개지 말 것",
  "- UI/state/integration/tests는 기본적으로 하나의 CodeTask 내부 하위 작업으로 통합",
  "- 사용자가 선택할 수 있는 단위로 작성",
  "- Cursor가 한 번에 작업 가능한 범위로 유지",
  "- 명확히 독립적인 구현 단위일 때만 분리",
] as const;

export const IMPLEMENTATION_CODE_TASK_CHANGE_TYPES: readonly ImplementationCodeTaskChangeType[] = [
  "component",
  "state",
  "api",
  "data",
  "test",
  "style",
  "config",
  "integration",
  "unknown",
] as const;

export const IMPLEMENTATION_CODE_TASK_STATUSES: readonly ImplementationCodeTaskStatus[] = [
  "draft",
  "ready",
  "blocked",
  "running",
  "done",
  "failed",
] as const;

type CodeTaskBlueprint = Readonly<{
  readonly changeType: ImplementationCodeTaskChangeType;
  readonly titleSuffix: string;
  readonly descriptionSuffix: string;
  readonly targetHint: string;
  readonly verificationHint: string;
}>;

function mapTaskPriorityToCodePriority(
  priority: ImplementationTaskPriority | string,
): "P0" | "P1" | "P2" {
  const raw = String(priority ?? "").trim().toLowerCase();
  if (raw === "high") return "P0";
  if (raw === "low") return "P2";
  return "P1";
}

function blueprintsForTaskType(taskType: ImplementationTaskType): readonly CodeTaskBlueprint[] {
  switch (taskType) {
    case "frame":
      return [
        {
          changeType: "component",
          titleSuffix: "앱 Shell/공통 화면 프레임",
          descriptionSuffix: [
            "선택 템플릿의 layoutContract를 기준으로 앱 전체 화면 프레임과 공통 레이아웃을 구현합니다.",
            "navigationItems, summaryCards, primarySections를 공통 frame에 반영합니다.",
            "모바일 viewport/container, page shell, loading/error/empty frame을 준비합니다.",
          ].join("\n"),
          targetHint: "app shell / layout",
          verificationHint: "주요 화면이 동일한 공통 frame/container 안에서 렌더링되는지 확인",
        },
      ];
    case "screen":
      return [
        {
          changeType: "component",
          titleSuffix: "화면 구현",
          descriptionSuffix: [
            "화면 UI, 상태 흐름, 연동, 레이아웃을 하나의 실행 단위로 구현합니다.",
            "",
            "하위 작업:",
            "- UI 컴포넌트 및 레이아웃 구현",
            "- 상태/이벤트 핸들러 및 데이터 바인딩",
            "- 필요한 화면 연동",
            "- 기본 동작 및 렌더링 검증",
          ].join("\n"),
          targetHint: "components",
          verificationHint: "화면 렌더링, 상태 전환, 주요 사용자 흐름 확인",
        },
      ];
    case "feature":
      return [
        {
          changeType: "component",
          titleSuffix: "기능 구현",
          descriptionSuffix: [
            "기능 UI, 상태 흐름, 연동을 하나의 실행 단위로 구현합니다.",
            "",
            "하위 작업:",
            "- UI/logic component 구현",
            "- 상태 흐름 및 예외 처리",
            "- 기존 화면/모듈 연동",
            "- 기본 동작 검증",
          ].join("\n"),
          targetHint: "components",
          verificationHint: "기능 진입점, 상태 전환, 연동 지점 확인",
        },
      ];
    case "api":
      return [
        {
          changeType: "api",
          titleSuffix: "API 구현",
          descriptionSuffix: [
            "API handler, 연동, 기본 검증을 하나의 실행 단위로 구현합니다.",
            "",
            "하위 작업:",
            "- API route/handler 및 스키마 구현",
            "- 클라이언트/서비스 연동",
            "- 요청/응답 및 오류 처리 검증",
          ].join("\n"),
          targetHint: "api",
          verificationHint: "API 요청/응답, 연동 호출, 오류 처리 확인",
        },
      ];
    case "mock":
    case "data":
      return [
        {
          changeType: "data",
          titleSuffix: "샘플 데이터 구현",
          descriptionSuffix: [
            "Preview와 화면 검증에 필요한 샘플 데이터와 상태 데이터를 하나의 실행 단위로 구현합니다.",
            "",
            "하위 작업:",
            "- 샘플 데이터 구조와 상태 데이터 정의",
            "- 화면/기능 상태에 샘플 데이터 연결",
            "- 샘플 데이터로 화면/기능 재현 검증",
          ].join("\n"),
          targetHint: "data",
          verificationHint: "샘플 데이터로 화면/기능 재현 확인",
        },
      ];
    case "state":
      return [
        {
          changeType: "state",
          titleSuffix: "상태 모듈 구현",
          descriptionSuffix: [
            "상태 모듈, selector/action, 기본 검증을 하나의 실행 단위로 구현합니다.",
          ].join("\n"),
          targetHint: "state",
          verificationHint: "상태 변경, 파생 값, 기본 동작 확인",
        },
      ];
    default:
      return [
        {
          changeType: "unknown",
          titleSuffix: "implementation",
          descriptionSuffix: "TaskList developer Task를 코드 변경 단위로 구현합니다.",
          targetHint: "scope",
          verificationHint: "완료 기준 충족 확인",
        },
      ];
  }
}

function buildCodeTaskId(parentTaskId: string, sequence: number): string {
  return `CODE-${parentTaskId}-${String(sequence).padStart(3, "0")}`;
}

function codeTaskRequiredFieldsMissing(input: {
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly title: string;
  readonly description: string;
  readonly changeType: ImplementationCodeTaskChangeType;
  readonly targetHints: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly verificationHints: readonly string[];
  readonly forbiddenPaths: readonly string[];
}): boolean {
  return (
    !input.codeTaskId.trim() ||
    !input.parentTaskId.trim() ||
    !input.title.trim() ||
    !input.description.trim() ||
    !input.changeType ||
    input.targetHints.length === 0 ||
    input.acceptanceCriteria.length === 0 ||
    input.verificationHints.length === 0 ||
    input.forbiddenPaths.length === 0
  );
}

function resolveCodeTaskStatus(input: {
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly requiredFieldsMissing: boolean;
}): ImplementationCodeTaskStatus {
  if (!input.envOk || !input.designOk) return "blocked";
  if (input.requiredFieldsMissing) return "draft";
  return "ready";
}

function decomposeDeveloperTaskToCodeTasks(input: {
  readonly task: ImplementationTaskV1;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly envOk: boolean;
  readonly designOk: boolean;
}): readonly ImplementationCodeTaskV1[] {
  const { task } = input;
  const blueprints = blueprintsForTaskType(task.taskType);
  const executionHints = buildImplementationTaskExecutionHints({
    taskTitle: task.title,
    sourceArtifactTypes: [],
    projectArtifacts: input.projectArtifacts,
    targetRepoKind: "generated_project",
  });
  const acceptanceBase = task.acceptanceCriteria?.length
    ? [...task.acceptanceCriteria]
    : [`${task.title} 요구사항을 충족한다.`];
  const priority = mapTaskPriorityToCodePriority(task.priority);
  const forbiddenPaths = executionHints.forbiddenPaths.length
    ? executionHints.forbiddenPaths
    : COMMON_FORBIDDEN_PATHS;

  return blueprints.map((blueprint, index) => {
    const sequence = index + 1;
    const codeTaskId = buildCodeTaskId(task.taskId, sequence);
    const candidateFileHints = [
      ...executionHints.candidateDirectories.slice(0, 2).map((dir) => `dir:${dir}`),
      ...executionHints.candidateFiles.slice(0, 3),
    ];
    const candidateFiles =
      blueprint.changeType === "component" || blueprint.changeType === "api"
        ? executionHints.candidateFiles.slice(0, 2)
        : undefined;
    const parentTaskDependencies = index === 0 ? [...(task.dependencies ?? [])] : [];
    const codeTaskDependencies = index === 0 ? [] : [buildCodeTaskId(task.taskId, index)];
    const dependencies = [...parentTaskDependencies, ...codeTaskDependencies];
    const draft = {
      codeTaskId,
      parentTaskId: task.taskId,
      title: `${task.title} · ${blueprint.titleSuffix}`,
      description: `${String(task.description ?? "").trim() || task.title}\n\n${blueprint.descriptionSuffix}`,
      changeType: blueprint.changeType,
      targetHints: [blueprint.targetHint, task.taskId],
      ...(candidateFiles?.length ? { candidateFiles } : {}),
      ...(candidateFileHints.length ? { candidateFileHints } : {}),
      dependencies,
      parentTaskDependencies,
      codeTaskDependencies,
      acceptanceCriteria: [
        ...acceptanceBase.slice(0, 2),
        blueprint.verificationHint,
      ],
      verificationHints: [
        blueprint.verificationHint,
        ...executionHints.manualVerification.slice(0, 1),
        ...executionHints.testCommands.slice(0, 1),
      ],
      forbiddenPaths,
      priority,
      blockers: [],
      refinementSource: "heuristic",
    };
    const requiredFieldsMissing = codeTaskRequiredFieldsMissing(draft);
    const fileBoundary = inferCodeTaskFileBoundary({
      codeTask: { ...draft, status: "draft" },
      parentTaskTitle: task.title,
    });
    return {
      ...draft,
      fileBoundary,
      forbiddenPaths: [
        ...new Set([...forbiddenPaths, ...fileBoundary.forbiddenFiles.slice(0, 6)]),
      ],
      status: resolveCodeTaskStatus({
        envOk: input.envOk,
        designOk: input.designOk,
        requiredFieldsMissing,
      }),
      ...(requiredFieldsMissing && (!input.envOk || !input.designOk)
        ? {}
        : requiredFieldsMissing
          ? { blockers: ["필수 CodeTask 필드 누락"] as const }
          : {}),
    } satisfies ImplementationCodeTaskV1;
  });
}

/** 표시순서 = 실행순서 — TaskList 순서 보강용 (frame → mock → common → process → screen) */
export function sortDeveloperTasksForExecution(
  tasks: readonly ImplementationTaskV1[],
): readonly ImplementationTaskV1[] {
  const rank = (task: ImplementationTaskV1): number => {
    if (task.taskType === "frame") return 10;
    if (task.taskType === "mock") return 20;
    if (task.taskType === "screen") return 50;
    if (task.sourceRef?.type === "common_feature" || task.taskId.startsWith("DEV-COMMON")) return 30;
    if (task.sourceRef?.type === "process" || task.taskId.startsWith("DEV-FEATURE")) return 40;
    return 60;
  };
  return [...tasks]
    .map((task, index) => ({ task, index, order: rank(task) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((row) => row.task);
}

export function buildImplementationCodeTaskPlanFromTaskList(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso?: string;
}): ImplementationCodeTaskPlanV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const developerTasks = sortDeveloperTasksForExecution(
    (input.taskList.tasks ?? []).filter(
      (task) => task.ownerRole === "developer" && task.status === "ready",
    ),
  );
  const projectArtifacts = input.projectArtifacts ?? [];
  const codeTasks = developerTasks.flatMap((task) =>
    decomposeDeveloperTaskToCodeTasks({
      task,
      projectArtifacts,
      envOk: input.envOk,
      designOk: input.designOk,
    }),
  );

  const missing: string[] = [];
  if (!developerTasks.length) missing.push("developer Task 없음");
  if (!codeTasks.length) missing.push("CodeTask 없음");
  if (!input.envOk) missing.push("실행환경 미준비");
  if (!input.designOk) missing.push("디자인 산출물 미준비");
  if (codeTasks.some((task) => task.status === "blocked")) missing.push("blocked CodeTask 존재");
  if (codeTasks.some((task) => task.status === "draft")) missing.push("draft CodeTask 존재");

  let plan: ImplementationCodeTaskPlanV1 = {
    version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    source: "implementation_task_list",
    parentTaskCount: developerTasks.length,
    codeTaskCount: codeTasks.length,
    tasks: codeTasks,
    readiness: {
      ready: missing.length === 0 && codeTasks.length > 0 && codeTasks.every((task) => task.status === "ready"),
      missing,
    },
    refinementSource: "heuristic",
    refinementStatus: "heuristic_only",
    heuristicTaskCount: codeTasks.length,
    refinedTaskCount: codeTasks.length,
  };

  const withBoundaries = repairCodeTaskPlanFileBoundaries({ plan, taskList: input.taskList }).plan;
  const withIntegration = appendIntegrationWiringCodeTaskToPlan({
    plan: withBoundaries,
    taskList: input.taskList,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  plan = applyBranchPlanToCodeTaskPlan({ plan: withIntegration, nowIso: now });
  return plan;
}

export function parseImplementationCodeTaskPlanValidationReportV1(
  raw: unknown,
): ImplementationCodeTaskPlanValidationReportV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    status: o.status === "failed" ? "failed" : "passed",
    checkedAt: String(o.checkedAt ?? new Date().toISOString()),
    errors: Array.isArray(o.errors) ? o.errors.map((v) => String(v ?? "").trim()).filter(Boolean) : [],
    warnings: Array.isArray(o.warnings)
      ? o.warnings.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [],
  };
}

export function parseImplementationCodeTaskPlanV1(raw: unknown): ImplementationCodeTaskPlanV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_CODE_TASK_PLAN_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const tasksRaw = Array.isArray(o.tasks) ? o.tasks : [];
  const tasks: ImplementationCodeTaskV1[] = [];
  for (const item of tasksRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const codeTaskId = String(row.codeTaskId ?? "").trim();
    const parentTaskId = String(row.parentTaskId ?? "").trim();
    if (!codeTaskId || !parentTaskId) continue;
    tasks.push({
      codeTaskId,
      parentTaskId,
      title: String(row.title ?? codeTaskId),
      description: String(row.description ?? ""),
      changeType: (String(row.changeType ?? "unknown") as ImplementationCodeTaskChangeType) || "unknown",
      targetHints: Array.isArray(row.targetHints)
        ? row.targetHints.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
      ...(Array.isArray(row.candidateFiles)
        ? { candidateFiles: row.candidateFiles.map((v) => String(v ?? "").trim()).filter(Boolean) }
        : {}),
      ...(Array.isArray(row.candidateFileHints)
        ? {
            candidateFileHints: row.candidateFileHints
              .map((v) => String(v ?? "").trim())
              .filter(Boolean),
          }
        : {}),
      dependencies: Array.isArray(row.dependencies)
        ? row.dependencies.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
      ...(Array.isArray(row.parentTaskDependencies)
        ? {
            parentTaskDependencies: row.parentTaskDependencies
              .map((v) => String(v ?? "").trim())
              .filter(Boolean),
          }
        : {}),
      ...(Array.isArray(row.codeTaskDependencies)
        ? {
            codeTaskDependencies: row.codeTaskDependencies
              .map((v) => String(v ?? "").trim())
              .filter(Boolean),
          }
        : {}),
      acceptanceCriteria: Array.isArray(row.acceptanceCriteria)
        ? row.acceptanceCriteria.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
      verificationHints: Array.isArray(row.verificationHints)
        ? row.verificationHints.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
      forbiddenPaths: Array.isArray(row.forbiddenPaths)
        ? row.forbiddenPaths.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
      priority: row.priority === "P0" || row.priority === "P2" ? row.priority : "P1",
      status:
        row.status === "ready" ||
        row.status === "blocked" ||
        row.status === "running" ||
        row.status === "done" ||
        row.status === "failed"
          ? row.status
          : "draft",
      blockers: Array.isArray(row.blockers)
        ? row.blockers.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
      ...(row.refinementSource === "llm" || row.refinementSource === "heuristic"
        ? { refinementSource: row.refinementSource }
        : {}),
      ...(typeof row.llmRationale === "string" && row.llmRationale.trim()
        ? { llmRationale: row.llmRationale.trim() }
        : {}),
      ...(parseCodeTaskFileBoundaryV1(row.fileBoundary)
        ? { fileBoundary: parseCodeTaskFileBoundaryV1(row.fileBoundary)! }
        : {}),
      ...(parseCodeTaskBranchPlanV1(row.branchPlan)
        ? { branchPlan: parseCodeTaskBranchPlanV1(row.branchPlan)! }
        : {}),
    });
  }
  const validationReport = parseImplementationCodeTaskPlanValidationReportV1(o.validationReport);
  const readinessRaw =
    o.readiness && typeof o.readiness === "object"
      ? (o.readiness as Record<string, unknown>)
      : {};
  return {
    version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
    projectId,
    createdAt: String(o.createdAt ?? nowIsoFallback()),
    updatedAt: String(o.updatedAt ?? nowIsoFallback()),
    source: "implementation_task_list",
    parentTaskCount: Number(o.parentTaskCount ?? 0) || 0,
    codeTaskCount: tasks.length,
    tasks,
    readiness: {
      ready: readinessRaw.ready === true,
      missing: Array.isArray(readinessRaw.missing)
        ? readinessRaw.missing.map((v) => String(v ?? "").trim()).filter(Boolean)
        : [],
    },
    ...(o.refinementSource === "heuristic" ||
    o.refinementSource === "llm_refined" ||
    o.refinementSource === "llm_partial_refined" ||
    o.refinementSource === "llm_failed_heuristic_fallback"
      ? { refinementSource: o.refinementSource }
      : {}),
    ...(o.refinementStatus === "heuristic_only" ||
    o.refinementStatus === "llm_refined" ||
    o.refinementStatus === "llm_partial_refined" ||
    o.refinementStatus === "llm_validation_failed" ||
    o.refinementStatus === "llm_validation_failed_fallback" ||
    o.refinementStatus === "llm_unavailable_fallback" ||
    o.refinementStatus === "llm_parse_failed_fallback" ||
    o.refinementStatus === "llm_shape_invalid_fallback" ||
    o.refinementStatus === "llm_timeout_fallback"
      ? { refinementStatus: o.refinementStatus }
      : {}),
    ...(validationReport ? { validationReport } : {}),
    ...(typeof o.llmRefinedAt === "string" && o.llmRefinedAt.trim()
      ? { llmRefinedAt: o.llmRefinedAt.trim() }
      : {}),
    ...(typeof o.heuristicTaskCount === "number" ? { heuristicTaskCount: o.heuristicTaskCount } : {}),
    ...(typeof o.refinedTaskCount === "number" ? { refinedTaskCount: o.refinedTaskCount } : {}),
    ...(typeof o.llmPromptFingerprint === "string" && o.llmPromptFingerprint.trim()
      ? { llmPromptFingerprint: o.llmPromptFingerprint.trim() }
      : {}),
    ...(typeof o.llmResultFingerprint === "string" && o.llmResultFingerprint.trim()
      ? { llmResultFingerprint: o.llmResultFingerprint.trim() }
      : {}),
    ...(typeof o.sourceTaskListFingerprint === "string" && o.sourceTaskListFingerprint.trim()
      ? { sourceTaskListFingerprint: o.sourceTaskListFingerprint.trim() }
      : {}),
    ...(typeof o.sourceSeedFingerprint === "string" && o.sourceSeedFingerprint.trim()
      ? { sourceSeedFingerprint: o.sourceSeedFingerprint.trim() }
      : {}),
    ...(typeof o.refinementRequestedAt === "string" && o.refinementRequestedAt.trim()
      ? { refinementRequestedAt: o.refinementRequestedAt.trim() }
      : {}),
    ...(typeof o.refinementCompletedAt === "string" && o.refinementCompletedAt.trim()
      ? { refinementCompletedAt: o.refinementCompletedAt.trim() }
      : {}),
    ...(o.llmUsage && typeof o.llmUsage === "object"
      ? {
          llmUsage: {
            ...(typeof (o.llmUsage as Record<string, unknown>).promptTokens === "number"
              ? { promptTokens: (o.llmUsage as Record<string, unknown>).promptTokens as number }
              : {}),
            ...(typeof (o.llmUsage as Record<string, unknown>).completionTokens === "number"
              ? {
                  completionTokens: (o.llmUsage as Record<string, unknown>).completionTokens as number,
                }
              : {}),
            ...(typeof (o.llmUsage as Record<string, unknown>).totalTokens === "number"
              ? { totalTokens: (o.llmUsage as Record<string, unknown>).totalTokens as number }
              : {}),
            ...(typeof (o.llmUsage as Record<string, unknown>).model === "string"
              ? { model: String((o.llmUsage as Record<string, unknown>).model).trim() }
              : {}),
          },
        }
      : {}),
    ...(o.llmRefinementSummary && typeof o.llmRefinementSummary === "object"
      ? (() => {
          const s = o.llmRefinementSummary as Record<string, unknown>;
          const num = (key: string) =>
            typeof s[key] === "number" && Number.isFinite(s[key] as number) ? (s[key] as number) : 0;
          return {
            llmRefinementSummary: {
              totalBatches: num("totalBatches"),
              llmRefinedBatches: num("llmRefinedBatches"),
              fallbackBatches: num("fallbackBatches"),
              llmRefinedTaskCount: num("llmRefinedTaskCount"),
              fallbackTaskCount: num("fallbackTaskCount"),
              ...(typeof s.concurrency === "number" && Number.isFinite(s.concurrency)
                ? { concurrency: Math.floor(s.concurrency) }
                : {}),
              ...(typeof s.elapsedMs === "number" && Number.isFinite(s.elapsedMs)
                ? { elapsedMs: Math.floor(s.elapsedMs) }
                : {}),
            },
          };
        })()
      : {}),
    ...(parseImplementationBranchPlanV1(o.implementationBranchPlanV1) !== undefined
      ? {
          implementationBranchPlanV1:
            parseImplementationBranchPlanV1(o.implementationBranchPlanV1) ?? null,
        }
      : {}),
  };
}

function nowIsoFallback(): string {
  return new Date().toISOString();
}
