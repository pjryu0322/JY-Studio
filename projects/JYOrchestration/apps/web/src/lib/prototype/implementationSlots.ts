import {
  buildProviderWipBranchName,
  DEFAULT_CODE_AGENT_PROVIDER,
  type CodeAgentProvider,
} from "@/lib/prototype/codeAgentProvider";
import { CODE_AGENT_WIP_POLICY_SLOT_LINES } from "@/lib/prototype/codeAgentWipDeliveryPolicy";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { COMMON_FORBIDDEN_PATHS } from "@/lib/prototype/implementationExecutionHints";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { PlanningHandoffForImplementationV1 } from "@/lib/planning/planningDataSlotsV1";
import {
  implementationDbSlotOverridesForPlanningPersistence,
} from "@/lib/planning/planningDbPersistencePolicy";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

export const IMPLEMENTATION_SLOTS_VERSION = "implementation_slots_v1" as const;

export type ImplementationSlotOwner =
  | "ai_developer"
  | "ai_designer"
  | "ai_reviewer"
  | "ai_security"
  | "scm";

export type DataPersistenceMode = "none" | "mock" | "local" | "db" | "external_api";

export type ImplementationSlotKey =
  | "implementation_scope"
  | "implementation_tasks"
  | "code_agent_provider"
  | "wip_policy"
  | "wip_branch_name"
  | "acceptance_criteria"
  | "security_checks"
  | "test_commands"
  | "forbidden_paths"
  | "developer_review_required"
  | "official_commit_owner"
  | "pr_required"
  | "data_persistence_mode"
  | "db_required"
  | "db_trigger_condition"
  | "data_entities"
  | "storage_strategy"
  | "migration_required"
  | "data_security_level"
  | "backup_retention_policy"
  | "db_owner";

export type ImplementationSlotStatus = "empty" | "candidate" | "partial" | "confirmed" | "blocked";

export type ImplementationSlotValue = string | boolean | readonly string[] | Readonly<Record<string, unknown>>;

export type ImplementationSlot = Readonly<{
  key: ImplementationSlotKey;
  label: string;
  owner: ImplementationSlotOwner;
  status: ImplementationSlotStatus;
  value: ImplementationSlotValue | null;
  confidence: number;
  source: readonly string[];
  reason: string;
  required: boolean;
  updatedAt: string;
}>;

export type ImplementationSlotsReadiness = Readonly<{
  ready: boolean;
  confirmed: number;
  required: number;
  missing: readonly ImplementationSlotKey[];
  blocked: readonly ImplementationSlotKey[];
  candidate: number;
  partial: number;
}>;

export type ImplementationSlotsV1 = Readonly<{
  version: typeof IMPLEMENTATION_SLOTS_VERSION;
  projectId: string;
  mode: "implementation";
  createdAt: string;
  updatedAt: string;
  slots: readonly ImplementationSlot[];
  readiness: ImplementationSlotsReadiness;
}>;

export type BuildImplementationSlotsInput = Readonly<{
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly codeAgentProvider?: CodeAgentProvider;
  readonly envCursorBadge?: "ok" | "needs" | "error" | "loading";
  readonly nowIso?: string;
  readonly planningHandoffForImplementationV1?: PlanningHandoffForImplementationV1 | null;
}>;

export const IMPLEMENTATION_SLOT_META: Record<
  ImplementationSlotKey,
  { readonly label: string; readonly owner: ImplementationSlotOwner; readonly required: boolean }
> = {
  implementation_scope: { label: "구현 범위", owner: "ai_developer", required: true },
  implementation_tasks: { label: "구현 task 목록", owner: "ai_developer", required: true },
  code_agent_provider: { label: "코드 에이전트", owner: "scm", required: true },
  wip_policy: { label: "WIP 정책", owner: "scm", required: true },
  wip_branch_name: { label: "WIP 브랜치", owner: "scm", required: false },
  acceptance_criteria: { label: "검수 기준", owner: "ai_reviewer", required: true },
  security_checks: { label: "보안 기준", owner: "ai_security", required: true },
  test_commands: { label: "테스트 명령", owner: "ai_reviewer", required: true },
  forbidden_paths: { label: "수정 금지 경로", owner: "scm", required: true },
  developer_review_required: { label: "개발자 검토 필요", owner: "ai_developer", required: true },
  official_commit_owner: { label: "공식 반영 담당", owner: "scm", required: true },
  pr_required: { label: "PR 필요", owner: "scm", required: true },
  data_persistence_mode: { label: "저장 방식", owner: "ai_developer", required: false },
  db_required: { label: "DB 필요 여부", owner: "ai_developer", required: false },
  db_trigger_condition: { label: "DB 전환 조건", owner: "ai_developer", required: false },
  data_entities: { label: "저장 대상 엔티티", owner: "ai_designer", required: false },
  storage_strategy: { label: "초기 저장 전략", owner: "ai_developer", required: false },
  migration_required: { label: "migration 필요", owner: "scm", required: false },
  data_security_level: { label: "데이터 보안 수준", owner: "ai_security", required: false },
  backup_retention_policy: { label: "백업·보존 정책", owner: "scm", required: false },
  db_owner: { label: "DB 운영 책임", owner: "scm", required: false },
};

/** DB 연동 task 생성·판단서 확정 시 confirmed 필요(DB 슬롯은 WIP gate에 포함하지 않음) */
export const DB_INTEGRATION_GATE_CONFIRMED_KEYS: readonly ImplementationSlotKey[] = [
  "db_required",
  "data_persistence_mode",
  "data_entities",
  "storage_strategy",
  "migration_required",
  "data_security_level",
  "db_owner",
];

/** WIP 요청 직전: confirmed 필수 + wip_branch는 candidate 이상 */
const CONFIRMED_REQUIRED_KEYS: readonly ImplementationSlotKey[] = [
  "implementation_scope",
  "implementation_tasks",
  "code_agent_provider",
  "wip_policy",
  "acceptance_criteria",
  "security_checks",
  "test_commands",
  "forbidden_paths",
  "developer_review_required",
  "official_commit_owner",
  "pr_required",
];

export function implementationSlotStatusLabel(status: ImplementationSlotStatus): string {
  switch (status) {
    case "confirmed":
      return "확정";
    case "partial":
      return "부분";
    case "candidate":
      return "후보";
    case "blocked":
      return "차단";
    default:
      return "미확보";
  }
}

export function implementationSlotLabel(key: ImplementationSlotKey): string {
  return IMPLEMENTATION_SLOT_META[key]?.label ?? key;
}

function makeSlot(
  key: ImplementationSlotKey,
  input: {
    status: ImplementationSlotStatus;
    value: ImplementationSlotValue | null;
    confidence?: number;
    source?: readonly string[];
    reason?: string;
    nowIso: string;
  },
): ImplementationSlot {
  const meta = IMPLEMENTATION_SLOT_META[key];
  return {
    key,
    label: meta.label,
    owner: meta.owner,
    status: input.status,
    value: input.value,
    confidence: input.confidence ?? (input.status === "confirmed" ? 1 : 0.7),
    source: input.source ?? [],
    reason: input.reason ?? "",
    required: meta.required,
    updatedAt: input.nowIso,
  };
}

function uniqueStrings(items: readonly string[]): string[] {
  return [...new Set(items.map((s) => String(s).trim()).filter(Boolean))];
}

function collectScopeSummary(input: BuildImplementationSlotsInput): string {
  const fromPlan = (input.implementationTaskPlanV1?.items ?? []).map((i) => i.title.trim()).filter(Boolean);
  if (fromPlan.length) return fromPlan.join(", ");
  const fromArtifacts = input.projectArtifacts.map((a) => a.title.trim()).filter(Boolean);
  if (fromArtifacts.length) return fromArtifacts.slice(0, 6).join(", ");
  return "구현 범위 미정 — 작업안 확정 후 보완";
}

function collectAcceptanceCriteria(plan: ImplementationTaskPlanV1 | null | undefined): readonly string[] {
  if (!plan?.items.length) return [];
  return uniqueStrings(plan.items.flatMap((i) => i.acceptanceCriteria));
}

function collectSecurityChecks(plan: ImplementationTaskPlanV1 | null | undefined): readonly string[] {
  if (!plan?.items.length) return [];
  return uniqueStrings(plan.items.flatMap((i) => i.securityChecks));
}

function collectTestCommands(
  plan: ImplementationTaskPlanV1 | null | undefined,
  workItems: readonly CursorWorkItem[] | null | undefined,
): readonly string[] {
  const fromWork = uniqueStrings((workItems ?? []).flatMap((w) => w.testCommands));
  if (fromWork.length) return fromWork;
  const fromPlan = uniqueStrings(
    (plan?.items ?? []).flatMap((i) => i.executionHints.testCommands),
  );
  return fromPlan.length ? fromPlan : ["pnpm test -- implementation", "pnpm build"];
}

function collectForbiddenPaths(workItems: readonly CursorWorkItem[] | null | undefined): readonly string[] {
  const fromWork = uniqueStrings((workItems ?? []).flatMap((w) => w.forbiddenPaths));
  if (fromWork.length) return fromWork;
  return [...COMMON_FORBIDDEN_PATHS];
}

function collectDataEntityCandidates(input: BuildImplementationSlotsInput): readonly string[] {
  const plan = input.implementationTaskPlanV1;
  const fromTasks = (plan?.items ?? []).map((i) => i.title.trim()).filter(Boolean);
  const fromArtifacts = input.projectArtifacts
    .map((a) => String(a.title ?? "").trim())
    .filter(Boolean);
  const merged = uniqueStrings([...fromTasks, ...fromArtifacts]);
  if (merged.length) return merged.slice(0, 12);
  return ["회의", "발화자", "요약", "TODO", "검토상태"];
}

export function evaluateDbIntegrationSlotsReadiness(
  slots: ImplementationSlotsV1 | null | undefined,
): ImplementationSlotsReadiness {
  if (!slots?.slots.length) {
    return {
      ready: false,
      confirmed: 0,
      required: DB_INTEGRATION_GATE_CONFIRMED_KEYS.length,
      missing: [...DB_INTEGRATION_GATE_CONFIRMED_KEYS],
      blocked: [],
      candidate: 0,
      partial: 0,
    };
  }
  const byKey = new Map(slots.slots.map((s) => [s.key, s]));
  const missing: ImplementationSlotKey[] = [];
  const blocked: ImplementationSlotKey[] = [];
  let confirmed = 0;
  let candidate = 0;
  let partial = 0;

  for (const key of DB_INTEGRATION_GATE_CONFIRMED_KEYS) {
    const slot = byKey.get(key);
    if (!slot || slot.status === "empty") missing.push(key);
    else if (slot.status === "blocked") blocked.push(key);
    else if (slot.status === "confirmed") confirmed += 1;
    else missing.push(key);
  }

  for (const s of slots.slots) {
    if (s.status === "candidate") candidate += 1;
    if (s.status === "partial") partial += 1;
  }

  return {
    ready: missing.length === 0 && blocked.length === 0,
    confirmed,
    required: DB_INTEGRATION_GATE_CONFIRMED_KEYS.length,
    missing,
    blocked,
    candidate,
    partial,
  };
}

export function patchImplementationSlotsValues(
  current: ImplementationSlotsV1,
  updates: readonly Readonly<{
    key: ImplementationSlotKey;
    status: ImplementationSlotStatus;
    value: ImplementationSlotValue | null;
    reason?: string;
    source?: readonly string[];
  }>[],
  nowIso?: string,
): ImplementationSlotsV1 {
  const now = nowIso ?? new Date().toISOString();
  const byKey = new Map(current.slots.map((s) => [s.key, s]));
  for (const u of updates) {
    const prev = byKey.get(u.key);
    byKey.set(
      u.key,
      makeSlot(u.key, {
        status: u.status,
        value: u.value,
        source: u.source ?? prev?.source ?? [],
        reason: u.reason ?? prev?.reason ?? "",
        nowIso: now,
      }),
    );
  }
  const bundle: ImplementationSlotsV1 = {
    ...current,
    updatedAt: now,
    slots: [...byKey.values()],
    readiness: { ready: false, confirmed: 0, required: 0, missing: [], blocked: [], candidate: 0, partial: 0 },
  };
  return { ...bundle, readiness: evaluateImplementationSlotsReadiness(bundle) };
}

export function getImplementationSlotValue(
  slots: ImplementationSlotsV1 | null | undefined,
  key: ImplementationSlotKey,
): ImplementationSlotValue | null {
  return slots?.slots.find((s) => s.key === key)?.value ?? null;
}

export function evaluateImplementationSlotsReadiness(
  slots: ImplementationSlotsV1 | null | undefined,
): ImplementationSlotsReadiness {
  if (!slots?.slots.length) {
    return {
      ready: false,
      confirmed: 0,
      required: CONFIRMED_REQUIRED_KEYS.length,
      missing: [...CONFIRMED_REQUIRED_KEYS],
      blocked: [],
      candidate: 0,
      partial: 0,
    };
  }
  const byKey = new Map(slots.slots.map((s) => [s.key, s]));
  const missing: ImplementationSlotKey[] = [];
  const blocked: ImplementationSlotKey[] = [];
  let confirmed = 0;
  let candidate = 0;
  let partial = 0;

  for (const key of CONFIRMED_REQUIRED_KEYS) {
    const slot = byKey.get(key);
    if (!slot || slot.status === "empty") missing.push(key);
    else if (slot.status === "blocked") blocked.push(key);
    else if (slot.status === "confirmed") confirmed += 1;
    else missing.push(key);
  }

  const wipBranch = byKey.get("wip_branch_name");
  const wipBranchOk =
    wipBranch &&
    wipBranch.status !== "empty" &&
    wipBranch.status !== "blocked";
  if (!wipBranchOk) missing.push("wip_branch_name");

  for (const s of slots.slots) {
    if (s.status === "candidate") candidate += 1;
    if (s.status === "partial") partial += 1;
  }

  const ready = missing.length === 0 && blocked.length === 0;
  return {
    ready,
    confirmed,
    required: CONFIRMED_REQUIRED_KEYS.length + 1,
    missing,
    blocked,
    candidate,
    partial,
  };
}

export function buildImplementationSlotsFromContext(input: BuildImplementationSlotsInput): ImplementationSlotsV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const provider = input.codeAgentProvider ?? DEFAULT_CODE_AGENT_PROVIDER;
  const plan = input.implementationTaskPlanV1;
  const workItems = input.cursorWorkItemsV1 ?? [];
  const primaryTaskId = plan?.items[0]?.id ?? "bundle";
  const branchName = buildProviderWipBranchName(provider, input.projectId, primaryTaskId);

  const scopeValue = collectScopeSummary(input);
  const taskTitles = (plan?.items ?? []).map((i) => i.title).filter(Boolean);
  const acceptance = collectAcceptanceCriteria(plan);
  const security = collectSecurityChecks(plan);
  const tests = collectTestCommands(plan, workItems);
  const forbidden = collectForbiddenPaths(workItems);

  const scopeStatus: ImplementationSlotStatus = !input.designOk
    ? "blocked"
    : plan?.items.length
      ? "confirmed"
      : "candidate";

  const tasksStatus: ImplementationSlotStatus =
    !plan?.items.length ? "empty" : plan.items.every((i) => !i.blockers.length) ? "confirmed" : "partial";

  const cursorEnv = input.envCursorBadge ?? (input.envOk ? "ok" : "needs");
  const providerStatus: ImplementationSlotStatus =
    cursorEnv === "ok" ? "confirmed" : cursorEnv === "error" ? "blocked" : "candidate";

  const acceptanceStatus: ImplementationSlotStatus =
    !plan?.items.length
      ? "empty"
      : plan.items.every((i) => i.acceptanceCriteria.length > 0)
        ? "confirmed"
        : acceptance.length
          ? "partial"
          : "candidate";

  const securityStatus: ImplementationSlotStatus =
    !plan?.items.length
      ? "empty"
      : plan.items.every((i) => i.securityChecks.length > 0)
        ? "confirmed"
        : security.length
          ? "partial"
          : "candidate";

  const slots: ImplementationSlot[] = [
    makeSlot("implementation_scope", {
      status: scopeStatus,
      value: scopeValue,
      source: ["implementationTaskPlanV1", "projectArtifacts"],
      reason: scopeStatus === "blocked" ? "기획 산출물·설계 readiness 미완료" : "구현 범위 요약",
      nowIso: now,
    }),
    makeSlot("implementation_tasks", {
      status: tasksStatus,
      value: taskTitles,
      source: ["implementationTaskPlanV1"],
      reason: "task plan 기반",
      nowIso: now,
    }),
    makeSlot("code_agent_provider", {
      status: providerStatus,
      value: provider,
      source: ["execution_setup", "codeAgentProvider"],
      reason:
        providerStatus === "blocked"
          ? "코드 에이전트 연결 오류"
          : providerStatus === "confirmed"
            ? "실행 환경에 provider 설정됨"
            : "provider 후보",
      nowIso: now,
    }),
    makeSlot("wip_policy", {
      status: "confirmed",
      value: [...CODE_AGENT_WIP_POLICY_SLOT_LINES],
      source: ["codeAgentWipExecution"],
      reason: "Code Agent WIP 공통 정책",
      nowIso: now,
    }),
    makeSlot("wip_branch_name", {
      status: plan?.items.length ? "candidate" : "empty",
      value: branchName,
      source: ["implementationTaskPlanV1", "codeAgentProvider"],
      reason: "WIP branch 명명 규칙",
      nowIso: now,
    }),
    makeSlot("acceptance_criteria", {
      status: acceptanceStatus,
      value: acceptance,
      source: ["implementationTaskPlanV1"],
      reason: "AI검수자 검수 기준",
      nowIso: now,
    }),
    makeSlot("security_checks", {
      status: securityStatus,
      value: security,
      source: ["implementationTaskPlanV1"],
      reason: "AI보안관 보안 기준",
      nowIso: now,
    }),
    makeSlot("test_commands", {
      status: tests.length ? "confirmed" : "empty",
      value: tests,
      source: ["cursorWorkItemsV1", "executionHints"],
      reason: "실행할 테스트 명령",
      nowIso: now,
    }),
    makeSlot("forbidden_paths", {
      status: "confirmed",
      value: forbidden,
      source: ["executionHints", "cursorWorkItemsV1"],
      reason: "수정 금지 경로",
      nowIso: now,
    }),
    makeSlot("developer_review_required", {
      status: "confirmed",
      value: true,
      source: ["codeAgentWipExecution"],
      reason: "WIP 결과는 AI개발자 검토 필수",
      nowIso: now,
    }),
    makeSlot("official_commit_owner", {
      status: "confirmed",
      value: "SCM",
      source: ["implementation_policy"],
      reason: "공식 Git 반영은 SCM 담당",
      nowIso: now,
    }),
    makeSlot("pr_required", {
      status: "confirmed",
      value: true,
      source: ["implementation_policy"],
      reason: "공식 반영 시 PR 필요",
      nowIso: now,
    }),
    makeSlot("data_persistence_mode", {
      status: "confirmed",
      value: "blocked_database_required",
      source: ["implementation_db_strategy"],
      reason: "PostgreSQL 샘플 DB 설정 완료 후 구현 진행",
      nowIso: now,
    }),
    makeSlot("db_required", {
      status: "confirmed",
      value: true,
      source: ["implementation_db_strategy"],
      reason: "구현단계는 PostgreSQL 샘플 DB 필수",
      nowIso: now,
    }),
    makeSlot("db_trigger_condition", {
      status: "candidate",
      value: "사용자 검토 후 저장·조회·CRUD 검증이 필요할 때",
      source: ["implementation_db_strategy"],
      reason: "DB 전환 Gate 조건",
      nowIso: now,
    }),
    makeSlot("data_entities", {
      status: "candidate",
      value: collectDataEntityCandidates(input),
      source: ["implementationTaskPlanV1", "projectArtifacts"],
      reason: "저장 대상 엔티티 후보",
      nowIso: now,
    }),
    makeSlot("storage_strategy", {
      status: "confirmed",
      value: "PostgreSQL database setup required before implementation",
      source: ["implementation_db_strategy"],
      reason: "DB READY handoff 시 PostgreSQL sample DB + Platform Runtime API",
      nowIso: now,
    }),
    makeSlot("migration_required", {
      status: "confirmed",
      value: false,
      source: ["implementation_db_strategy"],
      reason: "DB 설정 완료 전에는 migration을 생성하지 않습니다.",
      nowIso: now,
    }),
    makeSlot("data_security_level", {
      status: "partial",
      value: "개인정보·민감정보 가능성 검토 필요",
      source: ["implementationTaskPlanV1", "projectArtifacts"],
      reason: "DB 전환 전 보안 기준 후보",
      nowIso: now,
    }),
    makeSlot("backup_retention_policy", {
      status: "candidate",
      value: "운영 전환 전 별도 정의",
      source: ["implementation_db_strategy"],
      reason: "백업·보존은 운영 Gate에서 확정",
      nowIso: now,
    }),
    makeSlot("db_owner", {
      status: "confirmed",
      value: "SCM",
      source: ["implementation_policy"],
      reason: "DB 설정·migration·운영 반영",
      nowIso: now,
    }),
  ];

  const bundle: ImplementationSlotsV1 = {
    version: IMPLEMENTATION_SLOTS_VERSION,
    projectId: input.projectId.trim(),
    mode: "implementation",
    createdAt: now,
    updatedAt: now,
    slots,
    readiness: { ready: false, confirmed: 0, required: 0, missing: [], blocked: [], candidate: 0, partial: 0 },
  };
  const withReadiness = { ...bundle, readiness: evaluateImplementationSlotsReadiness(bundle) };
  const handoff = input.planningHandoffForImplementationV1;
  if (!handoff?.implementationDefaults) return withReadiness;
  const overrides = implementationDbSlotOverridesForPlanningPersistence(
    handoff.implementationDefaults.dataPersistenceMode,
  );
  const patchedSlots = withReadiness.slots.map((slot) => {
    if (slot.key === "data_persistence_mode") {
      return { ...slot, value: overrides.data_persistence_mode, reason: "기획 handoff 데이터 저장소 정책" };
    }
    if (slot.key === "db_required") {
      return { ...slot, value: overrides.db_required, reason: "기획 handoff 데이터 저장소 정책" };
    }
    if (slot.key === "storage_strategy") {
      return { ...slot, value: overrides.storage_strategy, reason: "기획 handoff 데이터 저장소 정책" };
    }
    if (slot.key === "migration_required") {
      return { ...slot, value: overrides.migration_required, reason: "기획 handoff 데이터 저장소 정책" };
    }
    return slot;
  });
  const nextBundle = { ...withReadiness, slots: patchedSlots, updatedAt: now };
  return { ...nextBundle, readiness: evaluateImplementationSlotsReadiness(nextBundle) };
}

export function patchImplementationSlots(input: {
  readonly current: ImplementationSlotsV1 | null | undefined;
  readonly patch: BuildImplementationSlotsInput;
}): ImplementationSlotsV1 {
  const next = buildImplementationSlotsFromContext(input.patch);
  if (!input.current) return next;
  return { ...next, createdAt: input.current.createdAt };
}

export function formatImplementationSlotsReadinessSummary(slots: ImplementationSlotsV1 | null | undefined): string {
  const r = slots ? slots.readiness : evaluateImplementationSlotsReadiness(slots);
  const lines = [
    "구현 슬롯 준비 상태:",
    `- 확정: ${r.confirmed} / ${r.required}`,
    `- 후보: ${r.candidate}`,
    `- 차단: ${r.blocked.length}`,
  ];
  if (r.missing.length || r.blocked.length) {
    lines.push("", "부족·차단 항목:");
    for (const key of [...r.blocked, ...r.missing]) {
      const slot = slots?.slots.find((s) => s.key === key);
      lines.push(`- ${implementationSlotLabel(key)}${slot?.reason ? ` (${slot.reason})` : ""}`);
    }
  }
  return lines.join("\n");
}

export function formatImplementationSlotsBlockedMessage(
  slots: ImplementationSlotsV1 | null | undefined,
): readonly string[] {
  const r = evaluateImplementationSlotsReadiness(slots);
  if (r.ready) return [];
  return [
    ...r.blocked.map((k) => `구현 슬롯(차단): ${implementationSlotLabel(k)}`),
    ...r.missing.map((k) => `구현 슬롯(미확정): ${implementationSlotLabel(k)}`),
  ];
}

export function buildImplementationDbSlotsTimelineEntry(input: {
  readonly slots: ImplementationSlotsV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const mode = String(getImplementationSlotValue(input.slots, "data_persistence_mode") ?? "mock");
  const dbRequired = getImplementationSlotValue(input.slots, "db_required") === true;
  const entities = getImplementationSlotValue(input.slots, "data_entities");
  const dataEntityCount = Array.isArray(entities) ? entities.length : 0;
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_db_slots_built",
    source: "system",
    responseText: [
      "type=implementation_db_slots_built",
      "mode=implementation",
      `dataPersistenceMode=${mode}`,
      `dbRequired=${dbRequired}`,
      `dataEntityCount=${dataEntityCount}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationSlotsTimelineEntry(input: {
  readonly slots: ImplementationSlotsV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const r = input.slots.readiness;
  const owners = [...new Set(input.slots.slots.map((s) => s.owner))].join(",");
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_slots_built",
    source: "system",
    responseText: [
      "type=implementation_slots_built",
      "mode=implementation",
      `confirmed=${r.confirmed}`,
      `required=${r.required}`,
      `missing=${r.missing.join("|") || "none"}`,
      `blocked=${r.blocked.join("|") || "none"}`,
      `owners=${owners}`,
      `ready=${r.ready}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function parseImplementationSlotsV1(raw: unknown): ImplementationSlotsV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_SLOTS_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? o.createdAt ?? "").trim();
  if (!createdAt) return null;

  const slotsRaw = Array.isArray(o.slots) ? o.slots : [];
  const slots: ImplementationSlot[] = [];
  for (const row of slotsRaw) {
    if (!row || typeof row !== "object") continue;
    const s = row as Record<string, unknown>;
    const key = String(s.key ?? "").trim() as ImplementationSlotKey;
    if (!(key in IMPLEMENTATION_SLOT_META)) continue;
    const status = String(s.status ?? "empty").trim() as ImplementationSlotStatus;
    const validStatus = ["empty", "candidate", "partial", "confirmed", "blocked"].includes(status)
      ? status
      : "empty";
    slots.push(
      makeSlot(key, {
        status: validStatus,
        value: parseSlotValue(s.value),
        confidence: Number(s.confidence ?? 0.7),
        source: Array.isArray(s.source) ? s.source.map(String) : [],
        reason: String(s.reason ?? ""),
        nowIso: String(s.updatedAt ?? updatedAt),
      }),
    );
  }
  if (!slots.length) return null;

  const bundle: ImplementationSlotsV1 = {
    version: IMPLEMENTATION_SLOTS_VERSION,
    projectId,
    mode: "implementation",
    createdAt,
    updatedAt,
    slots,
    readiness: evaluateImplementationSlotsReadiness({
      version: IMPLEMENTATION_SLOTS_VERSION,
      projectId,
      mode: "implementation",
      createdAt,
      updatedAt,
      slots,
      readiness: { ready: false, confirmed: 0, required: 0, missing: [], blocked: [], candidate: 0, partial: 0 },
    }),
  };
  return { ...bundle, readiness: evaluateImplementationSlotsReadiness(bundle) };
}

function parseSlotValue(raw: unknown): ImplementationSlotValue | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "object") return raw as Readonly<Record<string, unknown>>;
  return String(raw);
}
