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

export const WORKSPACE_SCREEN_LABEL: Record<WorkspaceScreenKey, string> = {
  requirements_ideation: "아이디어 구체화",
  requirements_service_flow: "액터 및 서비스 흐름 정의",
  feature_planning: "기능 정리",
  prototype_build: "프로토타입 생성",
  prototype_review: "프로토타입 검토",
  deploy_gate: "배포 보안 게이트",
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
