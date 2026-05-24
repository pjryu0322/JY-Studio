import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { FastPlanAssumption } from "@/lib/requirements/fastPlanGenerationTypes";
import type { FastPlanDraftSlotCandidatePatchV1 } from "@/lib/requirements/fastPlanDraftSlotPatch";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { formatFastPlanPlatformTimelineResponse } from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import {
  buildQuickDesignAreaShortfallWarnings,
  countQuickDesignAreaCounts,
  getQuickDesignPatchedSlotKeys,
  type QuickDesignAreaCounts,
} from "@/lib/requirements/quickDesignSlotArea";

export const QUICK_DESIGN_LABEL = "Quick Design" as const;
export const QUICK_DESIGN_TOOLTIP = "AI팀이 기획·분석·설계·디자인 초안을 자동 구성합니다" as const;
export const QUICK_DESIGN_DESCRIPTION = "Quick Design: AI팀이 필수 슬롯 초안을 생성합니다." as const;

/** Icon button title / aria-label (compact UI). */
export const QUICK_DESIGN_ACCESSIBLE_LABEL = `${QUICK_DESIGN_LABEL}: ${QUICK_DESIGN_TOOLTIP}` as const;

const ROLE_HEADING: Readonly<Record<PlatformMemberRole, string>> = {
  planner: "AI기획자",
  analyst: "AI분석가",
  architect: "AI설계자",
  designer: "AI디자이너",
  developer: "AI개발자",
  reviewer: "검수자",
  security: "보안관",
  scm: "SCM",
  aa: "AA",
  da: "DA",
  etl: "ETL",
  eai: "EAI",
  vlm_analyst: "VLM 분석가",
};

function confidenceKo(c: string): string {
  if (c === "confirmed") return "확정";
  if (c === "partial") return "부분";
  if (c === "candidate") return "후보";
  return "프로토타입용 가정";
}

/** @deprecated use countQuickDesignAreaCounts from quickDesignSlotArea */
export function countQuickDesignSlotsByArea(keys: readonly string[]): QuickDesignAreaCounts {
  return countQuickDesignAreaCounts(keys);
}

function resolveAreaCountsForMessage(
  patch: FastPlanDraftSlotCandidatePatchV1 | null | undefined,
): QuickDesignAreaCounts {
  if (patch?.areaCounts) return patch.areaCounts;
  return countQuickDesignAreaCounts(getQuickDesignPatchedSlotKeys(patch));
}

export function buildQuickDesignResultMessage(input: {
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly assumptions: readonly FastPlanAssumption[];
  readonly slotCandidatePatch?: FastPlanDraftSlotCandidatePatchV1 | null;
}): string {
  const sections = input.memberDrafts
    .filter((d) => d.content.trim())
    .map((d) => `### ${ROLE_HEADING[d.role] ?? d.role} 제안\n${d.content}`)
    .join("\n\n");

  const assumptionRows = input.assumptions
    .map(
      (a) =>
        `| ${a.label} | ${a.value.replace(/\|/g, "\\|").slice(0, 120)} | ${confidenceKo(a.confidence)} | ${a.reason.replace(/\|/g, "\\|")} |`,
    )
    .join("\n");

  const assumptionsBlock =
    assumptionRows ?
      ["### AI 보완 후보/가정", "| 항목 | 보완 내용 | 신뢰도 | 근거 |", "|---|---|---|---|", assumptionRows].join("\n")
    : "";

  const patchKeys = getQuickDesignPatchedSlotKeys(input.slotCandidatePatch);
  const areaCounts = resolveAreaCountsForMessage(input.slotCandidatePatch);
  const shortfall = buildQuickDesignAreaShortfallWarnings(areaCounts);
  const slotReflectBlock =
    patchKeys.length > 0 ?
      [
        "### 슬롯 후보 반영",
        `- 기획 후보: ${areaCounts.planning}개`,
        `- 분석 후보: ${areaCounts.analysis}개`,
        `- 설계 후보: ${areaCounts.architecture}개`,
        `- 디자인 후보: ${areaCounts.design}개`,
      ].join("\n")
    : "### 슬롯 후보 반영\n- (반영된 슬롯 없음)";
  const warningBlock =
    shortfall.length > 0 ? ["", "주의:", ...shortfall].join("\n") : "";

  return [
    "Quick Design 초안이 생성되었습니다.",
    "",
    "AI팀이 현재 대화와 슬롯 후보를 기준으로 기획·분석·설계·디자인 초안을 구성했습니다.",
    "확정되지 않은 항목은 후보 또는 프로토타입용 가정으로 반영했습니다.",
    "",
    sections,
    assumptionsBlock,
    "",
    slotReflectBlock,
    warningBlock,
    "",
    "다음 작업을 선택해 주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

function platformTimelineEntry(input: {
  readonly action: string;
  readonly routingDecision: string;
  readonly projectId: string;
  readonly nowIso: string;
  readonly promptText?: string;
  readonly detail?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    action: input.action,
    source: "platform",
    provider: "platform",
    model: "deterministic",
    routingDecision: input.routingDecision,
    orchestrationTraceGroup: "platform_fast_plan",
    promptText: input.promptText ?? QUICK_DESIGN_LABEL,
    responseText: formatFastPlanPlatformTimelineResponse({
      routingDecision: input.routingDecision,
      detail: input.detail,
    }),
    createdAt: input.nowIso,
    aiMember: "AI 기획자",
  };
}

export function buildQuickDesignRequestedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return platformTimelineEntry({
    action: "quick_design_requested",
    routingDecision: "quick_design_requested",
    projectId: input.projectId,
    nowIso: input.nowIso,
  });
}

export function buildQuickDesignDraftCreatedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly draftCount: number;
}): RequirementsPromptTimelineEntry {
  return platformTimelineEntry({
    action: "quick_design_draft_created",
    routingDecision: "quick_design_draft_created",
    projectId: input.projectId,
    nowIso: input.nowIso,
    detail: `drafts=${input.draftCount}`,
  });
}

export function buildQuickDesignSlotsPatchedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly patchedSlotKeys: readonly string[];
  readonly updatedSlotKeys?: readonly string[];
  readonly areaCounts: QuickDesignAreaCounts;
  readonly runId: string;
}): RequirementsPromptTimelineEntry {
  const keys = input.patchedSlotKeys.length ? input.patchedSlotKeys : (input.updatedSlotKeys ?? []);
  const detail = JSON.stringify({
    runId: input.runId,
    planningCandidateCount: input.areaCounts.planning,
    analysisCandidateCount: input.areaCounts.analysis,
    architectureCandidateCount: input.areaCounts.architecture,
    designCandidateCount: input.areaCounts.design,
    patchedSlotKeys: keys,
  });
  return platformTimelineEntry({
    action: "quick_design_slots_patched",
    routingDecision: "quick_design_slots_patched",
    projectId: input.projectId,
    nowIso: input.nowIso,
    detail,
  });
}

export function buildQuickDesignConfirmedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly confirmedCount: number;
}): RequirementsPromptTimelineEntry {
  return platformTimelineEntry({
    action: "quick_design_confirmed",
    routingDecision: "quick_design_confirmed",
    projectId: input.projectId,
    nowIso: input.nowIso,
    promptText: "초안 확인/확정",
    detail: `confirmed=${input.confirmedCount}`,
  });
}

export function buildPlanningArtifactViewRequestedTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
  readonly artifactId: string | null;
}): RequirementsPromptTimelineEntry {
  return platformTimelineEntry({
    action: "planning_artifact_view_requested",
    routingDecision: "planning_artifact_view_requested",
    projectId: input.projectId,
    nowIso: input.nowIso,
    promptText: "기획안 보기",
    detail: input.artifactId ? `artifactId=${input.artifactId}` : "artifactId=missing",
  });
}
