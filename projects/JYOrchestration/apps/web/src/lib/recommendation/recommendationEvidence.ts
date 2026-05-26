import { PROJECT_ARTIFACT_LABELS, type ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type RecommendationEvidenceStatus = "confirmed" | "candidate" | "needs_review" | "deferred";

export type RecommendationEvidenceStage = "planning" | "implementation" | "review" | "general";

export type RecommendationEvidenceItem = Readonly<{
  readonly id: string;
  readonly title: string;
  readonly stage: RecommendationEvidenceStage;
  readonly status: RecommendationEvidenceStatus;
  readonly aiMemberLabel: string;
  readonly createdAt?: string;
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly sourceInputs: readonly string[];
  readonly referencedArtifacts: readonly string[];
  readonly unresolvedItems: readonly string[];
  readonly nextActions: readonly string[];
  readonly sourceTraceIds: readonly string[];
}>;

const INTERNAL_TEXT_PATTERNS: readonly RegExp[] = [
  /맥락\s*예산/i,
  /압축\s*정책/i,
  /조립\s*계획/i,
  /참조\s*맥락\s*후보/i,
  /우선순위\s*정리/i,
  /contextBudget/i,
  /compressionPolicy/i,
  /promptAssembly/i,
  /rawPrompt/i,
  /\btoken\b/i,
  /provider\s*latency/i,
  /지식팩\s*활성화\s*힌트/i,
];

const TIMELINE_ACTION_TITLE: Readonly<Record<string, string>> = {
  quick_design_requested: "Quick Design 추천안",
  quick_design_draft_created: "Quick Design 초안",
  quick_design_slots_patched: "Quick Design 슬롯 보완",
  quick_design_confirmed: "Quick Design 확정",
  quick_design_confirmed_implementation_seed_auto_built: "구현 준비정보 생성",
  quick_design_confirmed_implementation_readiness_evaluated: "구현 준비도 점검",
  quick_design_confirmed_implementation_candidates_auto_generated: "구현 후보 산출물",
  planning_implementation_seed_evaluated: "구현 준비정보 점검",
  planning_implementation_seed_candidate_generated: "구현 준비정보 후보",
  implementation_seed_used_for_work_plan_draft: "구현 작업안 연결",
  fast_plan_draft_suggestion_picked: "프로토타입 기획안 선택",
  planning_artifact_created: "기획 산출물 생성",
  planning_artifact_generation_requested: "기획 산출물 생성 요청",
  generation_readiness_checked: "생성 준비도 점검",
  orchestrationTimelineSummary: "오케스트레이션 요약",
};

export const RECOMMENDATION_EVIDENCE_STATUS_LABELS: Readonly<Record<RecommendationEvidenceStatus, string>> = {
  confirmed: "확정",
  candidate: "후보",
  needs_review: "확인필요",
  deferred: "보류",
};

export const RECOMMENDATION_EVIDENCE_STAGE_LABELS: Readonly<Record<RecommendationEvidenceStage, string>> = {
  planning: "기획",
  implementation: "구현",
  review: "검토",
  general: "일반",
};

export function recommendationEvidenceStatusLabel(status: RecommendationEvidenceStatus): string {
  return RECOMMENDATION_EVIDENCE_STATUS_LABELS[status];
}

export function isInternalRecommendationText(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return INTERNAL_TEXT_PATTERNS.some((re) => re.test(t));
}

export function sanitizeRecommendationUserText(text: string | undefined | null, maxLen = 320): string {
  const raw = String(text ?? "").trim();
  if (!raw || isInternalRecommendationText(raw)) return "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isInternalRecommendationText(l));
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return "";
  return joined.length > maxLen ? `${joined.slice(0, maxLen)}…` : joined;
}

function timelineStage(entry: RequirementsPromptTimelineEntry): RecommendationEvidenceStage {
  const action = String(entry.action ?? "").toLowerCase();
  const stage = String(entry.stage ?? "").toLowerCase();
  if (action.includes("implementation") || action.includes("seed") || stage.includes("execution")) {
    return "implementation";
  }
  if (stage.includes("review") || action.includes("review")) return "review";
  if (stage.includes("service-flow") || stage.includes("feature") || stage.includes("ideation")) {
    return "planning";
  }
  return "general";
}

function timelineStatus(entry: RequirementsPromptTimelineEntry): RecommendationEvidenceStatus {
  const action = String(entry.action ?? "");
  if (/confirmed|created|_used_for_|artifact_created/i.test(action)) return "confirmed";
  if (/candidate|draft_created|suggestion/i.test(action)) return "candidate";
  if (entry.error || /blocked|failed/i.test(action)) return "needs_review";
  if ((entry.candidateSlots?.length ?? 0) > 0 && !(entry.confirmedSlots?.length ?? 0)) return "candidate";
  if ((entry.staleSlots?.length ?? 0) > 0) return "needs_review";
  return "deferred";
}

function timelineTitle(entry: RequirementsPromptTimelineEntry): string {
  const action = String(entry.action ?? "").trim();
  if (TIMELINE_ACTION_TITLE[action]) return TIMELINE_ACTION_TITLE[action];
  if (action.includes("quick_design")) return "Quick Design 추천안";
  if (action.includes("implementation_seed")) return "구현 준비정보";
  if (action.includes("artifact")) return "기획 산출물 추천";
  if (action.includes("fast_plan")) return "프로토타입 기획안";
  return action.replace(/_/g, " ").slice(0, 48) || "AI 추천";
}

function timelineReasons(entry: RequirementsPromptTimelineEntry): string[] {
  const reasons: string[] = [];
  const response = sanitizeRecommendationUserText(entry.responseText, 240);
  if (response) reasons.push(response);
  if (entry.matchedSlots?.length) {
    reasons.push(`관련 슬롯 ${entry.matchedSlots.length}건을 참고했습니다.`);
  }
  if (entry.updatedSlots?.length) {
    reasons.push(`갱신된 슬롯 ${entry.updatedSlots.length}건을 반영했습니다.`);
  }
  const ctx = entry.contextBlocks;
  if (ctx && typeof ctx === "object") {
    const open = Array.isArray((ctx as { openItems?: unknown }).openItems)
      ? ((ctx as { openItems: readonly string[] }).openItems ?? [])
      : [];
    for (const item of open.slice(0, 3)) {
      const line = sanitizeRecommendationUserText(item, 120);
      if (line) reasons.push(line);
    }
  }
  return reasons.slice(0, 6);
}

function itemFromTimeline(entry: RequirementsPromptTimelineEntry, index: number): RecommendationEvidenceItem | null {
  const action = String(entry.action ?? "").trim();
  if (!action || /prompt_timeline|debug|trace_only/i.test(action)) return null;
  if (/orchestrationTimelineSummary|intentRouterGuard|serviceFlowSlotSync/i.test(action)) return null;

  const summary =
    sanitizeRecommendationUserText(entry.fallbackText, 200) ||
    sanitizeRecommendationUserText(entry.responseText, 200) ||
    `${timelineTitle(entry)}에 대한 AI 판단이 기록되었습니다.`;

  if (!summary) return null;

  const aiMemberLabel = String(entry.aiMember ?? entry.orchestratorAgent ?? "AI 기획자").trim() || "AI 기획자";
  const reasons = timelineReasons(entry);
  const unresolved: string[] = [];
  if (entry.error) unresolved.push(sanitizeRecommendationUserText(entry.error, 160) || "처리 중 오류가 기록되었습니다.");
  for (const slot of entry.staleSlots ?? []) {
    const s = sanitizeRecommendationUserText(slot, 80);
    if (s) unresolved.push(`갱신 필요: ${s}`);
  }

  return {
    id: `timeline-${entry.createdAt}-${index}`,
    title: timelineTitle(entry),
    stage: timelineStage(entry),
    status: timelineStatus(entry),
    aiMemberLabel,
    createdAt: entry.createdAt,
    summary,
    reasons: reasons.length ? reasons : [summary],
    sourceInputs: [],
    referencedArtifacts: (entry.updatedSlots ?? [])
      .map((s) => sanitizeRecommendationUserText(s, 80))
      .filter(Boolean),
    unresolvedItems: unresolved,
    nextActions: [],
    sourceTraceIds: action ? [action] : [],
  };
}

function itemFromArtifact(art: ProjectArtifact): RecommendationEvidenceItem | null {
  const orch = art.orchestration;
  if (!orch) return null;
  const reason = sanitizeRecommendationUserText(orch.reason, 240);
  const hint = sanitizeRecommendationUserText(orch.improvementHint, 160);
  if (!reason && !hint) return null;

  let status: RecommendationEvidenceStatus = "confirmed";
  if (orch.hubReadinessLabel?.includes("보완") || orch.completenessScore < 0.45) {
    status = "needs_review";
  } else if (orch.isPlaceholderOnly) {
    status = "candidate";
  }

  const title = PROJECT_ARTIFACT_LABELS[art.type] ?? art.title;
  const reasons = [reason, hint].filter(Boolean) as string[];
  const unresolved =
    status === "needs_review" && orch.hubReadinessLabel
      ? [sanitizeRecommendationUserText(orch.hubReadinessLabel, 120)].filter(Boolean)
      : [];

  return {
    id: `artifact-${art.id}`,
    title,
    stage: "planning",
    status,
    aiMemberLabel: orch.sourceRoles.length ? orch.sourceRoles.join(", ") : "AI 기획자",
    createdAt: art.createdAt,
    summary: reason || `${title} 산출물이 정리되었습니다.`,
    reasons,
    sourceInputs: [],
    referencedArtifacts: [title],
    unresolvedItems: unresolved,
    nextActions: [],
    sourceTraceIds: orch.trace?.map((t) => t.artifactType).filter(Boolean) ?? [],
  };
}

function itemsFromImplementationState(state: RequirementsStateJson): readonly RecommendationEvidenceItem[] {
  const out: RecommendationEvidenceItem[] = [];
  const seed = state.implementationSeedV1;
  if (seed) {
    const status: RecommendationEvidenceStatus =
      seed.lifecycleStatus === "confirmed"
        ? "confirmed"
        : seed.lifecycleStatus === "candidate"
          ? "candidate"
          : "needs_review";
    const gaps = seed.readiness.missing.map((k) => `준비 항목: ${k}`);
    out.push({
      id: `impl-seed-${seed.updatedAt}`,
      title: "구현 준비정보",
      stage: "implementation",
      status,
      aiMemberLabel: "AI 구현 리드",
      createdAt: seed.updatedAt,
      summary:
        seed.readiness.ready
          ? "기획 산출물을 바탕으로 구현 준비정보가 정리되었습니다."
          : "구현 준비정보가 생성되었으나 일부 항목이 더 필요합니다.",
      reasons: [
        `준비도 ${Math.round(seed.readiness.score * 100)}%`,
        `상태: ${seed.lifecycleStatus}`,
      ],
      sourceInputs: [],
      referencedArtifacts: ["기획 산출물"],
      unresolvedItems: gaps,
      nextActions: status === "candidate" ? ["사용자 확정 후 구현 작업안 생성"] : [],
      sourceTraceIds: ["implementationSeedV1"],
    });
  }

  const draft = state.implementationWorkPlanDraftV1;
  if (draft?.implementationScope.length) {
    out.push({
      id: `impl-plan-${draft.updatedAt}`,
      title: "구현 작업안",
      stage: "implementation",
      status: draft.status === "confirmed" ? "confirmed" : "candidate",
      aiMemberLabel: "AI 구현 리드",
      createdAt: draft.updatedAt,
      summary: `구현 범위 ${draft.implementationScope.length}건을 작업안으로 정리했습니다.`,
      reasons: draft.implementationApproach.slice(0, 3).map((s) => sanitizeRecommendationUserText(s, 120)).filter(Boolean),
      sourceInputs: draft.referenceArtifacts.map((r) => r.title),
      referencedArtifacts: draft.referenceArtifacts.map((r) => r.title),
      unresolvedItems: draft.blockers.map((b) => sanitizeRecommendationUserText(b, 120)).filter(Boolean),
      nextActions: draft.status === "draft" ? ["구현 작업안 확정"] : [],
      sourceTraceIds: ["implementationWorkPlanDraftV1"],
    });
  }

  const orch = state.artifactOrchestrationV1;
  if (orch?.planningSummary) {
    const summary = sanitizeRecommendationUserText(orch.planningSummary, 240);
    if (summary) {
      out.push({
        id: `artifact-orch-${orch.plannedAt}`,
        title: "기획 산출물 계획",
        stage: "planning",
        status: "confirmed",
        aiMemberLabel: "AI 기획자",
        createdAt: orch.plannedAt,
        summary,
        reasons: [summary],
        sourceInputs: [],
        referencedArtifacts: orch.requiredTypes.map((t) => PROJECT_ARTIFACT_LABELS[t] ?? t),
        unresolvedItems: [],
        nextActions: [],
        sourceTraceIds: ["artifactOrchestrationV1"],
      });
    }
  }

  return out;
}

function isRecommendationTimelineAction(action: string): boolean {
  return /quick_design|fast_plan|artifact|implementation_seed|generation_readiness|planning_artifact/i.test(
    action,
  );
}

export function buildRecommendationEvidenceItems(input: {
  readonly requirementsStateJson: RequirementsStateJson;
  readonly messages?: readonly RequirementsMessage[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
}): readonly RecommendationEvidenceItem[] {
  const state = input.requirementsStateJson;
  const artifacts = input.projectArtifacts ?? state.projectArtifacts ?? [];
  const timeline = state.promptTimeline ?? [];
  const byId = new Map<string, RecommendationEvidenceItem>();

  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i]!;
    if (!isRecommendationTimelineAction(String(entry.action ?? ""))) continue;
    const item = itemFromTimeline(entry, i);
    if (item && !isInternalRecommendationText(item.summary)) {
      byId.set(item.id, item);
    }
  }

  for (const art of artifacts) {
    const item = itemFromArtifact(art);
    if (item) byId.set(item.id, item);
  }

  for (const item of itemsFromImplementationState(state)) {
    byId.set(item.id, item);
  }

  return [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.createdAt ?? "") || 0;
    const tb = Date.parse(b.createdAt ?? "") || 0;
    return tb - ta;
  });
}

export function summarizeRecommendationEvidenceCounts(
  items: readonly RecommendationEvidenceItem[],
): Readonly<{ readonly total: number; readonly candidate: number; readonly needsReview: number }> {
  return {
    total: items.length,
    candidate: items.filter((i) => i.status === "candidate").length,
    needsReview: items.filter((i) => i.status === "needs_review").length,
  };
}

/** 대화 카드 인라인 AI 판단 — 개발자 디버그에서만 */
export function showInlineMessageExplainability(): boolean {
  return String(process.env.NEXT_PUBLIC_JY_EXPLAINABILITY_DEBUG ?? "").trim() === "1";
}
