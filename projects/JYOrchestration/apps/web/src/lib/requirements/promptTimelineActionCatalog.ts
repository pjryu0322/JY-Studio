export type PromptTimelineActionCatalogEntry = Readonly<{
  readonly action: string;
  readonly userTitle?: string;
  readonly userSummary?: string;
  readonly nextActionHint?: string;
  readonly evidenceVisible?: boolean;
  readonly orchestrationTrace?: boolean;
  readonly implementationResetExact?: boolean;
  readonly implementationResetPrefix?: readonly string[];
}>;

const CATALOG_ENTRIES: readonly PromptTimelineActionCatalogEntry[] = [
  {
    action: "quick_design_requested",
    userTitle: "Quick Design 추천안",
    userSummary: "Quick Design을 시작하기 위해 현재 대화의 핵심 요구를 정리했습니다.",
    evidenceVisible: true,
  },
  {
    action: "quick_design_draft_created",
    userTitle: "Quick Design 초안",
    userSummary: "빠른 프로토타입에 필요한 기획 초안을 생성했습니다.",
    evidenceVisible: true,
  },
  {
    action: "quick_design_slots_patched",
    userTitle: "Quick Design 슬롯 보완",
    userSummary: "Quick Design 슬롯을 보완해 추천안을 다듬었습니다.",
    evidenceVisible: true,
  },
  {
    action: "quick_design_confirmed",
    userTitle: "Quick Design 확정",
    userSummary: "사용자가 Quick Design을 확정했습니다.",
    evidenceVisible: true,
  },
  {
    action: "quick_design_confirmed_implementation_seed_auto_built",
    userTitle: "구현 준비정보 생성",
    userSummary: "기획 산출물을 기준으로 구현 준비정보를 자동 정리했습니다.",
    evidenceVisible: true,
  },
  {
    action: "quick_design_confirmed_implementation_readiness_evaluated",
    userTitle: "구현 준비도 점검",
    userSummary: "구현단계로 이동 가능한지 구현 준비도를 점검했습니다.",
    evidenceVisible: true,
  },
  {
    action: "quick_design_confirmed_implementation_candidates_auto_generated",
    userTitle: "구현 후보 산출물",
    userSummary: "구현 단계에서 검토할 후보 산출물을 정리했습니다.",
    nextActionHint: "후보 항목을 확인하고 필요한 내용을 보완하세요.",
    evidenceVisible: true,
  },
  {
    action: "planning_implementation_seed_evaluated",
    userTitle: "구현 준비정보 점검",
    userSummary: "구현 준비정보의 충분성을 점검했습니다.",
    evidenceVisible: true,
    implementationResetExact: true,
  },
  {
    action: "planning_implementation_seed_candidate_generated",
    userTitle: "구현 준비정보 후보",
    userSummary: "구현 준비정보 후보를 생성했습니다.",
    evidenceVisible: true,
    implementationResetExact: true,
  },
  {
    action: "implementation_seed_used_for_work_plan_draft",
    userTitle: "구현 작업안 연결",
    userSummary: "구현 준비정보를 바탕으로 구현 작업안 생성을 준비했습니다.",
    nextActionHint: "구현 작업안 초안을 확인하세요.",
    evidenceVisible: true,
    implementationResetExact: true,
  },
  {
    action: "fast_plan_draft_suggestion_picked",
    userTitle: "프로토타입 기획안 선택",
    userSummary: "프로토타입 기획안 제안을 선택해 반영했습니다.",
    evidenceVisible: true,
  },
  {
    action: "planning_artifact_created",
    userTitle: "기획 산출물 생성",
    userSummary: "현재 대화와 슬롯을 기준으로 기획 산출물을 생성했습니다.",
    evidenceVisible: true,
  },
  {
    action: "planning_artifact_generation_requested",
    userTitle: "기획 산출물 생성 요청",
    userSummary: "기획 산출물 생성을 요청했습니다.",
    nextActionHint: "생성된 기획 산출물을 검토하세요.",
    evidenceVisible: true,
  },
  {
    action: "generation_readiness_checked",
    userTitle: "생성 준비도 점검",
    userSummary: "산출물 생성을 위해 필요한 기획 정보가 충분한지 점검했습니다.",
    evidenceVisible: true,
  },
  { action: "intentRouterGuard", orchestrationTrace: true },
  { action: "orchestrationRecovery", orchestrationTrace: true },
  { action: "orchestrationClarification", orchestrationTrace: true },
  { action: "orchestrationRecommendation", orchestrationTrace: true },
  {
    action: "implementation_bootstrap_lead_developer_summary",
    implementationResetExact: true,
  },
  {
    action: "implementation_role_check_summary_ready",
    implementationResetExact: true,
  },
  {
    action: "implementation_entry_reference_artifacts_checked",
    implementationResetExact: true,
  },
  { action: "implementation_seed_evaluated", implementationResetExact: true },
  { action: "planning_implementation_seed_confirmed", implementationResetExact: true },
  {
    action: "implementation_work_plan_draft_generated",
    implementationResetExact: true,
  },
  {
    action: "implementation_work_plan_draft_confirmed",
    implementationResetExact: true,
  },
  { action: "implementation_slots_built", implementationResetExact: true },
  { action: "implementation_artifacts_derived", implementationResetExact: true },
  { action: "code_agent_wip_requested", implementationResetExact: true },
  { action: "code_agent_wip_committed", implementationResetExact: true },
  { action: "developer_approved", implementationResetExact: true },
  { action: "scm_official_commit_pending", implementationResetExact: true },
  {
    action: "planning_reset_cleared_implementation_derivatives",
    implementationResetExact: true,
  },
  {
    action: "implementation_turn_analyzed",
    implementationResetPrefix: ["implementation_turn_"],
  },
  {
    action: "implementation_turn_patch_applied",
    implementationResetPrefix: ["implementation_turn_"],
  },
  {
    action: "implementation_artifact_hub_opened",
    implementationResetPrefix: ["implementation_"],
  },
];

const BY_ACTION = new Map<string, PromptTimelineActionCatalogEntry>(
  CATALOG_ENTRIES.map((e) => [e.action, e]),
);

const IMPLEMENTATION_RESET_PREFIXES = [
  "implementation_",
  "planning_implementation_seed_",
  "code_agent_wip_",
  "scm_official_commit_",
] as const;

export function getPromptTimelineActionCatalogEntry(
  action: string,
): PromptTimelineActionCatalogEntry | undefined {
  return BY_ACTION.get(String(action ?? "").trim());
}

export function promptTimelineUserTitle(action: string): string | undefined {
  return getPromptTimelineActionCatalogEntry(action)?.userTitle;
}

export function promptTimelineUserSummary(action: string): string | undefined {
  return getPromptTimelineActionCatalogEntry(action)?.userSummary;
}

export function promptTimelineNextActionHint(action: string): string | undefined {
  return getPromptTimelineActionCatalogEntry(action)?.nextActionHint;
}

export function isOrchestrationTraceTimelineAction(action: string): boolean {
  const entry = getPromptTimelineActionCatalogEntry(action);
  if (entry?.orchestrationTrace) return true;
  return (
    action === "intentRouterGuard" ||
    action === "orchestrationRecovery" ||
    action === "orchestrationClarification" ||
    action === "orchestrationRecommendation"
  );
}

export function isRecommendationTimelineAction(action: string): boolean {
  const entry = getPromptTimelineActionCatalogEntry(action);
  if (entry?.evidenceVisible) return true;
  return /quick_design|fast_plan|artifact|implementation_seed|generation_readiness|planning_artifact/i.test(
    action,
  );
}

export function isImplementationTimelineResetAction(action: string): boolean {
  const a = String(action ?? "").trim();
  if (!a) return false;
  const entry = getPromptTimelineActionCatalogEntry(a);
  if (entry?.implementationResetExact) return true;
  const prefixes = entry?.implementationResetPrefix ?? IMPLEMENTATION_RESET_PREFIXES;
  if (prefixes.some((p) => a.startsWith(p))) return true;
  return IMPLEMENTATION_RESET_PREFIXES.some((p) => a.startsWith(p));
}

/** @deprecated — use isOrchestrationTraceTimelineAction */
export const ORCHESTRATION_TIMELINE_ACTIONS = new Set(
  CATALOG_ENTRIES.filter((e) => e.orchestrationTrace).map((e) => e.action),
);
