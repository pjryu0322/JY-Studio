import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";
import type { AiIdentityContract } from "@/lib/overlay/aiIdentityContract";
import type { PromptAssemblyMetadataContract } from "@/lib/overlay/contextAssemblyContract";
import { emptyPromptAssemblyMetadata } from "@/lib/overlay/contextAssemblyContract";
import { buildPromptAssemblyMemoryRef } from "@/lib/overlay/memoryScopeRuntime";
import { resolveKnowledgeActivationHintsForRole } from "@/lib/overlay/knowledgeActivationResolver";
import {
  buildOverlayRuntimePolicyHintsWire,
  type OverlayRuntimePolicyHintsWire,
  shouldEnableContextAssembly,
  shouldEnableKnowledgeHints,
  shouldEnableOverlayTrace,
} from "@/lib/overlay/overlayPolicy";
import { buildOverlayPolicyWarningsForResolvedRole } from "@/lib/overlay/overlayPolicyWarning";
import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";
import { resolveAiIdentityContract } from "@/lib/overlay/overlayRuntimeResolver";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import { buildOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import { buildOverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import type { OverlayOrchestrationDecisionTrace } from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import { buildOverlayOrchestrationDecisionTrace } from "@/lib/overlay/overlayOrchestrationDecisionTrace";
import type { OverlayConflictWarning } from "@/lib/overlay/overlayConflictDetection";
import { detectOverlayConflicts } from "@/lib/overlay/overlayConflictDetection";
import type { OverlayAssemblyPlanItem } from "@/lib/overlay/overlayContextAssemblyPlan";
import { buildOverlayContextAssemblyPlan } from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlayPruningCandidate } from "@/lib/overlay/overlayContextPruning";
import { suggestOverlayPruningCandidates } from "@/lib/overlay/overlayContextPruning";
import { prioritizeOverlayContexts } from "@/lib/overlay/overlayContextPrioritization";
import { detectOverlayPolicyDrift } from "@/lib/overlay/overlayPolicyDriftWarning";
import type { SingleChatOrchestrationTurnMeta } from "@/lib/requirements/singleChatOrchestrationOpenAI";
import type {
  HarnessPromptAssemblyPreview,
  HarnessPromptPreviewDiff,
} from "@/lib/harness/promptAssembly/harnessPromptAssemblyTypes";
import { buildHarnessPromptAssemblyPreview } from "@/lib/harness/promptAssembly/buildHarnessPromptAssemblyPreview";
import { compareHarnessPromptPreview } from "@/lib/harness/promptAssembly/compareHarnessPromptPreview";
import type { KnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import { buildKnowledgeActivationPlan } from "@/lib/harness/knowledgeActivation/buildKnowledgeActivationPlan";
import { deriveKnowledgeActivationTaskTypeFromMeta } from "@/lib/harness/knowledgeActivation/deriveKnowledgeActivationTaskType";
import type { MemoryRuntimePlan } from "@/lib/harness/memoryRuntime/memoryRuntimeTypes";
import { buildMemoryRuntimePlan } from "@/lib/harness/memoryRuntime/buildMemoryRuntimePlan";
import type { ExecutionRoutingPlan } from "@/lib/harness/executionRouting/executionCapabilityTypes";
import { buildExecutionRoutingPlan } from "@/lib/harness/executionRouting/buildExecutionRoutingPlan";
import type { ExecutionRoutingSafetyReport } from "@/lib/harness/executionRouting/executionRoutingSafetyTypes";
import { evaluateExecutionRoutingSafety } from "@/lib/harness/executionRouting/evaluateExecutionRoutingSafety";
import type { ReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";
import { buildReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/buildReviewSecurityHarnessPlan";
import type {
  RemediationLoopPlan,
  ReviewSecurityIssuePlanningReport,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueTypes";
import { buildReviewSecurityIssuePlanningReport } from "@/lib/harness/reviewSecurity/buildReviewSecurityIssuePlanningReport";
import { buildRemediationLoopPlan } from "@/lib/harness/reviewSecurity/buildRemediationLoopPlan";
import {
  buildMemoryRuntimeEntriesFromTimelineMessages,
  extractDirectionalKeywordsFromTimelineMessages,
  pickRecentUserTextFromTimelineMessages,
} from "@/lib/harness/memoryRuntime/internal/timelineMemoryInputs";

export type OverlayPromptTraceIdentityWire = Readonly<{
  roleKey: string;
  perspective: string;
  provider: string;
  capabilities: readonly string[];
}>;

const USED_STAGE_MAX_LEN = 240;

/**
 * SingleChat 오케스트레이션 성공 턴의 `promptTrace`에만 붙는 Overlay 메타(프롬프트 본문·라우팅 비변경).
 */
export function buildOrchestrationOverlayPromptTraceAugments(input: {
  readonly workspaceScreenKey: string;
  readonly timelineStage: string;
  readonly meta: SingleChatOrchestrationTurnMeta;
  readonly projectId?: string | null;
  /** 선택: budget metadata용 실제 프롬프트 길이(가장 정확). */
  readonly promptLength?: number;
  /** 선택: `promptLength`가 없을 때 fallback heuristic으로 사용할 프롬프트 본문. */
  readonly promptText?: string | null;
  /** 선택: conflict 키워드 휴리스틱 입력(user/assistant/bootstrap/orchestration 메시지 등). */
  readonly timelineMessages?: readonly (string | null | undefined)[];
}): Readonly<{
  overlayIdentity?: OverlayPromptTraceIdentityWire;
  overlayContextAssembly: PromptAssemblyMetadataContract;
  overlayKnowledgeActivationHints: readonly ActiveKnowledgePackRef[];
  overlayPolicyHints: OverlayRuntimePolicyHintsWire;
  overlayPolicyWarnings: readonly OverlayPolicyWarning[];
  overlaySelectedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayPrioritizedContextRefs?: readonly OverlaySelectedContextRef[];
  overlayContextBudget?: OverlayContextBudgetMetadata;
  overlayOrchestrationDecisionTrace?: OverlayOrchestrationDecisionTrace;
  overlayConflictWarnings?: readonly OverlayConflictWarning[];
  overlayContextAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
  overlayPruningCandidates?: readonly OverlayPruningCandidate[];
  overlayPolicyDriftWarnings?: readonly OverlayPolicyWarning[];
  harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
  harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
  knowledgeActivationPlan?: KnowledgeActivationPlan;
  memoryRuntimePlan?: MemoryRuntimePlan;
  executionRoutingPlan?: ExecutionRoutingPlan;
  executionRoutingSafetyReport?: ExecutionRoutingSafetyReport;
  reviewSecurityHarnessPlan?: ReviewSecurityHarnessPlan;
  reviewSecurityIssuePlanningReport?: ReviewSecurityIssuePlanningReport;
  remediationLoopPlan?: RemediationLoopPlan;
}> {
  const usedRoleRaw = resolveOverlayTurnRoleKey(input.meta);
  const identity = resolveAiIdentityContract(usedRoleRaw);
  const policyRoleKey = identity?.roleKey ?? usedRoleRaw ?? null;
  const overlayPolicyHints = buildOverlayRuntimePolicyHintsWire(policyRoleKey);
  const overlayPolicyWarnings = buildOverlayPolicyWarningsForResolvedRole({
    policyRoleKey,
    source: "singlechat",
    identity,
  });

  if (!shouldEnableOverlayTrace(policyRoleKey)) {
    return {
      overlayPolicyHints,
      overlayContextAssembly: emptyPromptAssemblyMetadata(),
      overlayKnowledgeActivationHints: [],
      overlayPolicyWarnings,
    };
  }

  const overlayIdentity = buildOverlayPromptTraceIdentity(identity, usedRoleRaw);
  const overlayKnowledgeActivationHints = shouldEnableKnowledgeHints(policyRoleKey)
    ? resolveKnowledgeActivationHintsForRole({
        roleKey: identity?.roleKey ?? usedRoleRaw,
        projectId: input.projectId,
      })
    : [];

  const overlayContextAssembly = buildOverlayPromptTraceContextAssembly({
    policyRoleKey,
    usedRoleRaw,
    identity,
    workspaceScreenKey: input.workspaceScreenKey,
    timelineStage: input.timelineStage,
    knowledgeHints: overlayKnowledgeActivationHints,
  });

  const overlaySelectedContextRefs = buildOverlayPromptTraceSelectionRefs({
    identity,
    usedRoleRaw,
    workspaceScreenKey: input.workspaceScreenKey,
    knowledgeHints: overlayKnowledgeActivationHints,
  });

  const overlayContextBudget = buildOverlayContextBudgetMetadata({
    promptLength: resolveOverlayBudgetPromptLength({
      promptLength: input.promptLength,
      promptText: input.promptText,
      fallbackPayload: { meta: input.meta, refs: overlaySelectedContextRefs },
    }),
    selectedContextCount: overlaySelectedContextRefs.length,
  });

  const overlayOrchestrationDecisionTrace = buildOverlayPromptTraceDecisionTrace({
    identity,
    usedRoleRaw,
  });

  const overlayConflictWarnings = buildOverlayPromptTraceConflictWarnings(input.timelineMessages);

  const overlayPrioritizedContextRefs = prioritizeOverlayContexts({
    contexts: overlaySelectedContextRefs,
    budgetPolicy: overlayContextBudget.budgetPolicy,
  });

  const overlayContextAssemblyPlan = buildOverlayContextAssemblyPlan({
    selectedContextRefs: overlayPrioritizedContextRefs,
    budgetMetadata: overlayContextBudget,
  });
  const overlayPruningCandidates = suggestOverlayPruningCandidates({
    assemblyPlan: overlayContextAssemblyPlan,
    overflowRisk: overlayContextBudget.overflowRisk,
  });
  const overlayPolicyDriftWarnings = detectOverlayPolicyDrift({
    assemblyPlan: overlayContextAssemblyPlan,
    budgetMetadata: overlayContextBudget,
  });

  // Harness Phase H1 — Controlled prompt assembly preview (dry-run only).
  // 실제 prompt payload·OpenAI 호출과 무관. 위에서 이미 계산한 overlay metadata만 입력으로 사용.
  const harnessPromptAssemblyPreview = buildHarnessPromptAssemblyPreview({
    overlayAssemblyPlan: overlayContextAssemblyPlan,
    overlayPrioritizedContextRefs,
    overlayContextBudget,
    overlayIdentity,
    existingPromptText: input.promptText ?? null,
  });
  const harnessPromptPreviewDiff = compareHarnessPromptPreview({
    existingPromptText: input.promptText ?? null,
    preview: harnessPromptAssemblyPreview,
  });

  // Harness Phase H3 — Role-aware Knowledge Activation Plan (dry-run only).
  // role/stage/taskType + 기존 overlay hints를 입력으로 "어떤 지식팩이 왜 후보인지" planning.
  // **실제 retrieval 없음.** 위에서 계산한 overlay metadata와 meta hint만 사용.
  const knowledgeActivationPlan = buildKnowledgeActivationPlan({
    roleKey: overlayIdentity?.roleKey ?? usedRoleRaw ?? null,
    workspaceStage: input.timelineStage,
    taskType: deriveKnowledgeActivationTaskTypeFromMeta({
      decisionAxis: input.meta.decisionAxis ?? null,
      roleKey: overlayIdentity?.roleKey ?? usedRoleRaw ?? null,
      workspaceStage: input.timelineStage,
    }),
    existingHints: overlayKnowledgeActivationHints,
  });

  // Harness Phase H4 Preparation — Memory Runtime Plan (dry-run only).
  // 이번 turn의 역할·overlay·timeline messages를 입력으로 "참조 후보 메모리"를 planning.
  // **실제 retrieval/injection 없음.** 위에서 계산한 overlay metadata와 입력만 사용.
  const memoryRuntimePlan = buildMemoryRuntimePlan({
    roleKey: overlayIdentity?.roleKey ?? usedRoleRaw ?? null,
    projectContext: {
      projectId: input.projectId ?? null,
      directionalKeywords: extractDirectionalKeywordsFromTimelineMessages(input.timelineMessages),
    },
    recentTimelineEntries: buildMemoryRuntimeEntriesFromTimelineMessages(input.timelineMessages),
    workingContext: {
      workspaceScreenKey: input.workspaceScreenKey,
      recentUserText: pickRecentUserTextFromTimelineMessages(input.timelineMessages),
    },
    overlayMetadata: { overlayContextAssembly },
  });

  // Harness Phase H5 Preparation — Execution Routing Plan (dry-run only).
  // 이번 turn의 역할만 입력으로 "어떤 capability를 어느 provider로 처리할지"를 planning.
  // provider hint는 이후 단계에서 외부 orchestration이 명시할 때만 주입한다(기본 식별자
  // provider를 일률 hint로 쓰면 모든 developer turn이 unsupported로 표시되어 노이즈가 됨).
  // **실제 provider switching·Cursor execution·GitHub operation 영향 없음.**
  const executionRoutingPlan = buildExecutionRoutingPlan({
    roleKey: overlayIdentity?.roleKey ?? usedRoleRaw ?? null,
    workspaceStage: input.timelineStage ?? null,
  });

  // Harness Phase H5.5 — Execution Routing Safety Report (dry-run safety diagnostic only).
  // 위에서 만든 plan을 입력으로 safety status / disabled·warning rate / 민감 capability 진단을 생성.
  // **여전히 어떤 자동 차단·routing·execution도 발생하지 않음(타입 시스템에서 false 고정).**
  const executionRoutingSafetyReport = evaluateExecutionRoutingSafety({
    plan: executionRoutingPlan,
  });

  // Harness Phase H6 — Review / Security Harness Plan (dry-run review-security planning only).
  // 위에서 만든 H3 / H4 / H5 plan을 입력으로 "AI검수자/AI보안관이 어떤 기준으로 검토해야 하는가"를
  // checklist planning metadata로 만든다. **실제 보안 스캔·코드 리뷰·이슈 등록·머지 차단 없음.**
  const reviewSecurityHarnessPlan = buildReviewSecurityHarnessPlan({
    roleKey: overlayIdentity?.roleKey ?? usedRoleRaw ?? null,
    workspaceStage: input.timelineStage ?? null,
    executionRoutingPlan,
    knowledgeActivationPlan,
    memoryRuntimePlan,
  });

  // Harness Phase H6.5 — Review/Security Issue Planning Report (dry-run issue planning only).
  // H6 checklist + H5.5 safety + H4 stale memory를 입력으로 "조치 가능한 issue 후보"와 진단을 만든다.
  // **여전히 실제 이슈 등록·머지 차단·remediation 자동 실행은 발생하지 않음.**
  const reviewSecurityIssuePlanningReport = buildReviewSecurityIssuePlanningReport({
    reviewSecurityHarnessPlan,
    executionRoutingSafetyReport,
    knowledgeActivationPlan,
    memoryRuntimePlan,
  });

  // Harness Phase H6.5 — Remediation Loop Plan (dry-run remediation loop only).
  // 위 issue report를 입력으로 "검토 → 조치 요청 → 조치 → 재점검 → 최종 검토" 흐름을 dry-run plan으로 표현.
  // **실제 task 생성·assignment·Cursor execution 없음.**
  const remediationLoopPlan = buildRemediationLoopPlan({
    issuePlanningReport: reviewSecurityIssuePlanningReport,
  });

  return {
    overlayIdentity,
    overlayContextAssembly,
    overlayKnowledgeActivationHints,
    overlayPolicyHints,
    overlayPolicyWarnings,
    ...(overlaySelectedContextRefs.length ? { overlaySelectedContextRefs } : {}),
    ...(overlayPrioritizedContextRefs.length ? { overlayPrioritizedContextRefs } : {}),
    overlayContextBudget,
    ...(overlayOrchestrationDecisionTrace ? { overlayOrchestrationDecisionTrace } : {}),
    ...(overlayConflictWarnings.length ? { overlayConflictWarnings } : {}),
    ...(overlayContextAssemblyPlan.length ? { overlayContextAssemblyPlan } : {}),
    ...(overlayPruningCandidates.length ? { overlayPruningCandidates } : {}),
    ...(overlayPolicyDriftWarnings.length ? { overlayPolicyDriftWarnings } : {}),
    harnessPromptAssemblyPreview,
    harnessPromptPreviewDiff,
    knowledgeActivationPlan,
    memoryRuntimePlan,
    executionRoutingPlan,
    executionRoutingSafetyReport,
    reviewSecurityHarnessPlan,
    reviewSecurityIssuePlanningReport,
    remediationLoopPlan,
  };
}


/** orchestration turn meta에서 가장 신뢰도 높은 role 키를 우선순위대로 선택한다. */
function resolveOverlayTurnRoleKey(meta: SingleChatOrchestrationTurnMeta): string | null {
  const candidates: readonly (string | null | undefined)[] = [
    meta.questionGeneratedBy,
    meta.orchestratorAgent,
    meta.activeConversationOwner,
    meta.conversationOwner,
  ];
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return null;
}

function buildOverlayPromptTraceIdentity(
  identity: AiIdentityContract | null | undefined,
  usedRoleRaw: string | null
): OverlayPromptTraceIdentityWire | undefined {
  if (identity) {
    return {
      roleKey: identity.roleKey,
      perspective: identity.perspective,
      provider: identity.provider,
      capabilities: [...identity.capabilities],
    };
  }
  if (usedRoleRaw) {
    return {
      roleKey: usedRoleRaw,
      perspective: "unknown",
      provider: "unknown",
      capabilities: [],
    };
  }
  return undefined;
}

function buildOverlayPromptTraceContextAssembly(input: {
  readonly policyRoleKey: string | null;
  readonly usedRoleRaw: string | null;
  readonly identity: AiIdentityContract | null | undefined;
  readonly workspaceScreenKey: string;
  readonly timelineStage: string;
  readonly knowledgeHints: readonly ActiveKnowledgePackRef[];
}): PromptAssemblyMetadataContract {
  if (!shouldEnableContextAssembly(input.policyRoleKey)) {
    return emptyPromptAssemblyMetadata();
  }
  return {
    usedRole: input.usedRoleRaw ?? input.identity?.roleKey ?? null,
    usedMemoryRefs: [
      buildPromptAssemblyMemoryRef("singleChatOrchestrationV1", "singleChatOrchestrationV1"),
      buildPromptAssemblyMemoryRef("ChatMessage", "dialogueExcerpt"),
    ],
    usedKnowledgePacks: input.knowledgeHints.map((h) => h.knowledgePackId),
    usedStage: `${input.workspaceScreenKey} · ${input.timelineStage}`.slice(0, USED_STAGE_MAX_LEN),
    tokenBudgetHint: "not_measured",
  };
}

function buildOverlayPromptTraceSelectionRefs(input: {
  readonly identity: AiIdentityContract | null | undefined;
  readonly usedRoleRaw: string | null;
  readonly workspaceScreenKey: string;
  readonly knowledgeHints: readonly ActiveKnowledgePackRef[];
}): readonly OverlaySelectedContextRef[] {
  return buildOverlaySelectedContextRefs({
    roleKey: input.identity?.roleKey ?? input.usedRoleRaw ?? null,
    memoryScopes: input.identity ? [...input.identity.memoryScopes] : [],
    knowledgeHints: input.knowledgeHints.map((h) => h.knowledgePackId),
    timelineEnabled: true,
    workspaceScreenKey: input.workspaceScreenKey,
    policyHintSource: input.identity?.roleKey ?? null,
  });
}

function buildOverlayPromptTraceDecisionTrace(input: {
  readonly identity: AiIdentityContract | null | undefined;
  readonly usedRoleRaw: string | null;
}): OverlayOrchestrationDecisionTrace | undefined {
  if (!input.identity) return undefined;
  return buildOverlayOrchestrationDecisionTrace({
    roleKey: input.identity.roleKey,
    capabilities: [...input.identity.capabilities],
    knowledgeScopes: [...input.identity.knowledgeScopes],
    selectionReason:
      input.usedRoleRaw === input.identity.roleKey ? "role_resolved" : "role_resolved_via_meta",
  });
}

function buildOverlayPromptTraceConflictWarnings(
  rawMessages: readonly (string | null | undefined)[] | undefined
): readonly OverlayConflictWarning[] {
  const cleaned = (rawMessages ?? [])
    .map((m) => (typeof m === "string" ? m : ""))
    .filter((m) => m.length > 0);
  if (!cleaned.length) return [];
  return detectOverlayConflicts({ timelineMessages: cleaned });
}

/**
 * Context budget metadata용 프롬프트 길이를 안전하게 산출한다.
 *
 * 우선순위:
 * 1. 명시된 `promptLength`(가장 정확).
 * 2. `promptText.length` (실제 직렬화된 프롬프트 본문 길이).
 * 3. `JSON.stringify({ meta, refs })` 길이(휴리스틱 fallback).
 *
 * **실제 토큰 카운팅이 아니다.** OpenAI payload·라우팅 비변경. budget metadata 생성만을 위함.
 */
function resolveOverlayBudgetPromptLength(input: {
  readonly promptLength?: number;
  readonly promptText?: string | null;
  readonly fallbackPayload: { readonly meta: unknown; readonly refs: readonly OverlaySelectedContextRef[] };
}): number {
  if (typeof input.promptLength === "number" && Number.isFinite(input.promptLength) && input.promptLength > 0) {
    return Math.floor(input.promptLength);
  }
  const promptTextLen = typeof input.promptText === "string" ? input.promptText.length : 0;
  if (promptTextLen > 0) return promptTextLen;
  try {
    return JSON.stringify(input.fallbackPayload).length;
  } catch {
    return 0;
  }
}
