import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

export const IMPLEMENTATION_TASK_LIST_VERSION = "implementation_task_list_v1" as const;

export type ImplementationTaskType =
  | "screen"
  | "feature"
  | "data"
  | "mock"
  | "api"
  | "state"
  | "validation"
  | "security"
  | "scm";

export type ImplementationTaskOwnerRole =
  | "developer"
  | "designer"
  | "reviewer"
  | "security"
  | "scm";

export type ImplementationTaskPriority = "high" | "medium" | "low";

export type ImplementationTaskStatus = "ready" | "blocked" | "in_progress" | "done";

export type ImplementationTaskV1 = Readonly<{
  taskId: string;
  title: string;
  description: string;
  taskType: ImplementationTaskType;
  ownerRole: ImplementationTaskOwnerRole;
  priority: ImplementationTaskPriority;
  dependencies: readonly string[];
  sourceRef?: Readonly<{
    type: "process" | "screen" | "actor" | "common_feature" | "data_model" | "artifact";
    id?: string;
    title?: string;
  }>;
  acceptanceCriteria: readonly string[];
  status: ImplementationTaskStatus;
}>;

export type ImplementationTaskListV1 = Readonly<{
  version: typeof IMPLEMENTATION_TASK_LIST_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  source: "implementation_seed";
  seedCreatedAt?: string;
  tasks: readonly ImplementationTaskV1[];
  roleSummary: Readonly<Record<ImplementationTaskOwnerRole, number>>;
}>;

function emptyRoleSummary(): Record<ImplementationTaskOwnerRole, number> {
  return { developer: 0, designer: 0, reviewer: 0, security: 0, scm: 0 };
}

export function summarizeImplementationTaskRoles(
  tasks: readonly ImplementationTaskV1[],
): Readonly<Record<ImplementationTaskOwnerRole, number>> {
  const summary = emptyRoleSummary();
  for (const task of tasks) {
    if (!task) continue;
    if (task.ownerRole in summary) summary[task.ownerRole] += 1;
  }
  return summary;
}

function makeId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildImplementationTaskListFromSeed(input: {
  readonly projectId: string;
  readonly seed: ImplementationSeedV1;
  readonly nowIso?: string;
}): ImplementationTaskListV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();

  const tasks: ImplementationTaskV1[] = [];

  const screenItems = input.seed.screenImplementationItems ?? [];
  const processItems = input.seed.processImplementationItems ?? [];
  const commonFeatures = input.seed.commonDetailFeatures ?? [];
  const dataEntities = input.seed.dataModelSeed?.entities ?? [];

  let devScreenIndex = 0;
  for (const s of screenItems) {
    const screenName = normalizeText(s.screenName) || "화면";
    tasks.push({
      taskId: makeId("DEV-SCREEN", devScreenIndex++),
      title: `${screenName} 화면 구현`,
      description: `화면 정의와 Quick Design 산출물을 기준으로 ${screenName} 화면을 구현합니다.`,
      taskType: "screen",
      ownerRole: "developer",
      priority: screenItems.length <= 3 ? "high" : "medium",
      dependencies: [],
      sourceRef: { type: "screen", id: s.id, title: screenName },
      acceptanceCriteria: [
        "주요 UI 영역이 표시된다.",
        "Mock 데이터 기준으로 화면 상태를 확인할 수 있다.",
        "기본 사용자 흐름이 연결된다.",
      ],
      status: "ready",
    });
    tasks.push({
      taskId: makeId("DESIGN", devScreenIndex - 1),
      title: `${screenName} UI/UX 검토`,
      description: `${screenName} 화면 구성과 상호작용이 기획 산출물과 일치하는지 점검합니다.`,
      taskType: "validation",
      ownerRole: "designer",
      priority: "medium",
      dependencies: [],
      sourceRef: { type: "screen", id: s.id, title: screenName },
      acceptanceCriteria: ["UI 구성과 용어가 기획 산출물과 일치한다.", "주요 인터랙션이 자연스럽다."],
      status: "ready",
    });
  }

  let devFeatureIndex = 0;
  for (const p of processItems) {
    const name = normalizeText(p.processName) || "프로세스";
    tasks.push({
      taskId: makeId("DEV-FEATURE", devFeatureIndex++),
      title: `${name} 기능 구현`,
      description: "프로세스 흐름에 맞춰 핵심 동작과 상태 처리를 구현합니다.",
      taskType: "feature",
      ownerRole: "developer",
      priority: devFeatureIndex <= 3 ? "high" : "medium",
      dependencies: [],
      sourceRef: { type: "process", id: p.id, title: name },
      acceptanceCriteria: ["프로세스 핵심 동작이 동선에 맞게 동작한다.", "예외/빈 상태가 처리된다."],
      status: "ready",
    });
  }

  let commonIndex = 0;
  for (const f of commonFeatures) {
    const name = normalizeText(f.name) || "공통 기능";
    tasks.push({
      taskId: makeId("DEV-COMMON", commonIndex++),
      title: `${name} 공통 기능 구현`,
      description: f.description?.trim()
        ? `공통 상세기능 요구에 따라 ${name}을 구현합니다.\n\n- 요구: ${f.description.trim()}`
        : `공통 상세기능 요구에 따라 ${name}을 구현합니다.`,
      taskType: "feature",
      ownerRole: "developer",
      priority: f.required ? "high" : "medium",
      dependencies: [],
      sourceRef: { type: "common_feature", title: name },
      acceptanceCriteria: ["기획 산출물 기준으로 공통 동작이 적용된다."],
      status: "ready",
    });
  }

  if (dataEntities.length > 0) {
    tasks.push({
      taskId: "DEV-MOCK-001",
      title: "Mock 데이터 구조 정의",
      description: "화면/기능 검증에 필요한 Mock 데이터 구조를 정의합니다.",
      taskType: "mock",
      ownerRole: "developer",
      priority: "high",
      dependencies: [],
      sourceRef: { type: "data_model", title: "data_entities" },
      acceptanceCriteria: ["주요 엔티티별 예시 데이터가 준비된다.", "화면 상태를 재현할 수 있다."],
      status: "ready",
    });
  } else {
    tasks.push({
      taskId: "DEV-MOCK-001",
      title: "Mock 데이터 기본 세트 준비",
      description: "초기 검증을 위한 Mock JSON / local state 데이터를 준비합니다.",
      taskType: "mock",
      ownerRole: "developer",
      priority: "medium",
      dependencies: [],
      acceptanceCriteria: ["주요 화면이 최소 데이터로 렌더링된다."],
      status: "ready",
    });
  }

  const mockTaskId = "DEV-MOCK-001";

  // Dependencies: mock data -> dev tasks -> review/security -> scm
  const devTaskIds = tasks
    .filter((t) => t.ownerRole === "developer")
    .map((t) => t.taskId);

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]!;
    if (t.ownerRole === "developer" && t.taskId !== mockTaskId) {
      tasks[i] = {
        ...t,
        dependencies: t.dependencies.includes(mockTaskId) ? t.dependencies : [...t.dependencies, mockTaskId],
      };
    }
  }

  tasks.push({
    taskId: "REVIEW-001",
    title: "기능 흐름 검수",
    description: "생성된 화면과 기능이 기획 산출물의 사용자 흐름과 일치하는지 점검합니다.",
    taskType: "validation",
    ownerRole: "reviewer",
    priority: "high",
    dependencies: devTaskIds,
    acceptanceCriteria: ["핵심 사용자 흐름이 단계별로 동작한다.", "핵심 성공/실패 케이스가 확인된다."],
    status: "ready",
  });

  const seedText = JSON.stringify(input.seed).toLowerCase();
  const securityCriteria: string[] = [
    "입력값 검증 또는 escape 정책이 정의되어야 한다.",
    "민감정보가 UI/로그에 노출되지 않아야 한다.",
  ];
  if (/(upload|업로드|file|파일)/.test(seedText)) {
    securityCriteria.push("허용 파일 확장자와 크기 제한이 정의되어야 한다.");
  }
  if (/(auth|로그인|권한|role|permission|인증)/.test(seedText)) {
    securityCriteria.push("권한 없는 접근이 차단되어야 한다.");
  }
  tasks.push({
    taskId: "SECURITY-001",
    title: "기본 보안 점검",
    description: "입력값, 파일 업로드, 권한, 민감정보 노출 가능성을 점검합니다.",
    taskType: "security",
    ownerRole: "security",
    priority: "high",
    dependencies: devTaskIds,
    acceptanceCriteria: securityCriteria,
    status: "ready",
  });

  tasks.push({
    taskId: "SCM-001",
    title: "브랜치·커밋·PR 반영",
    description: "AI 개발자 작업 결과를 Git 브랜치, 커밋, PR 단위로 관리합니다.",
    taskType: "scm",
    ownerRole: "scm",
    priority: "high",
    dependencies: ["REVIEW-001", "SECURITY-001"],
    acceptanceCriteria: [
      "작업 단위별 커밋 메시지/스코프 기준이 정의된다.",
      "변경이 PR 단위로 관리된다.",
      "리뷰 후 main에 반영된다.",
    ],
    status: "ready",
  });

  // Ensure minimal role coverage even when seed is empty-ish.
  const roleSummary = summarizeImplementationTaskRoles(tasks);
  if (roleSummary.developer <= 0) {
    tasks.unshift({
      taskId: "DEV-INIT-001",
      title: "기본 화면/흐름 골격 구성",
      description: "기획 산출물을 기준으로 초기 화면/라우팅/상태 골격을 구성합니다.",
      taskType: "feature",
      ownerRole: "developer",
      priority: "high",
      dependencies: [],
      acceptanceCriteria: ["기본 라우팅/레이아웃이 동작한다."],
      status: "ready",
    });
  }

  return {
    version: IMPLEMENTATION_TASK_LIST_VERSION,
    projectId: pid,
    createdAt: now,
    updatedAt: now,
    source: "implementation_seed",
    seedCreatedAt: input.seed.createdAt,
    tasks,
    roleSummary: summarizeImplementationTaskRoles(tasks),
  };
}

export function hasImplementationTaskListReady(
  taskList: ImplementationTaskListV1 | null | undefined,
): boolean {
  return Boolean(taskList && Array.isArray(taskList.tasks) && taskList.tasks.length > 0);
}

export type PlanningImplementationExecutionReadiness =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; missing: readonly string[]; message: string }>;

export function isPlanningReadyForImplementationExecution(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): boolean {
  const seed = input.implementationSeedV1;
  if (!seed?.readiness?.ready || seed.lifecycleStatus === "candidate") return false;
  const list = input.implementationTaskListV1;
  if (!hasImplementationTaskListReady(list)) return false;
  const summary = list?.roleSummary ?? emptyRoleSummary();
  return (
    summary.developer >= 1 &&
    summary.reviewer >= 1 &&
    summary.security >= 1 &&
    summary.scm >= 1
  );
}

export function evaluatePlanningImplementationExecutionReadiness(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): PlanningImplementationExecutionReadiness {
  const missing: string[] = [];
  const seed = input.implementationSeedV1;
  if (!seed) {
    missing.push("implementation_seed_missing");
  } else {
    if (seed.lifecycleStatus === "candidate") missing.push("implementation_seed_candidate");
    if (!seed.readiness?.ready) missing.push("implementation_seed_not_ready");
  }

  const list = input.implementationTaskListV1;
  if (!list) {
    missing.push("implementation_task_list_missing");
  } else if (!Array.isArray(list.tasks) || list.tasks.length <= 0) {
    missing.push("implementation_task_list_empty");
  }

  const summary = list?.roleSummary ?? emptyRoleSummary();
  if (summary.developer <= 0) missing.push("developer_tasks_missing");
  if (summary.reviewer <= 0) missing.push("reviewer_tasks_missing");
  if (summary.security <= 0) missing.push("security_tasks_missing");
  if (summary.scm <= 0) missing.push("scm_tasks_missing");

  if (!missing.length) return { ok: true };

  const message =
    "구현 실행 준비가 아직 완료되지 않았습니다. Implementation Seed/Task List 상태를 확인해 주세요.";
  return { ok: false, missing: [...new Set(missing)], message };
}

export function parseImplementationTaskListV1(
  raw: unknown,
): ImplementationTaskListV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== IMPLEMENTATION_TASK_LIST_VERSION) return null;

  const projectId = String(o.projectId ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  if (!projectId || !createdAt) return null;

  const tasksRaw = Array.isArray(o.tasks) ? (o.tasks as unknown[]) : null;
  if (!tasksRaw) return null;

  const tasks: ImplementationTaskV1[] = [];
  for (const row of tasksRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const taskId = String(r.taskId ?? "").trim();
    const title = String(r.title ?? "").trim();
    const description = String(r.description ?? "").trim();
    const taskType = String(r.taskType ?? "").trim() as ImplementationTaskType;
    const ownerRole = String(r.ownerRole ?? "").trim() as ImplementationTaskOwnerRole;
    const priority = String(r.priority ?? "").trim() as ImplementationTaskPriority;
    const status = String(r.status ?? "").trim() as ImplementationTaskStatus;
    if (!taskId || !title || !description) continue;
    if (
      ![
        "screen",
        "feature",
        "data",
        "mock",
        "api",
        "state",
        "validation",
        "security",
        "scm",
      ].includes(taskType)
    ) {
      continue;
    }
    if (!["developer", "designer", "reviewer", "security", "scm"].includes(ownerRole)) continue;
    if (!["high", "medium", "low"].includes(priority)) continue;
    if (!["ready", "blocked", "in_progress", "done"].includes(status)) continue;
    const dependencies = Array.isArray(r.dependencies)
      ? (r.dependencies as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
      : [];
    const acceptanceCriteria = Array.isArray(r.acceptanceCriteria)
      ? (r.acceptanceCriteria as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
      : [];
    const sourceRefRaw = r.sourceRef && typeof r.sourceRef === "object" ? (r.sourceRef as Record<string, unknown>) : null;
    const sourceRef =
      sourceRefRaw && ["process", "screen", "actor", "common_feature", "data_model", "artifact"].includes(String(sourceRefRaw.type ?? ""))
        ? {
            type: String(sourceRefRaw.type) as ImplementationTaskV1["sourceRef"] extends infer T ? (T extends { type: infer U } ? U : never) : never,
            id: String(sourceRefRaw.id ?? "").trim() || undefined,
            title: String(sourceRefRaw.title ?? "").trim() || undefined,
          }
        : undefined;
    tasks.push({
      taskId,
      title,
      description,
      taskType,
      ownerRole,
      priority,
      dependencies,
      sourceRef,
      acceptanceCriteria,
      status,
    });
  }

  const updatedAt = String(o.updatedAt ?? createdAt).trim() || createdAt;
  const seedCreatedAt = String(o.seedCreatedAt ?? "").trim() || undefined;
  const roleSummary =
    o.roleSummary && typeof o.roleSummary === "object"
      ? summarizeImplementationTaskRoles(tasks)
      : summarizeImplementationTaskRoles(tasks);

  return {
    version: IMPLEMENTATION_TASK_LIST_VERSION,
    projectId,
    createdAt,
    updatedAt,
    source: "implementation_seed",
    ...(seedCreatedAt ? { seedCreatedAt } : {}),
    tasks,
    roleSummary,
  };
}

