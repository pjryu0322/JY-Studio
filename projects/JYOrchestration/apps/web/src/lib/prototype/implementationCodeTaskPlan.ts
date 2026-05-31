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
  dependencies: readonly string[];
  acceptanceCriteria: readonly string[];
  verificationHints: readonly string[];
  forbiddenPaths: readonly string[];
  priority: "P0" | "P1" | "P2";
  status: ImplementationCodeTaskStatus;
  blockers: readonly string[];
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
}>;

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
    case "screen":
      return [
        {
          changeType: "component",
          titleSuffix: "UI component",
          descriptionSuffix: "화면 UI 컴포넌트와 레이아웃을 구현합니다.",
          targetHint: "components",
          verificationHint: "화면 렌더링 및 주요 UI 요소 표시 확인",
        },
        {
          changeType: "style",
          titleSuffix: "style/layout",
          descriptionSuffix: "스타일과 레이아웃을 기획 산출물에 맞게 정리합니다.",
          targetHint: "styles",
          verificationHint: "반응형/간격/타이포 일관성 확인",
        },
        {
          changeType: "state",
          titleSuffix: "state/handlers",
          descriptionSuffix: "화면 상태, 이벤트 핸들러, 데이터 바인딩을 구현합니다.",
          targetHint: "state",
          verificationHint: "상태 전이 및 사용자 인터랙션 확인",
        },
        {
          changeType: "test",
          titleSuffix: "tests",
          descriptionSuffix: "화면 관련 단위/컴포넌트 테스트를 보강합니다.",
          targetHint: "tests",
          verificationHint: "관련 테스트 실행",
        },
      ];
    case "feature":
      return [
        {
          changeType: "component",
          titleSuffix: "UI/logic component",
          descriptionSuffix: "기능 UI 및 핵심 로직 컴포넌트를 구현합니다.",
          targetHint: "components",
          verificationHint: "기능 진입점 및 UI 동작 확인",
        },
        {
          changeType: "state",
          titleSuffix: "state flow",
          descriptionSuffix: "기능 상태 흐름과 예외 처리를 구현합니다.",
          targetHint: "state",
          verificationHint: "정상/예외/빈 상태 시나리오 확인",
        },
        {
          changeType: "integration",
          titleSuffix: "integration",
          descriptionSuffix: "기존 화면/모듈과의 연동을 구현합니다.",
          targetHint: "integration",
          verificationHint: "연동 지점 및 데이터 흐름 확인",
        },
        {
          changeType: "test",
          titleSuffix: "tests",
          descriptionSuffix: "기능 관련 테스트를 보강합니다.",
          targetHint: "tests",
          verificationHint: "관련 테스트 실행",
        },
      ];
    case "api":
      return [
        {
          changeType: "api",
          titleSuffix: "API handler",
          descriptionSuffix: "API route/handler 및 요청·응답 스키마를 구현합니다.",
          targetHint: "api",
          verificationHint: "API 요청/응답 및 오류 처리 확인",
        },
        {
          changeType: "integration",
          titleSuffix: "integration",
          descriptionSuffix: "클라이언트/서비스 연동 지점을 구현합니다.",
          targetHint: "integration",
          verificationHint: "연동 호출 및 타입 일치 확인",
        },
        {
          changeType: "test",
          titleSuffix: "tests",
          descriptionSuffix: "API 관련 테스트를 보강합니다.",
          targetHint: "tests",
          verificationHint: "API 테스트 실행",
        },
      ];
    case "mock":
    case "data":
      return [
        {
          changeType: "data",
          titleSuffix: "data model",
          descriptionSuffix: "Mock/데이터 구조와 샘플 데이터를 정의합니다.",
          targetHint: "data",
          verificationHint: "샘플 데이터로 화면/기능 재현 확인",
        },
        {
          changeType: "state",
          titleSuffix: "state wiring",
          descriptionSuffix: "데이터를 화면/기능 상태에 연결합니다.",
          targetHint: "state",
          verificationHint: "데이터 로딩/바인딩 확인",
        },
        {
          changeType: "test",
          titleSuffix: "tests",
          descriptionSuffix: "데이터 관련 테스트를 보강합니다.",
          targetHint: "tests",
          verificationHint: "데이터 fixture 테스트 실행",
        },
      ];
    case "state":
      return [
        {
          changeType: "state",
          titleSuffix: "state module",
          descriptionSuffix: "상태 모듈과 selector/action을 구현합니다.",
          targetHint: "state",
          verificationHint: "상태 변경 및 파생 값 확인",
        },
        {
          changeType: "test",
          titleSuffix: "tests",
          descriptionSuffix: "상태 관련 테스트를 보강합니다.",
          targetHint: "tests",
          verificationHint: "상태 테스트 실행",
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

function decomposeDeveloperTaskToCodeTasks(input: {
  readonly task: ImplementationTaskV1;
  readonly projectArtifacts: readonly ProjectArtifact[];
}): readonly ImplementationCodeTaskV1[] {
  const { task } = input;
  const blueprints = blueprintsForTaskType(task.taskType);
  const executionHints = buildImplementationTaskExecutionHints({
    taskTitle: task.title,
    sourceArtifactTypes: [],
    projectArtifacts: input.projectArtifacts,
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
    const dependencies =
      index === 0
        ? [...(task.dependencies ?? [])]
        : [buildCodeTaskId(task.taskId, index)];

    return {
      codeTaskId,
      parentTaskId: task.taskId,
      title: `${task.title} · ${blueprint.titleSuffix}`,
      description: `${String(task.description ?? "").trim() || task.title}\n\n${blueprint.descriptionSuffix}`,
      changeType: blueprint.changeType,
      targetHints: [blueprint.targetHint, task.taskId],
      ...(candidateFiles?.length ? { candidateFiles } : {}),
      ...(candidateFileHints.length ? { candidateFileHints } : {}),
      dependencies,
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
      status: "draft",
      blockers: [],
    } satisfies ImplementationCodeTaskV1;
  });
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
  const developerTasks = (input.taskList.tasks ?? []).filter(
    (task) => task.ownerRole === "developer" && task.status === "ready",
  );
  const projectArtifacts = input.projectArtifacts ?? [];
  const codeTasks = developerTasks.flatMap((task) =>
    decomposeDeveloperTaskToCodeTasks({ task, projectArtifacts }),
  );

  const missing: string[] = [];
  if (!developerTasks.length) missing.push("developer Task 없음");
  if (!codeTasks.length) missing.push("CodeTask 없음");
  if (!input.envOk) missing.push("실행환경 미준비");
  if (!input.designOk) missing.push("디자인 산출물 미준비");

  return {
    version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    source: "implementation_task_list",
    parentTaskCount: developerTasks.length,
    codeTaskCount: codeTasks.length,
    tasks: codeTasks,
    readiness: {
      ready: missing.length === 0 && codeTasks.length > 0,
      missing,
    },
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
    });
  }
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
  };
}

function nowIsoFallback(): string {
  return new Date().toISOString();
}
