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
};

const TIMELINE_ACTION_SUMMARY: Readonly<Record<string, string>> = {
  quick_design_requested: "Quick Design을 시작하기 위해 현재 대화의 핵심 요구를 정리했습니다.",
  quick_design_draft_created: "빠른 프로토타입에 필요한 기획 초안을 생성했습니다.",
  quick_design_slots_patched: "Quick Design 슬롯을 보완해 추천안을 다듬었습니다.",
  quick_design_confirmed: "사용자가 Quick Design을 확정했습니다.",
  quick_design_confirmed_implementation_seed_auto_built:
    "기획 산출물을 기준으로 구현 준비정보를 자동 정리했습니다.",
  quick_design_confirmed_implementation_readiness_evaluated:
    "구현단계로 이동 가능한지 구현 준비도를 점검했습니다.",
  quick_design_confirmed_implementation_candidates_auto_generated:
    "구현 단계에서 검토할 후보 산출물을 정리했습니다.",
  planning_implementation_seed_evaluated: "구현 준비정보의 충분성을 점검했습니다.",
  planning_implementation_seed_candidate_generated: "구현 준비정보 후보를 생성했습니다.",
  implementation_seed_used_for_work_plan_draft: "구현 준비정보를 바탕으로 구현 작업안 생성을 준비했습니다.",
  fast_plan_draft_suggestion_picked: "프로토타입 기획안 제안을 선택해 반영했습니다.",
  planning_artifact_created: "현재 대화와 슬롯을 기준으로 기획 산출물을 생성했습니다.",
  planning_artifact_generation_requested: "기획 산출물 생성을 요청했습니다.",
  generation_readiness_checked: "산출물 생성을 위해 필요한 기획 정보가 충분한지 점검했습니다.",
};

const TIMELINE_ACTION_NEXT: Readonly<Record<string, string>> = {
  quick_design_confirmed_implementation_candidates_auto_generated:
    "후보 항목을 확인하고 필요한 내용을 보완하세요.",
  implementation_seed_used_for_work_plan_draft: "구현 작업안 초안을 확인하세요.",
  planning_artifact_generation_requested: "생성된 기획 산출물을 검토하세요.",
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

const STATUS_REVIEW_COPY = {
  candidate: "사용자 확인 후 확정이 필요합니다.",
  needsReview: "보완 또는 재검토가 필요합니다.",
} as const;

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

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function isUserFacingInputMessage(message: RequirementsMessage): boolean {
  return message.role === "user" || message.speakerType === "USER";
}

function userMessageSnippet(message: RequirementsMessage): string {
  return sanitizeRecommendationUserText(message.content, 200);
}

function userMessageSnippetsBefore(
  messages: readonly RequirementsMessage[],
  createdAt: string | undefined,
  maxMessages: number,
): string[] {
  const entryMs = Date.parse(createdAt ?? "");
  return messages
    .filter(isUserFacingInputMessage)
    .filter((m) => {
      const ms = Date.parse(m.createdAt ?? "");
      if (!Number.isFinite(entryMs) || !Number.isFinite(ms)) return true;
      return ms <= entryMs;
    })
    .slice(-maxMessages)
    .map(userMessageSnippet)
    .filter(Boolean);
}

function resolveSourceInputsFallback(
  messages: readonly RequirementsMessage[],
  createdAt: string | undefined,
  projectDescription: string | undefined,
  maxMessages: number,
): readonly string[] {
  const snippets = dedupeStrings(userMessageSnippetsBefore(messages, createdAt, maxMessages));
  if (snippets.length) return snippets.slice(0, 3);
  const desc = sanitizeRecommendationUserText(projectDescription, 200);
  return desc ? [desc] : [];
}

function appendStatusReviewLines(status: RecommendationEvidenceStatus, target: string[]): void {
  if (status === "candidate") target.push(STATUS_REVIEW_COPY.candidate);
  if (status === "needs_review") target.push(STATUS_REVIEW_COPY.needsReview);
}

function timelineEntrySourceIds(entry: RequirementsPromptTimelineEntry): readonly string[] {
  const raw = entry as RequirementsPromptTimelineEntry & {
    readonly sourceMessageIds?: readonly string[];
    readonly userMessageId?: string;
  };
  const ids: string[] = [];
  if (Array.isArray(raw.sourceMessageIds)) {
    for (const id of raw.sourceMessageIds) {
      if (typeof id === "string" && id.trim()) ids.push(id.trim());
    }
  }
  if (typeof raw.userMessageId === "string" && raw.userMessageId.trim()) {
    ids.push(raw.userMessageId.trim());
  }
  return ids;
}

export function findSourceUserInputsForTimeline(input: {
  readonly entry: RequirementsPromptTimelineEntry;
  readonly messages: readonly RequirementsMessage[];
  readonly projectDescription?: string;
}): readonly string[] {
  const { entry, messages, projectDescription } = input;
  const linked: string[] = [];

  for (const id of timelineEntrySourceIds(entry)) {
    const m = messages.find((x) => x.id === id);
    if (!m) continue;
    const text = userMessageSnippet(m);
    if (text) linked.push(text);
  }
  if (linked.length) return dedupeStrings(linked).slice(0, 3);

  return resolveSourceInputsFallback(messages, entry.createdAt, projectDescription, 3);
}

export function buildUserFacingTimelineSummary(entry: RequirementsPromptTimelineEntry): string {
  const action = String(entry.action ?? "").trim();
  if (TIMELINE_ACTION_SUMMARY[action]) return TIMELINE_ACTION_SUMMARY[action];
  const fallback =
    sanitizeRecommendationUserText(entry.fallbackText, 200) ||
    sanitizeRecommendationUserText(entry.responseText, 200);
  if (fallback) return fallback;
  return timelineTitle(entry) + " 관련 판단이 기록되었습니다.";
}

export function buildUserFacingTimelineReasons(entry: RequirementsPromptTimelineEntry): readonly string[] {
  const action = String(entry.action ?? "").trim();
  const reasons: string[] = [];
  if (TIMELINE_ACTION_SUMMARY[action]) {
    reasons.push(TIMELINE_ACTION_SUMMARY[action]);
  }
  const response = sanitizeRecommendationUserText(entry.responseText, 240);
  if (response && !reasons.includes(response)) reasons.push(response);
  if (entry.matchedSlots?.length) {
    reasons.push(`관련 정보 ${entry.matchedSlots.length}건을 참고했습니다.`);
  }
  const ctx = entry.contextBlocks;
  if (ctx && typeof ctx === "object") {
    const open = Array.isArray((ctx as { openItems?: unknown }).openItems)
      ? ((ctx as { openItems: readonly string[] }).openItems ?? [])
      : [];
    for (const item of open.slice(0, 2)) {
      const line = sanitizeRecommendationUserText(item, 120);
      if (line && !reasons.includes(line)) reasons.push(line);
    }
  }
  return dedupeStrings(reasons).slice(0, 6);
}

export function buildUserFacingNextActions(
  entry: RequirementsPromptTimelineEntry,
  status: RecommendationEvidenceStatus,
): readonly string[] {
  const action = String(entry.action ?? "").trim();
  const next: string[] = [];
  if (TIMELINE_ACTION_NEXT[action]) next.push(TIMELINE_ACTION_NEXT[action]);
  appendStatusReviewLines(status, next);
  return dedupeStrings(next);
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
  return "AI 추천";
}

function buildUnresolvedForTimeline(
  entry: RequirementsPromptTimelineEntry,
  status: RecommendationEvidenceStatus,
): string[] {
  const unresolved: string[] = [];
  appendStatusReviewLines(status, unresolved);
  if (entry.error) {
    unresolved.push(sanitizeRecommendationUserText(entry.error, 160) || "처리 중 오류가 기록되었습니다.");
  }
  for (const slot of entry.staleSlots ?? []) {
    const s = sanitizeRecommendationUserText(slot, 80);
    if (s) unresolved.push(`갱신 필요: ${s}`);
  }
  return dedupeStrings(unresolved);
}

function itemFromTimeline(
  entry: RequirementsPromptTimelineEntry,
  index: number,
  context: {
    readonly messages: readonly RequirementsMessage[];
    readonly projectDescription?: string;
  },
): RecommendationEvidenceItem | null {
  const action = String(entry.action ?? "").trim();
  if (!action || /prompt_timeline|debug|trace_only/i.test(action)) return null;
  if (/orchestrationTimelineSummary|intentRouterGuard|serviceFlowSlotSync/i.test(action)) return null;

  const status = timelineStatus(entry);
  const summary = buildUserFacingTimelineSummary(entry);
  if (!summary || isInternalRecommendationText(summary)) return null;

  const aiMemberLabel = String(entry.aiMember ?? entry.orchestratorAgent ?? "AI 기획자").trim() || "AI 기획자";
  const reasons = buildUserFacingTimelineReasons(entry);
  const sourceInputs = findSourceUserInputsForTimeline({
    entry,
    messages: context.messages,
    projectDescription: context.projectDescription,
  });

  return {
    id: `timeline-${entry.createdAt}-${index}`,
    title: timelineTitle(entry),
    stage: timelineStage(entry),
    status,
    aiMemberLabel,
    createdAt: entry.createdAt,
    summary,
    reasons: reasons.length ? reasons : [summary],
    sourceInputs,
    referencedArtifacts: (entry.updatedSlots ?? [])
      .map((s) => sanitizeRecommendationUserText(s, 80))
      .filter(Boolean),
    unresolvedItems: buildUnresolvedForTimeline(entry, status),
    nextActions: buildUserFacingNextActions(entry, status),
    sourceTraceIds: action ? [action] : [],
  };
}

function findSourceInputsNearCreatedAt(
  messages: readonly RequirementsMessage[],
  createdAt: string | undefined,
  projectDescription?: string,
): readonly string[] {
  return resolveSourceInputsFallback(messages, createdAt, projectDescription, 2);
}

function itemFromArtifact(
  art: ProjectArtifact,
  context: { readonly messages: readonly RequirementsMessage[]; readonly projectDescription?: string },
): RecommendationEvidenceItem | null {
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
  const reasons = dedupeStrings([reason, hint].filter(Boolean) as string[]);
  const unresolved: string[] = [];
  if (status === "needs_review" && orch.hubReadinessLabel) {
    const line = sanitizeRecommendationUserText(orch.hubReadinessLabel, 120);
    if (line) unresolved.push(line);
  }
  appendStatusReviewLines(status, unresolved);

  return {
    id: `artifact-${art.id}`,
    title,
    stage: "planning",
    status,
    aiMemberLabel: orch.sourceRoles.length ? orch.sourceRoles.join(", ") : "AI 기획자",
    createdAt: art.createdAt,
    summary: reason || `${title} 산출물이 정리되었습니다.`,
    reasons,
    sourceInputs: findSourceInputsNearCreatedAt(context.messages, art.createdAt, context.projectDescription),
    referencedArtifacts: [title],
    unresolvedItems: unresolved,
    nextActions: status === "needs_review" ? ["산출물 내용을 보완하거나 재생성하세요."] : [],
    sourceTraceIds: orch.trace?.map((t) => t.artifactType).filter(Boolean) ?? [],
  };
}

function itemsFromImplementationState(
  state: RequirementsStateJson,
  context: { readonly messages: readonly RequirementsMessage[]; readonly projectDescription?: string },
): readonly RecommendationEvidenceItem[] {
  const out: RecommendationEvidenceItem[] = [];
  const seed = state.implementationSeedV1;
  if (seed) {
    const status: RecommendationEvidenceStatus =
      seed.lifecycleStatus === "confirmed"
        ? "confirmed"
        : seed.lifecycleStatus === "candidate"
          ? "candidate"
          : "needs_review";
    const unresolved = dedupeStrings(seed.readiness.missing.map((k) => `준비 항목: ${k}`));
    appendStatusReviewLines(status, unresolved);
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
        "기획 산출물과 슬롯을 기준으로 구현 관점으로 정리했습니다.",
      ],
      sourceInputs: findSourceInputsNearCreatedAt(context.messages, seed.createdAt, context.projectDescription),
      referencedArtifacts: ["기획 산출물"],
      unresolvedItems: unresolved,
      nextActions:
        status === "candidate"
          ? ["사용자 확정 후 구현 작업안 생성"]
          : status === "needs_review"
            ? ["부족 항목을 보완하세요."]
            : [],
      sourceTraceIds: ["implementationSeedV1"],
    });
  }

  const draft = state.implementationWorkPlanDraftV1;
  if (draft?.implementationScope.length) {
    const status: RecommendationEvidenceStatus = draft.status === "confirmed" ? "confirmed" : "candidate";
    const planUnresolved = dedupeStrings(
      draft.blockers.map((b) => sanitizeRecommendationUserText(b, 120)).filter(Boolean),
    );
    appendStatusReviewLines(status, planUnresolved);
    out.push({
      id: `impl-plan-${draft.updatedAt}`,
      title: "구현 작업안",
      stage: "implementation",
      status,
      aiMemberLabel: "AI 구현 리드",
      createdAt: draft.updatedAt,
      summary: `구현 범위 ${draft.implementationScope.length}건을 작업안으로 정리했습니다.`,
      reasons: draft.implementationApproach
        .slice(0, 3)
        .map((s) => sanitizeRecommendationUserText(s, 120))
        .filter(Boolean),
      sourceInputs: dedupeStrings([
        ...draft.referenceArtifacts.map((r) => r.title),
        ...findSourceInputsNearCreatedAt(context.messages, draft.createdAt, context.projectDescription),
      ]).slice(0, 3),
      referencedArtifacts: draft.referenceArtifacts.map((r) => r.title),
      unresolvedItems: planUnresolved,
      nextActions: draft.status === "draft" ? ["구현 작업안 확정", "구현 작업안 초안을 확인하세요."] : [],
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
        sourceInputs: findSourceInputsNearCreatedAt(context.messages, orch.plannedAt, context.projectDescription),
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
  readonly projectDescription?: string;
}): readonly RecommendationEvidenceItem[] {
  const state = input.requirementsStateJson;
  const artifacts = input.projectArtifacts ?? state.projectArtifacts ?? [];
  const timeline = state.promptTimeline ?? [];
  const messages = input.messages ?? [];
  const projectDescription = input.projectDescription;
  const context = { messages, projectDescription };
  const byId = new Map<string, RecommendationEvidenceItem>();

  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i]!;
    if (!isRecommendationTimelineAction(String(entry.action ?? ""))) continue;
    const item = itemFromTimeline(entry, i, context);
    if (item && !isInternalRecommendationText(item.summary)) {
      byId.set(item.id, item);
    }
  }

  for (const art of artifacts) {
    const item = itemFromArtifact(art, context);
    if (item) byId.set(item.id, item);
  }

  for (const item of itemsFromImplementationState(state, context)) {
    byId.set(item.id, item);
  }

  return [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.createdAt ?? "") || 0;
    const tb = Date.parse(b.createdAt ?? "") || 0;
    return tb - ta;
  });
}

export type RecommendationEvidenceCountSummary = Readonly<{
  readonly total: number;
  readonly confirmed: number;
  readonly candidate: number;
  readonly needsReview: number;
  readonly deferred: number;
}>;

export function summarizeRecommendationEvidenceCounts(
  items: readonly RecommendationEvidenceItem[],
): RecommendationEvidenceCountSummary {
  return {
    total: items.length,
    confirmed: items.filter((i) => i.status === "confirmed").length,
    candidate: items.filter((i) => i.status === "candidate").length,
    needsReview: items.filter((i) => i.status === "needs_review").length,
    deferred: items.filter((i) => i.status === "deferred").length,
  };
}

/** 대화 카드 인라인 AI 판단 — 개발자 디버그에서만 */
export function showInlineMessageExplainability(): boolean {
  return String(process.env.NEXT_PUBLIC_JY_EXPLAINABILITY_DEBUG ?? "").trim() === "1";
}
