import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { FastPlanAssumption } from "@/lib/requirements/fastPlanGenerationTypes";
import type { FastPlanDraftSlotCandidatePatchV1 } from "@/lib/requirements/fastPlanDraftSlotPatch";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { formatFastPlanPlatformTimelineResponse } from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import type { QuickDesignAreaCounts } from "@/lib/requirements/quickDesignSlotArea";
import { buildFastPlanAssumptionMarkdownTable } from "@/lib/requirements/markdownTableCells";

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

import { countQuickDesignAreaCounts } from "@/lib/requirements/quickDesignSlotArea";

/** @deprecated use countQuickDesignAreaCounts from quickDesignSlotArea */
export function countQuickDesignSlotsByArea(keys: readonly string[]): QuickDesignAreaCounts {
  return countQuickDesignAreaCounts(keys);
}

export function buildQuickDesignResultMessage(input: {
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly assumptions: readonly FastPlanAssumption[];
  /** @deprecated user-facing message no longer shows patch counts; kept for call-site compatibility */
  readonly slotCandidatePatch?: FastPlanDraftSlotCandidatePatchV1 | null;
}): string {
  const sections = input.memberDrafts
    .filter((d) => d.content.trim())
    .map((d) => `### ${ROLE_HEADING[d.role] ?? d.role} 제안\n${d.content}`)
    .join("\n\n");

  const assumptionTable = buildFastPlanAssumptionMarkdownTable(input.assumptions);
  const assumptionsBlock =
    assumptionTable ? ["### AI 보완 후보/가정", assumptionTable].join("\n") : "";

  const uncertaintyNote =
    input.assumptions.length > 0 ?
      [
        "",
        "일부 항목은 현재 대화만으로 확정하기 어려워 AI팀이 후보로 보완했습니다.",
        "필요하면 「일부 수정」 또는 「정밀 기획 계속하기」로 보완할 수 있습니다.",
      ].join("\n")
    : "";

  return [
    "Quick Design 초안이 생성되었습니다.",
    "",
    "AI팀이 현재 대화 내용을 바탕으로 기획·분석·설계·디자인 초안을 구성했습니다.",
    "이미 확정된 항목은 유지하고, 부족하거나 불확실한 항목은 후보로 보완했습니다.",
    "",
    "확인 후 그대로 확정하거나 일부 수정할 수 있습니다.",
    "",
    sections,
    assumptionsBlock,
    uncertaintyNote,
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
  readonly shortfallWarnings?: readonly string[];
  readonly skippedConfirmedSlotKeys?: readonly string[];
}): RequirementsPromptTimelineEntry {
  const keys = input.patchedSlotKeys.length ? input.patchedSlotKeys : (input.updatedSlotKeys ?? []);
  const detail = JSON.stringify({
    runId: input.runId,
    areaCounts: input.areaCounts,
    planningCandidateCount: input.areaCounts.planning,
    analysisCandidateCount: input.areaCounts.analysis,
    architectureCandidateCount: input.areaCounts.architecture,
    designCandidateCount: input.areaCounts.design,
    patchedSlotKeys: keys,
    shortfallWarnings: input.shortfallWarnings ?? [],
    skippedConfirmedSlotKeys: input.skippedConfirmedSlotKeys ?? [],
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
