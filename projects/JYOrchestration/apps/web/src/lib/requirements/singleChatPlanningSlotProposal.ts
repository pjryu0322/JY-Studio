/**
 * Project SingleChat — planning / analysis slot action proposals and patches.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildSlotAwareQuickReplyWires,
  decideSingleChatSlotNextAction,
  findOrchestrationSlotKeysBySuffix,
  findSlotRow,
} from "@/lib/requirements/singleChatSlotNextAction";
import { serviceDefinitionSlotPathLabel } from "@/lib/requirements/servicePlanningUserLabels";
import {
  PLANNING_FOLLOWUP_SLOT_ACTION_WIRES,
  planningCoreSlotKeys,
  slotActionWire,
  type SingleChatSlotActionId,
  type SingleChatSlotActionWire,
} from "@/lib/requirements/singleChatSlotActionTypes";
import {
  projectServiceFlowResultToSingleChatSlots,
} from "@/lib/requirements/singleChatSlotResultProjection";
import type { QuickReplyWire } from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  mergeOrchestrationSlotPatches,
  normalizeSlotStatus,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type SingleChatSlotActionExecutionResult = Readonly<{
  readonly assistantMessage: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly quickReplies: readonly QuickReplyWire[];
  readonly slotDecision: ReturnType<typeof decideSingleChatSlotNextAction>;
}>;

function ensureOrchestration(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  nowIso: string,
): RequirementsSingleChatOrchestrationStateV1 {
  const defsHash = hashSlotDefinitions(definitions);
  if (orchestration?.slotDefinitionsHash === defsHash) return orchestration;
  return initialOrchestrationStateFromDefinitions(definitions, nowIso);
}

function flowContextSnippet(flow: RequirementsServiceFlowV1 | null | undefined): string {
  const actors = (flow?.actors ?? []).map((a) => a.name.trim()).filter(Boolean);
  const steps = [...(flow?.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean);
  const parts: string[] = [];
  if (actors.length) parts.push(`액터: ${actors.join(", ")}`);
  if (steps.length) parts.push(`흐름: ${steps.map((t, i) => `${i + 1}. ${t}`).join(" ")}`);
  return parts.join(" · ");
}

function patchSlots(input: {
  readonly base: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly slotKeys: readonly string[];
  readonly status: SingleChatOrchestrationSlotStatus;
  readonly value: string;
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  const patches = input.slotKeys
    .filter(Boolean)
    .map((slotKey) => ({
      slotKey,
      status: input.status,
      value: input.value.slice(0, 4000),
      confidence: input.status === "partial" ? 0.82 : 0.68,
      derivedFrom: "slot-action-proposal",
    }));
  if (!patches.length) return input.base;
  return mergeOrchestrationSlotPatches({
    base: input.base,
    patches,
    nowIso: input.nowIso,
    definitions: input.definitions,
  });
}

function slotStatusKo(
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  slotKey: string,
): string {
  const st = normalizeSlotStatus(String(findSlotRow(orchestration, slotKey)?.status ?? "empty"));
  if (st === "confirmed") return "확정";
  if (st === "partial") return "부분";
  if (st === "candidate") return "후보";
  return "미정";
}

function buildPlanningCoreProposalText(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly flow: RequirementsServiceFlowV1 | null | undefined;
  readonly purpose: string;
  readonly users: string;
  readonly problem: string;
  readonly outcome: string;
}): string {
  const ctx = flowContextSnippet(input.flow);
  const lines = [
    "AI기획자 제안:",
    "현재 대화와 서비스 흐름 후보를 기준으로 기획 핵심을 다음처럼 정리할 수 있습니다.",
    "",
    "1. 서비스 목적",
    `- ${input.purpose}`,
    "",
    "2. 주 사용자",
    `- ${input.users}`,
    "",
    "3. 핵심 문제",
    `- ${input.problem}`,
    "",
    "4. 기대 효과",
    `- ${input.outcome}`,
  ];
  if (ctx) lines.push("", `참고(흐름 후보): ${ctx}`);
  lines.push(
    "",
    "슬롯 반영 후보:",
    `- ${serviceDefinitionSlotPathLabel("서비스 목적")}: 후보`,
    `- ${serviceDefinitionSlotPathLabel("주 사용자")}: 후보`,
    `- ${serviceDefinitionSlotPathLabel("핵심 문제")}: 후보`,
    `- ${serviceDefinitionSlotPathLabel("기대 효과")}: 후보`,
    "",
    "다음 중 하나를 선택할 수 있습니다.",
    "1. 이 기준으로 반영",
    "2. 일부 수정",
    "3. 다른 방향 보기",
  );
  return lines.join("\n");
}

function inferPlanningDrafts(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly recentMessages?: string;
}): Readonly<{ purpose: string; users: string; problem: string; outcome: string }> {
  const name = String(input.projectName ?? "").trim() || "이 서비스";
  const desc = String(input.projectDescription ?? "").trim();
  const recent = String(input.recentMessages ?? "").trim();
  const blob = `${desc}\n${recent}`.slice(0, 4000);

  const purpose =
    desc.length >= 12
      ? desc.split(/[.!?\n]/)[0]?.trim().slice(0, 200) ||
        `${name}의 핵심 가치를 사용자에게 제공한다.`
      : `${name}의 핵심 가치를 사용자에게 제공한다.`;

  const users =
    /회의|녹취|음성/.test(blob)
      ? "회의록 작성자, 팀 리더, 회의 참석자 중 후속 업무 담당자"
      : "주요 사용자와 운영 담당자";

  const problem =
    /시간|누락|수동|정리/.test(blob)
      ? "후속 업무 정리와 발화·TODO 추출에 시간이 많이 들고 누락이 발생하기 쉽다."
      : "현재 방식으로는 목표 상태를 안정적으로 달성하기 어렵다.";

  const outcome =
    /요약|자동|효율/.test(blob)
      ? "회의록 작성 시간을 줄이고 발화 근거와 TODO를 명확히 관리할 수 있다."
      : "핵심 업무를 더 빠르고 일관되게 처리할 수 있다.";

  return { purpose, users, problem, outcome };
}

export function buildPlanningCoreSlotProposal(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow?: RequirementsServiceFlowV1 | null;
  readonly recentMessages?: string;
  readonly nowIso?: string;
}): SingleChatSlotActionExecutionResult {
  const now = input.nowIso ?? new Date().toISOString();
  let orch = ensureOrchestration(input.orchestration, input.definitions, now);
  const drafts = inferPlanningDrafts(input);

  const purposeKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.servicePurpose")[0];
  const usersKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.coreUsers")[0];
  const problemKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.problem")[0];
  const outcomeKey =
    findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.expectedOutcome")[0] ??
    findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.coreValue")[0];

  orch = patchSlots({
    base: orch,
    definitions: input.definitions,
    slotKeys: [purposeKey, usersKey, problemKey, outcomeKey].filter(Boolean),
    status: "candidate",
    value: "",
    nowIso: now,
  });

  orch = patchSlots({
    base: orch,
    definitions: input.definitions,
    slotKeys: [purposeKey].filter(Boolean),
    status: "candidate",
    value: drafts.purpose,
    nowIso: now,
  });
  orch = patchSlots({
    base: orch,
    definitions: input.definitions,
    slotKeys: [usersKey].filter(Boolean),
    status: "candidate",
    value: drafts.users,
    nowIso: now,
  });
  orch = patchSlots({
    base: orch,
    definitions: input.definitions,
    slotKeys: [problemKey].filter(Boolean),
    status: "candidate",
    value: drafts.problem,
    nowIso: now,
  });
  orch = patchSlots({
    base: orch,
    definitions: input.definitions,
    slotKeys: [outcomeKey].filter(Boolean),
    status: "candidate",
    value: drafts.outcome,
    nowIso: now,
  });

  const assistantMessage = buildPlanningCoreProposalText({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    flow: input.flow,
    ...drafts,
  });

  const slotDecision = decideSingleChatSlotNextAction({
    orchestration: orch,
    definitions: input.definitions,
    flow: input.flow ?? null,
  });

  return {
    assistantMessage,
    orchestration: orch,
    quickReplies: [...PLANNING_FOLLOWUP_SLOT_ACTION_WIRES],
    slotDecision,
  };
}

function buildSingleSlotRefineProposal(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow?: RequirementsServiceFlowV1 | null;
  readonly recentMessages?: string;
  readonly slotSuffix: string;
  readonly sectionTitle: string;
  readonly draftValue: string;
  readonly nowIso?: string;
}): SingleChatSlotActionExecutionResult {
  const now = input.nowIso ?? new Date().toISOString();
  let orch = ensureOrchestration(input.orchestration, input.definitions, now);
  const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, input.slotSuffix)[0];
  if (slotKey) {
    orch = patchSlots({
      base: orch,
      definitions: input.definitions,
      slotKeys: [slotKey],
      status: "candidate",
      value: input.draftValue,
      nowIso: now,
    });
  }

  const statusLine = slotKey ? slotStatusKo(orch, slotKey) : "후보";
  const assistantMessage = [
    "AI기획자 제안:",
    `${input.sectionTitle}을(를) 다음처럼 정리할 수 있습니다.`,
    "",
    `- ${input.draftValue}`,
    "",
    `슬롯 반영 상태: ${input.sectionTitle}: ${statusLine}`,
    "",
    "다음 중 하나를 선택할 수 있습니다.",
    "1. 이 기준으로 반영",
    "2. 일부 수정",
    "3. 다른 방향 보기",
  ].join("\n");

  const slotDecision = decideSingleChatSlotNextAction({
    orchestration: orch,
    definitions: input.definitions,
    flow: input.flow ?? null,
  });

  return {
    assistantMessage,
    orchestration: orch,
    quickReplies: [...PLANNING_FOLLOWUP_SLOT_ACTION_WIRES],
    slotDecision,
  };
}

export function applyPlanningSlotProposal(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow?: RequirementsServiceFlowV1 | null;
  readonly nowIso?: string;
}): SingleChatSlotActionExecutionResult {
  const now = input.nowIso ?? new Date().toISOString();
  let orch = ensureOrchestration(input.orchestration, input.definitions, now);
  const keys = planningCoreSlotKeys(input.definitions);
  orch = patchSlots({
    base: orch,
    definitions: input.definitions,
    slotKeys: keys,
    status: "partial",
    value: "",
    nowIso: now,
  });
  for (const key of keys) {
    const row = findSlotRow(orch, key);
    if (!row) continue;
    const v = String(row.value ?? "").trim();
    if (v.length >= 4) {
      orch = patchSlots({
        base: orch,
        definitions: input.definitions,
        slotKeys: [key],
        status: "partial",
        value: v,
        nowIso: now,
      });
    }
  }

  const slotDecision = decideSingleChatSlotNextAction({
    orchestration: orch,
    definitions: input.definitions,
    flow: input.flow ?? null,
  });

  return {
    assistantMessage:
      "AI기획자 제안:\n제안한 기획 핵심을 슬롯에 부분 반영했습니다. 이어서 분석·기능 범위 단계로 진행할 수 있습니다.",
    orchestration: orch,
    quickReplies: slotDecision.quickReplies.map((label) => label),
    slotDecision,
  };
}

export function executeSingleChatSlotAction(input: {
  readonly slotAction: SingleChatSlotActionWire;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow?: RequirementsServiceFlowV1 | null;
  readonly recentMessages?: string;
  readonly nowIso?: string;
}): SingleChatSlotActionExecutionResult {
  const drafts = inferPlanningDrafts({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    recentMessages: input.recentMessages,
  });
  const id = input.slotAction.id;

  if (id === "CONFIRM_PLANNING_CORE" || id === "REGENERATE_SLOT_PROPOSAL") {
    return buildPlanningCoreSlotProposal(input);
  }
  if (id === "APPLY_SLOT_PROPOSAL") {
    return applyPlanningSlotProposal(input);
  }
  if (id === "EDIT_SLOT_PROPOSAL") {
    return {
      ...buildPlanningCoreSlotProposal(input),
      assistantMessage:
        "AI기획자 제안:\n어느 항목을 바꿀지 말씀해 주세요. 예: 주 사용자를 '팀 리더' 중심으로 좁혀 주세요.",
    };
  }
  if (id === "REFINE_TARGET_USERS") {
    return buildSingleSlotRefineProposal({
      ...input,
      slotSuffix: ".planning.coreUsers",
      sectionTitle: serviceDefinitionSlotPathLabel("주 사용자"),
      draftValue: drafts.users,
    });
  }
  if (id === "REFINE_CORE_PROBLEM") {
    return buildSingleSlotRefineProposal({
      ...input,
      slotSuffix: ".planning.problem",
      sectionTitle: serviceDefinitionSlotPathLabel("핵심 문제"),
      draftValue: drafts.problem,
    });
  }
  if (id === "REFINE_EXPECTED_OUTCOME") {
    return buildSingleSlotRefineProposal({
      ...input,
      slotSuffix: ".planning.expectedOutcome",
      sectionTitle: serviceDefinitionSlotPathLabel("기대 효과"),
      draftValue: drafts.outcome,
    });
  }
  if (id === "REFINE_SERVICE_FLOW" && input.flow) {
    const now = input.nowIso ?? new Date().toISOString();
    let orch = ensureOrchestration(input.orchestration, input.definitions, now);
    const projected =
      projectServiceFlowResultToSingleChatSlots({
        orchestration: orch,
        definitions: input.definitions,
        flow: input.flow,
        source: "flow_review",
        nowIso: now,
      }) ?? orch;
    const slotDecision = decideSingleChatSlotNextAction({
      orchestration: projected,
      definitions: input.definitions,
      flow: input.flow,
    });
    return {
      assistantMessage:
        "AI분석가 제안:\n서비스 흐름 후보를 분석 슬롯에 반영했습니다. 기획 핵심이 부족하면 먼저 정리하는 것이 좋습니다.",
      orchestration: projected,
      quickReplies: buildSlotAwareQuickReplyWires({
        conversationQuickReplies: [],
        decision: slotDecision,
      }),
      slotDecision,
    };
  }

  return buildPlanningCoreSlotProposal(input);
}
