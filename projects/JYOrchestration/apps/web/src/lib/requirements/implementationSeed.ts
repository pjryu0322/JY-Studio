import type { SelectedPrototypeTemplateV1 } from "@/lib/requirements/implementationPrototypeTemplateContext";
import { findOrchestrationSlotKeysBySuffix, findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export const IMPLEMENTATION_SEED_VERSION = "implementation_seed_v1" as const;

export type ImplementationSeedLifecycleStatus = "candidate" | "partial" | "confirmed";

export type ImplementationSeedGapKey =
  | "actor_function_matrix"
  | "actor_permission_matrix"
  | "process_actor_map"
  | "process_screen_map"
  | "screen_actor_matrix"
  | "screen_action_matrix"
  | "screen_data_map"
  | "common_detail_features"
  | "data_entities"
  | "state_model"
  | "mock_data_strategy";

export const IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS: readonly ImplementationSeedGapKey[] = [
  "actor_function_matrix",
  "screen_action_matrix",
  "process_screen_map",
  "common_detail_features",
  "data_entities",
] as const;

export const IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS: readonly ImplementationSeedGapKey[] = [
  "actor_permission_matrix",
  "screen_actor_matrix",
  "screen_data_map",
  "state_model",
  "mock_data_strategy",
  "process_actor_map",
] as const;

/** Gate evaluation용 suffix — `buildDynamicServicePlanningSlotDefinitions` 키와 대응 */
export const IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP: Readonly<Record<ImplementationSeedGapKey, string>> = {
  actor_function_matrix: ".flow.actorFunctionMatrix",
  actor_permission_matrix: ".flow.actorPermissionMatrix",
  process_actor_map: ".flow.processActorMap",
  process_screen_map: ".flow.processScreenMap",
  screen_actor_matrix: ".design.screenActorMatrix",
  screen_action_matrix: ".design.screenActionMatrix",
  screen_data_map: ".design.screenDataMap",
  common_detail_features: ".design.commonDetailFeatures",
  data_entities: ".design.dataEntities",
  state_model: ".design.stateModel",
  mock_data_strategy: ".design.mockDataStrategy",
};

export const PRODUCT_LEVEL_IMPLEMENTATION_SEED_SLOT_SUFFIXES: readonly string[] = [
  ...Object.values(IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP),
  ".design.implementationSeedSummary",
];

export const IMPLEMENTATION_SEED_GAP_LABELS: Readonly<Record<ImplementationSeedGapKey, string>> = {
  actor_function_matrix: "액터별 기능 매핑",
  actor_permission_matrix: "액터별 권한/제약",
  process_actor_map: "프로세스별 참여 액터",
  process_screen_map: "프로세스-화면 연결",
  screen_actor_matrix: "화면별 접근 액터",
  screen_action_matrix: "화면별 기능/버튼",
  screen_data_map: "화면별 데이터 표시/입력",
  common_detail_features: "공통 상세기능",
  data_entities: "데이터 엔티티 후보",
  state_model: "상태 모델",
  mock_data_strategy: "Mock 데이터 전략",
};

export type ProcessImplementationItem = Readonly<{
  readonly id: string;
  readonly processName: string;
  readonly actors: readonly string[];
  readonly screens: readonly string[];
  readonly actions: readonly string[];
  readonly dataTouched: readonly string[];
  readonly exceptions: readonly string[];
}>;

export type ScreenImplementationItem = Readonly<{
  readonly id: string;
  readonly screenName: string;
  readonly accessibleActors: readonly string[];
  readonly actions: readonly string[];
  readonly visibleData: readonly string[];
  readonly editableData: readonly string[];
  readonly states: readonly string[];
}>;

export type ActorCapabilityRow = Readonly<{
  readonly actor: string;
  readonly capabilities: readonly string[];
  readonly restrictions: readonly string[];
  readonly screens: readonly string[];
  readonly dataAccess: readonly string[];
}>;

export type CommonDetailFeature = Readonly<{
  readonly name: string;
  readonly appliesTo: readonly string[];
  readonly description: string;
  readonly required: boolean;
}>;

export type DataModelSeed = Readonly<{
  readonly entities: readonly string[];
  readonly fieldsByEntity: Readonly<Record<string, readonly string[]>>;
  readonly relationships: readonly string[];
  readonly mockDataNotes: readonly string[];
}>;

export type ImplementationSeedGap = Readonly<{
  readonly key: ImplementationSeedGapKey;
  readonly label: string;
  readonly severity: "blocking" | "warning";
  readonly reason: string;
  readonly suggestedAction: string;
}>;

export type ImplementationSeedReadiness = Readonly<{
  readonly ready: boolean;
  readonly score: number;
  readonly missing: readonly ImplementationSeedGapKey[];
  readonly warnings: readonly string[];
}>;

export type ImplementationSeedV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_SEED_VERSION;
  readonly projectId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly source: "planning_slots_and_artifacts";
  readonly lifecycleStatus: ImplementationSeedLifecycleStatus;
  readonly readiness: ImplementationSeedReadiness;
  readonly processImplementationItems: readonly ProcessImplementationItem[];
  readonly screenImplementationItems: readonly ScreenImplementationItem[];
  readonly actorCapabilityMatrix: readonly ActorCapabilityRow[];
  readonly commonDetailFeatures: readonly CommonDetailFeature[];
  readonly dataModelSeed: DataModelSeed;
  readonly assumptions: readonly string[];
  readonly gaps: readonly ImplementationSeedGap[];
  readonly templateContext?: SelectedPrototypeTemplateV1;
}>;

export type BuildImplementationSeedInput = Readonly<{
  readonly projectId: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly lifecycleStatus?: ImplementationSeedLifecycleStatus;
  readonly nowIso?: string;
}>;

export type SlotFillLevel = "empty" | "candidate" | "confirmed";

export type ImplementationSeedSlotSnapshot = Readonly<{
  readonly gapKey: ImplementationSeedGapKey;
  readonly slotKey: string | null;
  readonly fill: SlotFillLevel;
  readonly value: string;
}>;

function slugId(prefix: string, text: string, index: number): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${prefix}-${base || index}-${index}`;
}

export function parseBulletLines(text: string): readonly string[] {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:\d+[\).\]]|[-*•])\s*(.+)$/);
    out.push((m?.[1] ?? line).trim());
  }
  return [...new Set(out)].filter((l) => l.length >= 2);
}

export function parseActorCapabilityLines(text: string): readonly ActorCapabilityRow[] {
  const lines = parseBulletLines(text);
  const rows: ActorCapabilityRow[] = [];
  for (const line of lines) {
    const parts = line.split(/[:：]/);
    const actor = (parts[0] ?? line).trim();
    const rest = (parts.slice(1).join(":") || "").trim();
    const capabilities = rest
      ? rest.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
      : [line];
    rows.push({
      actor,
      capabilities,
      restrictions: [],
      screens: [],
      dataAccess: [],
    });
  }
  return rows;
}

export function parseProcessScreenPairs(text: string): readonly ProcessImplementationItem[] {
  const lines = parseBulletLines(text);
  return lines.map((line, i) => {
    const arrow = line.split(/→|->|=>/);
    const processName = (arrow[0] ?? line).trim();
    const screen = (arrow[1] ?? "").trim();
    return {
      id: slugId("proc", processName, i),
      processName,
      actors: [],
      screens: screen ? [screen] : [],
      actions: [],
      dataTouched: [],
      exceptions: [],
    };
  });
}

export function parseScreenMatrixLines(text: string): readonly ScreenImplementationItem[] {
  const lines = parseBulletLines(text);
  return lines.map((line, i) => {
    const parts = line.split(/[:：]/);
    const screenName = (parts[0] ?? line).trim();
    const rest = (parts.slice(1).join(":") || "").trim();
    const tokens = rest
      ? rest.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
      : [];
    return {
      id: slugId("screen", screenName, i),
      screenName,
      accessibleActors: tokens,
      actions: [],
      visibleData: [],
      editableData: [],
      states: [],
    };
  });
}

export function parseScreenActionLines(text: string): readonly ScreenImplementationItem[] {
  const lines = parseBulletLines(text);
  return lines.map((line, i) => {
    const parts = line.split(/[:：]/);
    const screenName = (parts[0] ?? line).trim();
    const rest = (parts.slice(1).join(":") || "").trim();
    const actions = rest
      ? rest.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
      : parseBulletLines(line);
    return {
      id: slugId("screen-act", screenName, i),
      screenName,
      accessibleActors: [],
      actions,
      visibleData: [],
      editableData: [],
      states: [],
    };
  });
}

function mergeScreenItems(
  base: readonly ScreenImplementationItem[],
  extra: readonly ScreenImplementationItem[],
): readonly ScreenImplementationItem[] {
  const byName = new Map<string, ScreenImplementationItem>();
  for (const row of [...base, ...extra]) {
    const key = row.screenName.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, row);
      continue;
    }
    byName.set(key, {
      ...prev,
      accessibleActors: [...new Set([...prev.accessibleActors, ...row.accessibleActors])],
      actions: [...new Set([...prev.actions, ...row.actions])],
      visibleData: [...new Set([...prev.visibleData, ...row.visibleData])],
      editableData: [...new Set([...prev.editableData, ...row.editableData])],
      states: [...new Set([...prev.states, ...row.states])],
    });
  }
  return [...byName.values()];
}

export function resolveImplementationSeedSlotSnapshots(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): readonly ImplementationSeedSlotSnapshot[] {
  const out: ImplementationSeedSlotSnapshot[] = [];
  for (const gapKey of [
    ...IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS,
    ...IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS,
  ] as ImplementationSeedGapKey[]) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0] ?? null;
    const row = slotKey ? findSlotRow(input.orchestration, slotKey) : null;
    const status = normalizeSlotStatus(String(row?.status ?? "empty"));
    const value = String(row?.value ?? "").trim();
    let fill: SlotFillLevel = "empty";
    if (status === "confirmed" && value.length >= 4) fill = "confirmed";
    else if ((status === "candidate" || status === "partial") && value.length >= 4) fill = "candidate";
    out.push({ gapKey, slotKey, fill, value });
  }
  return out;
}

export function evaluateImplementationSeedReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): ImplementationSeedReadiness {
  const snapshots = resolveImplementationSeedSlotSnapshots(input);
  const missing: ImplementationSeedGapKey[] = [];
  const warnings: string[] = [];
  let requiredScore = 0;
  let recommendedScore = 0;

  for (const snap of snapshots) {
    const required = (IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS as readonly string[]).includes(snap.gapKey);
    const weight = required ? 0.15 : 0.05;
    if (snap.fill === "confirmed") {
      if (required) requiredScore += weight;
      else recommendedScore += weight;
    } else if (snap.fill === "candidate") {
      if (required) requiredScore += weight * 0.45;
      else recommendedScore += weight * 0.45;
      if (required) warnings.push(`${IMPLEMENTATION_SEED_GAP_LABELS[snap.gapKey]}: 후보(candidate) — 확정 필요`);
    } else if (required) {
      missing.push(snap.gapKey);
    } else {
      warnings.push(`${IMPLEMENTATION_SEED_GAP_LABELS[snap.gapKey]}: 미입력(권장)`);
    }
  }

  const score = Math.min(1, Math.round((requiredScore + recommendedScore) * 1000) / 1000);
  const ready = missing.length === 0 && score >= 0.75;
  return { ready, score, missing, warnings };
}

function buildGapsFromSnapshots(snapshots: readonly ImplementationSeedSlotSnapshot[]): readonly ImplementationSeedGap[] {
  const gaps: ImplementationSeedGap[] = [];
  for (const snap of snapshots) {
    if (snap.fill !== "empty") continue;
    const required = (IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS as readonly string[]).includes(snap.gapKey);
    gaps.push({
      key: snap.gapKey,
      label: IMPLEMENTATION_SEED_GAP_LABELS[snap.gapKey],
      severity: required ? "blocking" : "warning",
      reason: required ? "필수 슬롯이 비어 있습니다." : "권장 슬롯이 비어 있습니다.",
      suggestedAction: "AI팀이 구현 Seed 후보 생성 또는 부족한 기획정보 보완을 진행해 주세요.",
    });
  }
  return gaps;
}

export function buildImplementationSeedFromPlanning(
  input: BuildImplementationSeedInput,
): ImplementationSeedV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const snapshots = resolveImplementationSeedSlotSnapshots(input);
  const values = Object.fromEntries(snapshots.map((s) => [s.gapKey, s.value])) as Record<
    ImplementationSeedGapKey,
    string
  >;

  const actorCapabilityMatrix = [
    ...parseActorCapabilityLines(values.actor_function_matrix ?? ""),
    ...parseActorCapabilityLines(values.actor_permission_matrix ?? "").map((r) => ({
      ...r,
      restrictions: r.capabilities,
      capabilities: [],
    })),
  ];

  const processImplementationItems = parseProcessScreenPairs(values.process_screen_map ?? "");
  const screenFromActors = parseScreenMatrixLines(values.screen_actor_matrix ?? "");
  const screenFromActions = parseScreenActionLines(values.screen_action_matrix ?? "");
  const screenFromData = parseScreenMatrixLines(values.screen_data_map ?? "").map((s) => ({
    ...s,
    visibleData: s.accessibleActors,
    accessibleActors: [],
  }));
  const screenImplementationItems = mergeScreenItems(
    mergeScreenItems(screenFromActors, screenFromActions),
    screenFromData,
  );

  const commonDetailFeatures = parseBulletLines(values.common_detail_features ?? "").map((name) => ({
    name,
    appliesTo: ["전체 화면"],
    description: name,
    required: true,
  }));

  const entities = parseBulletLines(values.data_entities ?? "");
  const dataModelSeed: DataModelSeed = {
    entities,
    fieldsByEntity: Object.fromEntries(entities.map((e) => [e, [] as readonly string[]])),
    relationships: [],
    mockDataNotes: parseBulletLines(values.mock_data_strategy ?? ""),
  };

  const readiness = evaluateImplementationSeedReadiness(input);
  const gaps = buildGapsFromSnapshots(snapshots);
  const assumptions: string[] = [];
  if (readiness.warnings.length) {
    assumptions.push("일부 항목은 candidate·권장 슬롯 기반으로 추론되었습니다.");
  }

  const lifecycleStatus =
    input.lifecycleStatus ??
    (readiness.ready ? "confirmed" : snapshots.some((s) => s.fill === "candidate") ? "partial" : "candidate");

  return {
    version: IMPLEMENTATION_SEED_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    source: "planning_slots_and_artifacts",
    lifecycleStatus,
    readiness,
    processImplementationItems,
    screenImplementationItems,
    actorCapabilityMatrix,
    commonDetailFeatures,
    dataModelSeed,
    assumptions,
    gaps,
  };
}

export function buildImplementationScopeFromSeed(seed: ImplementationSeedV1): readonly string[] {
  const lines: string[] = [];
  for (const p of seed.processImplementationItems) {
    const screen = p.screens[0];
    lines.push(screen ? `${p.processName} → ${screen} 흐름 구현` : `${p.processName} 프로세스 구현`);
  }
  for (const s of seed.screenImplementationItems) {
    if (s.actions.length) {
      lines.push(`${s.screenName}: ${s.actions.slice(0, 3).join(", ")}`);
    } else if (s.accessibleActors.length) {
      lines.push(`${s.screenName} (${s.accessibleActors.join(", ")} 접근)`);
    }
  }
  for (const c of seed.commonDetailFeatures.slice(0, 4)) {
    lines.push(`공통: ${c.name}`);
  }
  if (seed.dataModelSeed.entities.length) {
    lines.push(`데이터: ${seed.dataModelSeed.entities.slice(0, 4).join(", ")} 엔티티 Mock/로컬 처리`);
  }
  return [...new Set(lines)].filter(Boolean).slice(0, 12);
}

const CANDIDATE_TEMPLATES: Readonly<Record<ImplementationSeedGapKey, (ctx: { readonly projectName: string }) => string>> = {
  actor_function_matrix: () =>
    [
      "사용자: 핵심 업무 수행, 결과 확인, 수정·다운로드",
      "검수자: 검토·의견·승인",
      "관리자: 설정·이력·사용자 관리",
      "시스템: 자동 처리·알림·상태 전이",
    ].join("\n"),
  actor_permission_matrix: () =>
    [
      "사용자: 본인 데이터만 조회·수정",
      "검수자: 검토 대상 조회·의견 작성",
      "관리자: 전체 조회·정책 설정",
    ].join("\n"),
  process_actor_map: () =>
    ["업로드: 사용자", "처리: 시스템", "검토: 검수자", "완료: 사용자·관리자"].join("\n"),
  process_screen_map: () =>
    [
      "시작 → 시작/안내 화면",
      "업무 입력 → 입력 화면",
      "처리 중 → 진행 상태 화면",
      "결과 확인 → 결과 화면",
    ].join("\n"),
  screen_actor_matrix: () =>
    ["입력 화면: 사용자", "결과 화면: 사용자, 검수자", "관리 화면: 관리자"].join("\n"),
  screen_action_matrix: () =>
    [
      "입력 화면: 저장, 실행, 취소",
      "결과 화면: 수정, 다운로드, 공유",
      "관리 화면: 검색, 필터, 상세 보기",
    ].join("\n"),
  screen_data_map: () =>
    ["입력 화면: 입력 필드, 유효성", "결과 화면: 요약, 상세, 메타데이터"].join("\n"),
  common_detail_features: () =>
    [
      "로딩 상태",
      "오류 메시지",
      "빈 결과",
      "재시도",
      "권한 없음 안내",
      "임시 저장",
    ].join("\n"),
  data_entities: () => ["사용자", "작업 요청", "처리 결과", "검토 의견", "처리 이력"].join("\n"),
  state_model: () =>
    ["idle", "processing", "completed", "failed", "review_requested", "approved"].join("\n"),
  mock_data_strategy: () =>
    "초기에는 Local State + JSON Mock. API 연동 전까지 시드 데이터 3~5건 유지.",
};

export function buildImplementationSeedCandidateSlotPatches(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly projectName?: string;
  readonly nowIso?: string;
}): Readonly<{
  readonly slots: RequirementsSingleChatOrchestrationStateV1["slots"];
  readonly touchedGapKeys: readonly ImplementationSeedGapKey[];
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const base = { ...(input.orchestration?.slots ?? {}) };
  const snapshots = resolveImplementationSeedSlotSnapshots({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  const touched: ImplementationSeedGapKey[] = [];
  const ctx = { projectName: input.projectName ?? "서비스" };

  for (const snap of snapshots) {
    if (snap.fill !== "empty" || !snap.slotKey) continue;
    const template = CANDIDATE_TEMPLATES[snap.gapKey]?.(ctx);
    if (!template) continue;
    const row = base[snap.slotKey];
    if (!row) continue;
    base[snap.slotKey] = {
      ...row,
      status: "candidate",
      value: template,
      updatedAt: now,
      staleReason: "implementation_seed_candidate",
    };
    touched.push(snap.gapKey);
  }

  return { slots: base, touchedGapKeys: touched };
}

const GENERIC_SCREEN_ONLY_LINE = /^(입력 화면|결과 화면|시작 화면|관리 화면|진행 상태 화면|안내 화면)$/i;

const MAPPING_IMPLEMENTATION_SEED_GAP_KEYS: ReadonlySet<ImplementationSeedGapKey> = new Set([
  "actor_function_matrix",
  "actor_permission_matrix",
  "process_actor_map",
  "process_screen_map",
  "screen_actor_matrix",
  "screen_action_matrix",
  "screen_data_map",
]);

export function hasMeaningfulImplementationSeedValue(
  gapKey: ImplementationSeedGapKey,
  value: string,
): boolean {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < 10) return false;

  const lines = parseBulletLines(trimmed);
  if (!lines.length) return false;

  if (lines.length === 1 && GENERIC_SCREEN_ONLY_LINE.test(lines[0] ?? "")) return false;

  if (MAPPING_IMPLEMENTATION_SEED_GAP_KEYS.has(gapKey)) {
    if (lines.length >= 2) return true;
    return /[:：→]|->|=>/.test(trimmed);
  }

  if (lines.length >= 2) return true;
  return trimmed.length >= 16;
}

export type ImplementationSeedAutoConfirmEligibility = Readonly<{
  readonly eligible: boolean;
  readonly requiredReadyGapKeys: readonly ImplementationSeedGapKey[];
  readonly failedGapKeys: readonly ImplementationSeedGapKey[];
  readonly reason: string | null;
}>;

export function evaluateImplementationSeedAutoConfirmEligibility(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): ImplementationSeedAutoConfirmEligibility {
  const snapshots = resolveImplementationSeedSlotSnapshots(input);
  const requiredReady: ImplementationSeedGapKey[] = [];
  const failed: ImplementationSeedGapKey[] = [];

  for (const gapKey of IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS) {
    const snap = snapshots.find((s) => s.gapKey === gapKey);
    const value = String(snap?.value ?? "").trim();
    if (!value || !hasMeaningfulImplementationSeedValue(gapKey, value)) {
      failed.push(gapKey);
    } else {
      requiredReady.push(gapKey);
    }
  }

  const eligible = requiredReady.length === IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS.length;
  const reason = eligible
    ? null
    : `필수 ${failed.length}개 항목이 품질 기준을 충족하지 못했습니다: ${failed
        .map((k) => IMPLEMENTATION_SEED_GAP_LABELS[k])
        .join(", ")}`;

  return {
    eligible,
    requiredReadyGapKeys: requiredReady,
    failedGapKeys: failed,
    reason,
  };
}

export function promoteImplementationSeedRequiredSlotsToConfirmed(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso?: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const eligibility = evaluateImplementationSeedAutoConfirmEligibility({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  if (!eligibility.eligible) {
    return input.orchestration;
  }

  const slots = { ...input.orchestration.slots };
  for (const gapKey of eligibility.requiredReadyGapKeys) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0];
    if (!slotKey) continue;
    const row = slots[slotKey];
    if (!row) continue;
    const value = String(row.value ?? "").trim();
    slots[slotKey] = {
      ...row,
      status: "confirmed",
      value,
      updatedAt: now,
      staleReason: "implementation_seed_auto_confirmed",
    };
  }

  return { ...input.orchestration, slots, updatedAt: now };
}

export const IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_CHIP = "Seed 후보 확인/확정";

export type ImplementationSeedStatusSummary = Readonly<{
  readonly requiredTotal: number;
  readonly requiredConfirmed: number;
  readonly requiredCandidate: number;
  readonly requiredEmpty: number;
  readonly recommendedTotal: number;
  readonly recommendedConfirmed: number;
  readonly recommendedCandidate: number;
  readonly recommendedEmpty: number;
  readonly lifecycleStatus: ImplementationSeedLifecycleStatus;
  readonly readinessScore: number;
  readonly ready: boolean;
  readonly missingRequiredLabels: readonly string[];
  readonly warningLabels: readonly string[];
}>;

function countGapFills(
  snapshots: readonly ImplementationSeedSlotSnapshot[],
  keys: readonly ImplementationSeedGapKey[],
  fill: SlotFillLevel,
): number {
  const keySet = new Set(keys);
  return snapshots.filter((s) => keySet.has(s.gapKey) && s.fill === fill).length;
}

function deriveLifecycleStatusFromSnapshots(
  snapshots: readonly ImplementationSeedSlotSnapshot[],
  explicit?: ImplementationSeedLifecycleStatus,
): ImplementationSeedLifecycleStatus {
  if (explicit === "confirmed" || explicit === "partial" || explicit === "candidate") {
    return explicit;
  }
  const requiredSnaps = snapshots.filter((s) =>
    (IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS as readonly string[]).includes(s.gapKey),
  );
  if (requiredSnaps.every((s) => s.fill === "confirmed")) return "confirmed";
  if (requiredSnaps.some((s) => s.fill === "candidate")) return "candidate";
  if (requiredSnaps.some((s) => s.fill === "confirmed")) return "partial";
  return "candidate";
}

export function summarizeImplementationSeedStatus(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly lifecycleStatus?: ImplementationSeedLifecycleStatus;
}): ImplementationSeedStatusSummary {
  const snapshots = resolveImplementationSeedSlotSnapshots(input);
  const readiness = evaluateImplementationSeedReadiness(input);
  const lifecycleStatus = deriveLifecycleStatusFromSnapshots(snapshots, input.lifecycleStatus);

  const missingRequiredLabels = readiness.missing.map((k) => IMPLEMENTATION_SEED_GAP_LABELS[k]);
  const warningLabels = [
    ...readiness.warnings,
    ...snapshots
      .filter(
        (s) =>
          (IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS as readonly string[]).includes(s.gapKey) &&
          s.fill === "candidate",
      )
      .map((s) => `${IMPLEMENTATION_SEED_GAP_LABELS[s.gapKey]}: 후보 — 확정 필요`),
  ];

  return {
    requiredTotal: IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS.length,
    requiredConfirmed: countGapFills(snapshots, IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS, "confirmed"),
    requiredCandidate: countGapFills(snapshots, IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS, "candidate"),
    requiredEmpty: countGapFills(snapshots, IMPLEMENTATION_SEED_REQUIRED_GAP_KEYS, "empty"),
    recommendedTotal: IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS.length,
    recommendedConfirmed: countGapFills(snapshots, IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS, "confirmed"),
    recommendedCandidate: countGapFills(snapshots, IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS, "candidate"),
    recommendedEmpty: countGapFills(snapshots, IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS, "empty"),
    lifecycleStatus,
    readinessScore: readiness.score,
    ready: readiness.ready,
    missingRequiredLabels,
    warningLabels,
  };
}

export function formatImplementationSeedLifecycleUserLabel(
  status: ImplementationSeedLifecycleStatus,
): string {
  if (status === "confirmed") return "확정";
  if (status === "partial") return "부분";
  return "후보";
}

export type ImplementationSeedEnvStatusLines = Readonly<{
  readonly validateOk: boolean;
  readonly connectionTestOk: boolean;
}>;

export function resolveImplementationSeedEnvStatusLines(input: {
  readonly envOk: boolean;
  readonly env?: Readonly<{
    readonly git: string;
    readonly github: string;
    readonly cursor: string;
    readonly connectionTest: string;
  }>;
}): ImplementationSeedEnvStatusLines {
  if (input.env) {
    const validateOk =
      input.env.git === "ok" && input.env.github === "ok" && input.env.cursor === "ok";
    const connectionTestOk = input.env.connectionTest === "ok";
    return { validateOk, connectionTestOk };
  }
  return { validateOk: input.envOk, connectionTestOk: input.envOk };
}

export function formatImplementationSeedStatusSummaryLines(input: {
  readonly summary: ImplementationSeedStatusSummary;
  readonly referenceArtifactCount: number;
  readonly envOk: boolean;
  readonly env?: Readonly<{
    readonly git: string;
    readonly github: string;
    readonly cursor: string;
    readonly connectionTest: string;
  }>;
}): readonly string[] {
  const { summary } = input;
  const pct = Math.round(summary.readinessScore * 100);
  const envLines = resolveImplementationSeedEnvStatusLines({ envOk: input.envOk, env: input.env });
  const validateLine = envLines.validateOk ? "완료" : "미완료";
  const connectionLine = envLines.connectionTestOk ? "완료" : "미완료";
  const nextTasks: string[] = [];
  if (!summary.ready) {
    nextTasks.push("Seed 후보 확인/확정");
    if (summary.requiredEmpty > 0 || summary.requiredCandidate > 0) {
      nextTasks.push("구현 준비도 점검");
    }
  }
  if (!envLines.validateOk) nextTasks.push("환경 검증 완료");
  if (!envLines.connectionTestOk) nextTasks.push("연결 테스트 완료");
  if (summary.ready && input.envOk) nextTasks.push("구현 작업안 초안 생성");

  return [
    "기획 산출물 기준 구현 준비 상태",
    "",
    `참조 산출물: ${input.referenceArtifactCount}개`,
    `Implementation Seed: ${formatImplementationSeedLifecycleUserLabel(summary.lifecycleStatus)}`,
    `Seed 준비도: ${pct}%`,
    `필수 Seed 항목: ${summary.requiredTotal}개 중 ${summary.requiredConfirmed}개 확정 / ${summary.requiredCandidate}개 후보 / ${summary.requiredEmpty}개 미입력`,
    `환경 검증: ${validateLine}`,
    `연결 테스트: ${connectionLine}`,
    "",
    ...(nextTasks.length
      ? ["다음 필요 작업:", ...nextTasks.map((t) => `- ${t}`)]
      : ["다음 필요 작업:", "- (추가 작업 없음)"]),
    ...(summary.missingRequiredLabels.length
      ? ["", "미확정·누락 필수 항목:", ...summary.missingRequiredLabels.map((l) => `- ${l}`)]
      : []),
  ];
}

export function buildImplementationWorkPlanDraftBlockedBySeedMessage(
  summary: ImplementationSeedStatusSummary,
): string {
  const lifecycleLabel = formatImplementationSeedLifecycleUserLabel(summary.lifecycleStatus);
  const missingBlock = summary.missingRequiredLabels.length
    ? ["미확정 필수 항목:", ...summary.missingRequiredLabels.map((l) => `- ${l}`), ""]
    : [];

  return [
    "구현 작업안 초안을 생성할 수 없습니다.",
    "",
    "원인:",
    "- Implementation Seed 준비도 미충족",
    "",
    ...missingBlock,
    "필요 작업:",
    "1. 기획단계에서 [구현 준비도 점검]을 실행합니다.",
    "2. [AI팀이 구현 Seed 후보 생성]을 실행합니다.",
    "3. 생성된 Seed 후보를 확인 후 확정합니다.",
    "",
    "Quick Design을 다시 실행하면 구현 Seed 자동 생성·확정을 다시 시도합니다.",
  ].join("\n");
}

export function formatImplementationSeedCandidateGeneratedMessage(input: {
  readonly summary: ImplementationSeedStatusSummary;
  readonly touchedSlotCount: number;
}): string {
  const lifecycleLabel = formatImplementationSeedLifecycleUserLabel(input.summary.lifecycleStatus);
  const pct = Math.round(input.summary.readinessScore * 100);

  return [
    "AI가 구현 Seed 후보를 생성했습니다.",
    "",
    `상태: ${lifecycleLabel}(candidate)`,
    `준비도: ${pct}%`,
    `반영 항목: ${input.touchedSlotCount}개`,
    "",
    "이 항목은 아직 확정 상태가 아닙니다.",
    "구현 작업안 초안 생성 전 Seed 후보를 검토하고 확정해 주세요.",
  ].join("\n");
}

export function implementationSeedGateEntryChips(): readonly string[] {
  return [
    PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP,
    IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_CHIP,
    PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP,
    "환경설정 열기",
    "산출물 다시 보기",
  ];
}

export function formatImplementationSeedReadinessMessage(
  readiness: ImplementationSeedReadiness,
): string {
  if (readiness.ready) {
    return `구현 작업안 초안 생성 준비가 충족되었습니다. (준비도 ${Math.round(readiness.score * 100)}%)`;
  }
  const missingLabels = readiness.missing.map((k) => IMPLEMENTATION_SEED_GAP_LABELS[k]);
  const lines = [
    "구현 작업안 초안 생성을 위해 다음 기획 정보가 부족합니다.",
    "",
    ...missingLabels.map((l) => `- ${l}`),
    "",
    "AI팀이 후보 초안을 생성할 수 있습니다. [부족한 기획정보 보완] 또는 [AI팀이 구현 Seed 후보 생성]을 선택해 주세요.",
  ];
  if (readiness.warnings.length) {
    lines.push("", "참고:", ...readiness.warnings.slice(0, 4).map((w) => `- ${w}`));
  }
  return lines.join("\n");
}

export function parseImplementationSeedV1(raw: unknown): ImplementationSeedV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_SEED_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const createdAt = String(o.createdAt ?? "").trim();
  if (!createdAt) return null;

  const strList = (key: string) =>
    (Array.isArray(o[key]) ? o[key] : []).map(String).map((s) => s.trim()).filter(Boolean);

  const lifecycleRaw = String(o.lifecycleStatus ?? "candidate").trim();
  const lifecycleStatus: ImplementationSeedLifecycleStatus =
    lifecycleRaw === "confirmed" || lifecycleRaw === "partial" ? lifecycleRaw : "candidate";

  const readinessRaw = o.readiness;
  const readiness: ImplementationSeedReadiness =
    readinessRaw && typeof readinessRaw === "object"
      ? {
          ready: Boolean((readinessRaw as Record<string, unknown>).ready),
          score: Number((readinessRaw as Record<string, unknown>).score) || 0,
          missing: strList("missing") as ImplementationSeedGapKey[],
          warnings: strList("warnings"),
        }
      : { ready: false, score: 0, missing: [], warnings: [] };

  const dataRaw = o.dataModelSeed;
  const dataModelSeed: DataModelSeed =
    dataRaw && typeof dataRaw === "object"
      ? {
          entities: strList("entities"),
          fieldsByEntity:
            (dataRaw as Record<string, unknown>).fieldsByEntity &&
            typeof (dataRaw as Record<string, unknown>).fieldsByEntity === "object"
              ? ((dataRaw as Record<string, unknown>).fieldsByEntity as Record<string, readonly string[]>)
              : {},
          relationships: strList("relationships"),
          mockDataNotes: strList("mockDataNotes"),
        }
      : { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] };

  return {
    version: IMPLEMENTATION_SEED_VERSION,
    projectId,
    createdAt,
    updatedAt: String(o.updatedAt ?? createdAt).trim(),
    source: "planning_slots_and_artifacts",
    lifecycleStatus,
    readiness,
    processImplementationItems: (Array.isArray(o.processImplementationItems) ? o.processImplementationItems : []) as ProcessImplementationItem[],
    screenImplementationItems: (Array.isArray(o.screenImplementationItems) ? o.screenImplementationItems : []) as ScreenImplementationItem[],
    actorCapabilityMatrix: (Array.isArray(o.actorCapabilityMatrix) ? o.actorCapabilityMatrix : []) as ActorCapabilityRow[],
    commonDetailFeatures: (Array.isArray(o.commonDetailFeatures) ? o.commonDetailFeatures : []) as CommonDetailFeature[],
    dataModelSeed,
    assumptions: strList("assumptions"),
    gaps: (Array.isArray(o.gaps) ? o.gaps : []) as ImplementationSeedGap[],
    ...(parseSelectedPrototypeTemplateV1(o.templateContext)
      ? { templateContext: parseSelectedPrototypeTemplateV1(o.templateContext) }
      : {}),
  };
}

function parseSelectedPrototypeTemplateV1(raw: unknown): SelectedPrototypeTemplateV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const templateId = String(o.templateId ?? "").trim();
  const validIds = new Set(["dashboard", "booking", "marketplace", "landing", "meeting-workspace"]);
  if (!validIds.has(templateId)) return undefined;
  const templateNameKo = String(o.templateNameKo ?? "").trim();
  const templateNameEn = String(o.templateNameEn ?? "").trim() || templateNameKo;
  const description = String(o.description ?? "").trim();
  const layoutContract = String(o.layoutContract ?? "").trim();
  if (!templateNameKo || !layoutContract) return undefined;
  const sourceRaw = String(o.source ?? "recommended").trim();
  const source =
    sourceRaw === "user_selected" || sourceRaw === "fallback" || sourceRaw === "recommended"
      ? sourceRaw
      : "recommended";
  const strList = (key: string) =>
    (Array.isArray(o[key]) ? o[key] : []).map(String).map((s) => s.trim()).filter(Boolean);
  return {
    templateId: templateId as SelectedPrototypeTemplateV1["templateId"],
    templateNameKo,
    templateNameEn: templateNameEn || templateNameKo,
    description,
    navigationItems: strList("navigationItems"),
    summaryCards: strList("summaryCards"),
    primarySections: strList("primarySections"),
    layoutContract,
    source,
    ...(strList("matchedKeywords").length ? { matchedKeywords: strList("matchedKeywords") } : {}),
    ...(typeof o.score === "number" ? { score: o.score } : {}),
  };
}

export const PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP = "구현 준비도 점검";
export const PLANNING_IMPLEMENTATION_SEED_SUPPLEMENT_CHIP = "부족한 기획정보 보완";
export const PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP = "AI팀이 구현 Seed 후보 생성";

export function planningImplementationSeedChips(): readonly string[] {
  return [
    PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP,
    PLANNING_IMPLEMENTATION_SEED_SUPPLEMENT_CHIP,
    PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP,
  ];
}

export function buildPlanningImplementationSeedEvaluatedTimelineEntry(input: {
  readonly projectId: string;
  readonly readiness: ImplementationSeedReadiness;
  readonly seed: ImplementationSeedV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "planning_implementation_seed_evaluated",
    source: "system",
    responseText: [
      "type=planning_implementation_seed_evaluated",
      "mode=planning",
      `seedReady=${input.readiness.ready}`,
      `score=${input.readiness.score}`,
      `missing=${input.readiness.missing.join(",")}`,
      `processItems=${input.seed.processImplementationItems.length}`,
      `screenItems=${input.seed.screenImplementationItems.length}`,
      `actorRows=${input.seed.actorCapabilityMatrix.length}`,
      `commonFeatures=${input.seed.commonDetailFeatures.length}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

export function buildPlanningImplementationSeedCandidateTimelineEntry(input: {
  readonly projectId: string;
  readonly touchedGapKeys: readonly ImplementationSeedGapKey[];
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "planning_implementation_seed_candidate_generated",
    source: "system",
    responseText: [
      "type=planning_implementation_seed_candidate_generated",
      "mode=planning",
      `touched=${input.touchedGapKeys.join(",")}`,
      "lifecycleStatus=candidate",
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

export function buildImplementationSeedUsedForWorkPlanTimelineEntry(input: {
  readonly seed: ImplementationSeedV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_seed_used_for_work_plan_draft",
    source: "system",
    responseText: [
      "type=implementation_seed_used_for_work_plan_draft",
      "mode=implementation",
      `seedReady=${input.seed.readiness.ready}`,
      `lifecycleStatus=${input.seed.lifecycleStatus}`,
      `processItems=${input.seed.processImplementationItems.length}`,
      `screenItems=${input.seed.screenImplementationItems.length}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
