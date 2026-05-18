import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { WORKSPACE_AI_MEMBER_KEYS, isWorkspaceAiMemberEnabled } from "@/lib/ai-member/platformAiMembers";

/** DB·API와 동일한 화면 식별자 */
export const WORKSPACE_SCREEN_KEYS = [
  "requirements_ideation",
  "requirements_service_flow",
  "feature_planning",
  "prototype_build",
  "prototype_review",
  "deploy_gate",
  "work_note",
] as const;

export type WorkspaceScreenKey = (typeof WORKSPACE_SCREEN_KEYS)[number];

/** SingleChat 통합 흐름에 대응하는 사용자 절차 그룹(저장 시 화면 키 3개는 그대로 유지) */
export const WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS = [
  "requirements_ideation",
  "requirements_service_flow",
  "feature_planning",
] as const satisfies readonly WorkspaceScreenKey[];

export function isWorkspaceServicePlanningScreenKey(key: WorkspaceScreenKey): boolean {
  return (WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS as readonly string[]).includes(key);
}

export type WorkspaceAiAgentProcedureRow =
  | {
      readonly type: "group";
      readonly rowKey: "service_planning";
      readonly label: string;
      readonly screenKeys: readonly WorkspaceScreenKey[];
    }
  | { readonly type: "single"; readonly screenKey: WorkspaceScreenKey };

const _procedureRows: WorkspaceAiAgentProcedureRow[] = [
  {
    type: "group",
    rowKey: "service_planning",
    label: "서비스 기획",
    screenKeys: WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS,
  },
];
for (const screenKey of WORKSPACE_SCREEN_KEYS) {
  if (screenKey === "work_note") continue;
  if (isWorkspaceServicePlanningScreenKey(screenKey)) continue;
  _procedureRows.push({ type: "single", screenKey });
}

/** AI Agent 설정 — 절차 별 참여 AI 테이블 행(내부 screenKey는 변경 없음) */
export const WORKSPACE_AI_AGENT_PROCEDURE_TABLE_ROWS: readonly WorkspaceAiAgentProcedureRow[] = _procedureRows;

export const WORKSPACE_SCREEN_LABEL: Record<WorkspaceScreenKey, string> = {
  requirements_ideation: "아이디어 구체화",
  requirements_service_flow: "액터 및 서비스 흐름 정의",
  feature_planning: "기능 정리",
  prototype_build: "프로토타입 생성",
  prototype_review: "프로토타입 검토",
  deploy_gate: "배포 전 보안 검증",
  work_note: "작업 메모",
};

function isWorkspaceScreenKey(raw: string): raw is WorkspaceScreenKey {
  return (WORKSPACE_SCREEN_KEYS as readonly string[]).includes(raw);
}

export function parseWorkspaceScreenKey(raw: unknown): WorkspaceScreenKey | null {
  const s = String(raw ?? "").trim();
  return isWorkspaceScreenKey(s) ? s : null;
}

/** DB 행이 없을 때 사용하는 1:1 레거시 매핑(카탈로그 → 기본 한 화면) */
export const LEGACY_DEFAULT_SCREENS_BY_CATALOG: Readonly<Record<WorkspaceAiMemberId, readonly WorkspaceScreenKey[]>> = {
  ideation: ["requirements_ideation"],
  actor_flow: ["requirements_service_flow"],
  feature_planning: ["feature_planning"],
  prototype_build: ["prototype_build"],
  designer: ["feature_planning", "prototype_build"],
  prototype_review: ["prototype_review"],
  security_reviewer: ["prototype_review", "deploy_gate"],
  memo: ["work_note"],
};

export function defaultScreenKeysForCatalogMember(catalogKey: WorkspaceAiMemberId): readonly WorkspaceScreenKey[] {
  return LEGACY_DEFAULT_SCREENS_BY_CATALOG[catalogKey] ?? [];
}

export function allCatalogMemberIds(): readonly WorkspaceAiMemberId[] {
  return WORKSPACE_AI_MEMBER_KEYS;
}

/** 상세 모달 등: 서비스 기획 3화면을 한 라벨로 묶어 표시 */
export function formatWorkspaceScreenKeysForDisplay(keys: readonly WorkspaceScreenKey[]): string {
  if (!keys.length) return "—";
  const set = new Set(keys);
  const parts: string[] = [];
  const hasAllPlanning = WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS.every((k) => set.has(k));
  if (hasAllPlanning) {
    parts.push("서비스 기획");
    for (const k of WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS) set.delete(k);
  } else {
    for (const k of WORKSPACE_SERVICE_PLANNING_SCREEN_KEYS) {
      if (set.has(k)) {
        parts.push(WORKSPACE_SCREEN_LABEL[k]);
        set.delete(k);
      }
    }
  }
  for (const k of WORKSPACE_SCREEN_KEYS) {
    if (set.has(k)) parts.push(WORKSPACE_SCREEN_LABEL[k]);
  }
  return parts.length ? parts.join(" · ") : "—";
}

/** 레거시 1:1 기본 — 특정 화면에 매핑된 카탈로그 키(빌드 플래그 무관) */
export function legacyCatalogKeysForScreen(screenKey: WorkspaceScreenKey): WorkspaceAiMemberId[] {
  const out: WorkspaceAiMemberId[] = [];
  for (const id of allCatalogMemberIds()) {
    if (defaultScreenKeysForCatalogMember(id).includes(screenKey)) out.push(id);
  }
  return out;
}

export type WorkspaceAiGraphMemberLike = {
  readonly enabled: boolean;
  readonly catalogKey: WorkspaceAiMemberId;
  readonly screenKeys: readonly WorkspaceScreenKey[];
  /** 있으면 `screenKeys`와 함께 자동 실행 여부를 해석할 때 사용 */
  readonly screens?: readonly { readonly screenKey: WorkspaceScreenKey; readonly autoRun: boolean }[];
};

/**
 * 프로젝트 그래프 + `NEXT_PUBLIC_AI_MEMBER_*` 반영.
 * 그래프에서 해당 화면에 참여하는 활성 AI가 없으면 레거시 1:1 기본으로 폴백.
 */
export function resolveEnabledCatalogKeysForScreen(
  graph: readonly WorkspaceAiGraphMemberLike[],
  screenKey: WorkspaceScreenKey
): WorkspaceAiMemberId[] {
  const fromGraph = graph
    .filter((g) => g.enabled && g.screenKeys.includes(screenKey))
    .map((g) => g.catalogKey);
  const uniq = [...new Set(fromGraph)];
  const filtered = uniq.filter((id) => isWorkspaceAiMemberEnabled(id));
  if (filtered.length) return filtered;
  return legacyCatalogKeysForScreen(screenKey).filter((id) => isWorkspaceAiMemberEnabled(id));
}
