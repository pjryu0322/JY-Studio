import type { ProjectSingleChatStageIntent } from "@/lib/requirements/singleChatStageRouter";
import type { ServiceFlowSubIntent } from "@/lib/requirements/serviceFlowSubIntent";
import {
  buildPreProjectPlanningSummaryFromWorkspaceState,
  buildPreProjectPlanningSummarySeedPromptTrace,
} from "@/lib/requirements/preProjectPlanningSummary";
import type {
  RequirementsPromptTimelineEntry,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import {
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  mergeOrchestrationSlotPatches,
  singleChatOrchestrationStatusCounts,
  singleChatOrchestrationWeightedProgress,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type PreProjectInitialProposalActionId =
  | "DEFINE_ACTORS"
  | "DRAFT_SERVICE_FLOW"
  | "PLAN_SCREENS"
  | "PLAN_FEATURES";

export type PreProjectInitialProposalAction = Readonly<{
  readonly id: PreProjectInitialProposalActionId;
  readonly label: string;
  readonly stageIntent: ProjectSingleChatStageIntent;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent;
}>;

export type PreProjectInterviewSuggestionActionMeta = Readonly<{
  readonly label: string;
  readonly stageIntent: ProjectSingleChatStageIntent;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent;
}>;

export type InitialProposalSuggestionPickWire = Readonly<{
  readonly kind: "initial_proposal_action";
  readonly label: string;
  readonly stageIntent: ProjectSingleChatStageIntent;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent;
}>;

export const DEFAULT_PRE_PROJECT_INITIAL_PROPOSAL_ACTIONS: readonly PreProjectInitialProposalAction[] =
  [
    {
      id: "DEFINE_ACTORS",
      label: "액터부터 정의하기",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "actor_definition",
    },
    {
      id: "DRAFT_SERVICE_FLOW",
      label: "서비스 흐름 초안 만들기",
      stageIntent: "service_flow",
      serviceFlowSubIntent: "flow_draft",
    },
    {
      id: "PLAN_SCREENS",
      label: "화면 구성부터 보기",
      stageIntent: "screen_planning",
    },
    {
      id: "PLAN_FEATURES",
      label: "MVP 기능 범위 정리하기",
      stageIntent: "feature_planning",
    },
  ] as const;

const INITIAL_PROPOSAL_ACTION_BY_LABEL = new Map(
  DEFAULT_PRE_PROJECT_INITIAL_PROPOSAL_ACTIONS.map((a) => [a.label, a]),
);

function slotKeyEndingWith(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): string | null {
  const hit = definitions.find((d) => d.slotKey.endsWith(suffix));
  return hit?.slotKey ?? null;
}

function splitLines(text: string | null | undefined, max = 8): string[] {
  const lines = String(text ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) bullets.push(line.slice(2).trim());
    else if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, "").trim());
    else bullets.push(line);
    if (bullets.length >= max) break;
  }
  return bullets.slice(0, max);
}

function firstMeaningfulSentence(text: string): string {
  const t = String(text ?? "").trim();
  if (!t) return "";
  const parts = t.split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return (parts[0] ?? t).slice(0, 400);
}

function buildSeedPatches(input: {
  readonly projectDescription?: string | null;
  readonly state: RequirementsStateJson;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): SlotPatchInput[] {
  const description =
    String(input.projectDescription ?? "").trim() ||
    String(input.state.originalProjectDescription ?? "").trim();
  const draft = String(input.state.lastUserDraftText ?? "").trim();
  const priorityLines = splitLines(input.state.priorityFeatures, 8);
  const patches: SlotPatchInput[] = [];

  const purposeKey = slotKeyEndingWith(input.definitions, ".planning.servicePurpose");
  const problemKey = slotKeyEndingWith(input.definitions, ".planning.problem");
  const coreValueKey = slotKeyEndingWith(input.definitions, ".planning.coreValue");
  const mvpScopeKey = slotKeyEndingWith(input.definitions, ".planning.mvpScope");
  const coreFeaturesKey = slotKeyEndingWith(input.definitions, ".design.coreFeatures");
  const featurePriorityKey = slotKeyEndingWith(input.definitions, ".design.featurePriority");

  if (purposeKey && description) {
    patches.push({
      slotKey: purposeKey,
      status: "candidate",
      value: firstMeaningfulSentence(description),
      confidence: 0.55,
    });
  }

  if (problemKey && description.length > 40) {
    patches.push({
      slotKey: problemKey,
      status: "candidate",
      value: description.slice(0, 400),
      confidence: 0.45,
    });
  }

  if (coreValueKey) {
    const valueHint =
      draft ||
      (/(부담|효과|가치|줄이|개선)/i.test(description) ? firstMeaningfulSentence(description) : "");
    if (valueHint) {
      patches.push({
        slotKey: coreValueKey,
        status: "candidate",
        value: valueHint.slice(0, 400),
        confidence: 0.5,
      });
    }
  }

  if (mvpScopeKey && (draft || /MVP|범위|1차/i.test(description))) {
    const mvpHint = draft || description;
    if (mvpHint.trim()) {
      patches.push({
        slotKey: mvpScopeKey,
        status: "candidate",
        value: mvpHint.slice(0, 400),
        confidence: 0.4,
      });
    }
  }

  const featuresKey = coreFeaturesKey ?? featurePriorityKey;
  if (featuresKey && priorityLines.length) {
    patches.push({
      slotKey: featuresKey,
      status: "candidate",
      value: priorityLines.map((l) => `- ${l}`).join("\n").slice(0, 4000),
      confidence: 0.5,
    });
  }

  return patches;
}

export function buildPreProjectSeededSingleChatOrchestration(input: {
  readonly projectName: string;
  readonly projectDescription?: string | null;
  readonly state: RequirementsStateJson;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly existingOrchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly nowIso?: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  if (!input.definitions.length) {
    throw new Error("slot_definitions_required");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const defsHash = hashSlotDefinitions(input.definitions);
  const existing = input.existingOrchestration;
  const base =
    existing && existing.slotDefinitionsHash === defsHash
      ? existing
      : initialOrchestrationStateFromDefinitions(input.definitions, nowIso);

  const patches = buildSeedPatches({
    projectDescription: input.projectDescription,
    state: input.state,
    definitions: input.definitions,
  });

  if (!patches.length) return base;

  return mergeOrchestrationSlotPatches({
    base,
    patches,
    nowIso,
    definitions: input.definitions,
    propagateStaleFromPlanner: false,
  });
}

function slotLine(definitions: readonly SingleChatOrchestrationSlotDefinition[], slotKey: string): string {
  const label = definitions.find((d) => d.slotKey === slotKey)?.label ?? slotKey;
  return label;
}

function formatSlotBullet(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  slotKey: string,
): string | null {
  const row = orchestration.slots[slotKey];
  if (!row) return null;
  const label = slotLine(definitions, slotKey);
  const value = String(row.value ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;
  return `${label}: ${value.slice(0, 420)}`;
}

export function buildPreProjectSingleChatInitialProposalMessage(input: {
  readonly projectName: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): {
  readonly bodyText: string;
  readonly interviewSuggestions: readonly string[];
  readonly quickActions: readonly PreProjectInitialProposalAction[];
} {
  const { orchestration, definitions } = input;
  const nearConfirmed: string[] = [];
  const candidates: string[] = [];
  const todoLabels: string[] = [];

  for (const d of definitions) {
    const row = orchestration.slots[d.slotKey];
    if (!row) continue;
    const st = String(row.status);
    const bullet = formatSlotBullet(definitions, orchestration, d.slotKey);
    if (st === "confirmed" || st === "partial") {
      if (bullet) nearConfirmed.push(bullet);
      else if (st === "partial") nearConfirmed.push(d.label);
    } else if (st === "candidate") {
      if (bullet) candidates.push(bullet);
      else candidates.push(d.label);
    } else if (st === "empty" || st === "stale") {
      todoLabels.push(d.label);
    }
  }

  const flowActorKey = slotKeyEndingWith(definitions, ".flow.actorTypes");
  const flowServiceKey = slotKeyEndingWith(definitions, ".flow.serviceFlow");
  const screensKey = slotKeyEndingWith(definitions, ".design.requiredScreens");

  const actorsEmpty =
    !flowActorKey || !String(orchestration.slots[flowActorKey]?.value ?? "").trim();
  const flowEmpty =
    !flowServiceKey || !String(orchestration.slots[flowServiceKey]?.value ?? "").trim();
  const screensEmpty =
    !screensKey || !String(orchestration.slots[screensKey]?.value ?? "").trim();

  let plannerAdvice =
    "현재는 서비스 아이디어와 핵심 기능 후보는 잡혀 있지만, 액터와 서비스 흐름이 아직 미정입니다. 먼저 AI분석가 관점에서 액터를 정의한 뒤, 그 액터를 기준으로 서비스 흐름을 정리하는 순서가 적절합니다.";
  if (!actorsEmpty && flowEmpty) {
    plannerAdvice =
      "액터 유형은 정리된 상태입니다. 다음으로 액터 간 상호작용을 서비스 흐름 단계로 구체화하면 화면·기능 범위 논의가 수월해집니다.";
  } else if (!flowEmpty && screensEmpty) {
    plannerAdvice =
      "서비스 흐름 초안이 있으면 화면 구성과 MVP 기능 범위를 흐름에 맞춰 좁힐 수 있습니다. 화면 구성 또는 기능 범위 중 하나를 먼저 선택해 진행하세요.";
  } else if (!actorsEmpty && !flowEmpty && screensEmpty) {
    plannerAdvice =
      "기획·흐름 기반 정보가 모였습니다. 필수 화면과 MVP 기능 범위를 맞추면 프로토타입 경계를 정하기 쉽습니다.";
  }

  const priorityTodo = [
    "액터 유형",
    "서비스 흐름",
    "필수 화면",
    "MVP 기능 범위",
    "검수 절차",
  ];
  const todoItems = [
    ...new Set([
      ...todoLabels.filter((l) => priorityTodo.some((p) => l.includes(p) || p.includes(l))),
      ...priorityTodo.filter((p) => todoLabels.some((l) => l.includes(p) || p.includes(l))),
      ...todoLabels,
    ]),
  ].slice(0, 8);

  const parts: string[] = [
    "프로젝트 생성 전 대화를 기준으로 1차 서비스 정의를 정리했습니다.",
    "",
    "확정에 가까운 내용",
    ...(nearConfirmed.length ? nearConfirmed.map((l) => `- ${l}`) : ["- (아직 없음)"]),
    "",
    "후보로 볼 내용",
    ...(candidates.length ? candidates.map((l) => `- ${l}`) : ["- (아직 없음)"]),
    "",
    "아직 정해야 할 것",
    ...(todoItems.length ? todoItems.map((l) => `- ${l}`) : ["- (아직 없음)"]),
    "",
    "AI기획자 제안",
    plannerAdvice,
    "",
    "아래 버튼에서 다음 동작을 선택해 주세요.",
  ];

  return {
    bodyText: parts.join("\n"),
    interviewSuggestions: DEFAULT_PRE_PROJECT_INITIAL_PROPOSAL_ACTIONS.map((a) => a.label),
    quickActions: DEFAULT_PRE_PROJECT_INITIAL_PROPOSAL_ACTIONS,
  };
}

export function resolveInitialProposalQuickReplyAction(
  label: string,
): PreProjectInitialProposalAction | null {
  return INITIAL_PROPOSAL_ACTION_BY_LABEL.get(String(label ?? "").trim()) ?? null;
}

function proposalActionRouterFields(
  action: Pick<PreProjectInitialProposalAction, "stageIntent" | "serviceFlowSubIntent">,
): Pick<InitialProposalSuggestionPickWire, "stageIntent" | "serviceFlowSubIntent"> {
  return {
    stageIntent: action.stageIntent,
    ...(action.serviceFlowSubIntent ? { serviceFlowSubIntent: action.serviceFlowSubIntent } : {}),
  };
}

export function toInterviewSuggestionActionMeta(
  actions: readonly PreProjectInitialProposalAction[],
): readonly PreProjectInterviewSuggestionActionMeta[] {
  return actions.map((a) => ({
    label: a.label,
    ...proposalActionRouterFields(a),
  }));
}

export function isInitialProposalSuggestionPick(
  pick: unknown,
): pick is InitialProposalSuggestionPickWire {
  return (
    typeof pick === "object" &&
    pick !== null &&
    (pick as InitialProposalSuggestionPickWire).kind === "initial_proposal_action"
  );
}

export function initialProposalSuggestionPickFromAction(
  action: PreProjectInitialProposalAction,
): InitialProposalSuggestionPickWire {
  return {
    kind: "initial_proposal_action",
    label: action.label,
    ...proposalActionRouterFields(action),
  };
}

export type PreProjectInitialProposalSeedResult =
  | Readonly<{
      readonly mode: "slot_based";
      readonly bodyText: string;
      readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
      readonly interviewSuggestions: readonly string[];
      readonly interviewSuggestionActions: readonly PreProjectInterviewSuggestionActionMeta[];
      readonly promptTrace: RequirementsPromptTimelineEntry;
    }>
  | Readonly<{
      readonly mode: "legacy";
      readonly bodyText: string;
      readonly promptTrace: RequirementsPromptTimelineEntry;
    }>;

export function buildPreProjectSlotBasedInitialProposalSeedPromptTrace(input: {
  readonly projectId: string;
  readonly regenerated: boolean;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly createdAtIso?: string;
}): RequirementsPromptTimelineEntry {
  const counts = singleChatOrchestrationStatusCounts(input.orchestration);
  const progress = singleChatOrchestrationWeightedProgress(input.orchestration);
  const pid = String(input.projectId ?? "").trim();
  const actionIds = DEFAULT_PRE_PROJECT_INITIAL_PROPOSAL_ACTIONS.map((a) => a.id).join(",");

  return {
    stage: "requirements",
    action: "pre_project_planning_summary_seed",
    aiMember: "AI 기획자",
    source: "platform",
    provider: "platform",
    model: "deterministic",
    responseText: "[platform_seed] type=pre_project_planning_summary mode=slot_based_initial_proposal",
    promptText: [
      "[platform_seed]",
      "type=pre_project_planning_summary",
      "mode=slot_based_initial_proposal",
      "orchestrationSeeded=true",
      `confirmed=${counts.confirmed}`,
      `partial=${counts.partial}`,
      `candidate=${counts.candidate}`,
      `empty=${counts.empty}`,
      `weightedPercent=${progress.percent}`,
      `recommendedActions=${actionIds}`,
      "scope=pre_project",
      "executionScope=pre_project",
      "source=pre_project_chat",
      `regenerated=${input.regenerated}`,
      ...(pid ? [`projectId=${pid}`] : []),
    ].join("\n"),
    createdAt: input.createdAtIso ?? new Date().toISOString(),
    routingDecision: "pre_project_slot_based_initial_proposal_seed",
  };
}

export function safeBuildPreProjectInitialProposalSeed(input: {
  readonly projectName: string;
  readonly projectDescription?: string | null;
  readonly state: RequirementsStateJson;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly existingOrchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly projectId: string;
  readonly regenerated: boolean;
  readonly nowIso?: string;
}): PreProjectInitialProposalSeedResult {
  try {
    const orchestration = buildPreProjectSeededSingleChatOrchestration({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      state: input.state,
      definitions: input.definitions,
      existingOrchestration: input.existingOrchestration,
      nowIso: input.nowIso,
    });
    const proposal = buildPreProjectSingleChatInitialProposalMessage({
      projectName: input.projectName,
      orchestration,
      definitions: input.definitions,
    });
    return {
      mode: "slot_based",
      bodyText: proposal.bodyText,
      orchestration,
      interviewSuggestions: proposal.interviewSuggestions,
      interviewSuggestionActions: toInterviewSuggestionActionMeta(proposal.quickActions),
      promptTrace: buildPreProjectSlotBasedInitialProposalSeedPromptTrace({
        projectId: input.projectId,
        regenerated: input.regenerated,
        orchestration,
        createdAtIso: input.nowIso,
      }),
    };
  } catch {
    return {
      mode: "legacy",
      bodyText: buildPreProjectPlanningSummaryFromWorkspaceState({
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        state: input.state,
      }),
      promptTrace: buildPreProjectPlanningSummarySeedPromptTrace({
        projectId: input.projectId,
        regenerated: input.regenerated,
        createdAtIso: input.nowIso,
      }),
    };
  }
}
