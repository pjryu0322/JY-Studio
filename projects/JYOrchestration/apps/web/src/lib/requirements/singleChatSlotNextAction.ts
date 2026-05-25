/**
 * Project SingleChat — slot-orchestrated next action (overrides service-flow-only quick replies).
 */

import { serviceFlowHasMinimumDraftForApply } from "@/lib/requirements/serviceFlowAdviceApplyMode";
import { resolveServiceFlowConversationState } from "@/lib/requirements/serviceFlowConversationState";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  isPlannerStableEnough,
  normalizeSlotStatus,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type { QuickReplyWire } from "@/lib/requirements/requirementsQuickActionRegistry";
import {
  resolveSlotActionIdFromLabel,
  SLOT_ACTION_DEFAULT_LABEL,
  slotActionWire,
  type SingleChatSlotActionWire,
} from "@/lib/requirements/singleChatSlotActionTypes";
import {
  SERVICE_DEFINITION_AREA_LABEL,
  SERVICE_PLANNING_TEAM_AREAS_PHRASE,
  serviceDefinitionSlotPathLabel,
} from "@/lib/requirements/servicePlanningUserLabels";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotV1,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type SingleChatSlotFocusArea =
  | "planning"
  | "analysis"
  | "architecture"
  | "design"
  | "review"
  | "generation";

export type SingleChatRecommendedOwnerAgent =
  | "planner"
  | "analyst"
  | "architect"
  | "designer"
  | "reviewer"
  | "security";

export type SingleChatSlotNextActionId =
  | "CONFIRM_PLANNING_CORE"
  | "REFINE_TARGET_USERS"
  | "DEFINE_SERVICE_ACTORS"
  | "REFINE_SERVICE_FLOW"
  | "DEFINE_FEATURE_SCOPE"
  | "DEFINE_SCREEN_STRUCTURE"
  | "REVIEW_GAPS"
  | "PREPARE_GENERATION";

export type SingleChatSlotNextActionDecision = Readonly<{
  readonly focusArea: SingleChatSlotFocusArea;
  readonly ownerAgent: SingleChatRecommendedOwnerAgent;
  readonly missingSlotKeys: readonly string[];
  readonly candidateSlotKeys: readonly string[];
  readonly partialSlotKeys: readonly string[];
  readonly recommendedActionId: SingleChatSlotNextActionId;
  readonly recommendedLabel: string;
  readonly assistantLeadText: string;
  readonly quickReplies: readonly string[];
  readonly slotActions: readonly SingleChatSlotActionWire[];
  readonly shouldSuppressFlowApprove: boolean;
}>;

function attachSlotActions(
  decision: Omit<SingleChatSlotNextActionDecision, "slotActions">,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): SingleChatSlotNextActionDecision {
  const slotActions = buildSlotActionsForDecision(decision, definitions);
  return { ...decision, slotActions };
}

export function buildSlotActionsForDecision(
  decision: Pick<
    SingleChatSlotNextActionDecision,
    "focusArea" | "ownerAgent" | "quickReplies" | "recommendedActionId"
  >,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): readonly SingleChatSlotActionWire[] {
  if (decision.focusArea === "planning") {
    const wires: SingleChatSlotActionWire[] = [];
    for (const label of decision.quickReplies) {
      const id = resolveSlotActionIdFromLabel(label);
      if (!id) continue;
      wires.push(
        slotActionWire({
          id,
          label,
          definitions,
          focusArea: "planning",
          ownerAgent: "planner",
        }),
      );
    }
    return wires;
  }
  if (decision.focusArea === "analysis") {
    const out: SingleChatSlotActionWire[] = [];
    if (decision.quickReplies.includes("분석 슬롯에 반영")) {
      out.push(
        slotActionWire({
          id: "REFINE_SERVICE_FLOW",
          definitions,
          focusArea: "analysis",
          ownerAgent: "analyst",
        }),
      );
    }
    if (decision.quickReplies.includes("흐름 보완")) {
      out.push(
        slotActionWire({
          id: "REFINE_SERVICE_FLOW",
          label: "흐름 보완",
          definitions,
          focusArea: "analysis",
          ownerAgent: "analyst",
        }),
      );
    }
    if (decision.quickReplies.includes(SLOT_ACTION_DEFAULT_LABEL.CONFIRM_PLANNING_CORE)) {
      out.push(
        slotActionWire({
          id: "CONFIRM_PLANNING_CORE",
          definitions,
          focusArea: "planning",
          ownerAgent: "planner",
        }),
      );
    }
    return out;
  }
  if (decision.focusArea === "architecture" || decision.focusArea === "design") {
    return decision.quickReplies
      .map((label) => {
        if (label === "기능 범위 정리" || label === "MVP 기능 정리") {
          return slotActionWire({
            id: "DEFINE_FEATURE_SCOPE",
            label,
            definitions,
            focusArea: "architecture",
            ownerAgent: "architect",
          });
        }
        if (label === "화면 구성 보기") {
          return slotActionWire({
            id: "DEFINE_SCREEN_STRUCTURE",
            label,
            definitions,
            focusArea: "design",
            ownerAgent: "designer",
          });
        }
        return null;
      })
      .filter((x): x is SingleChatSlotActionWire => Boolean(x));
  }
  return [];
}

const PLANNING_CORE_SUFFIXES = [
  ".planning.servicePurpose",
  ".planning.problem",
  ".planning.coreUsers",
  ".planning.expectedOutcome",
] as const;

const ANALYSIS_FLOW_SUFFIXES = [".flow.actorTypes", ".flow.serviceFlow", ".flow.approvalFlow"] as const;

const ARCHITECTURE_SUFFIXES = [".design.coreFeatures", ".design.featurePriority"] as const;

const DESIGN_SUFFIXES = [".design.requiredScreens"] as const;

export type GenerationReadinessFromSlots = Readonly<{
  readonly ready: boolean;
  readonly missing: readonly string[];
}>;

export const GENERATION_READINESS_SLOT_LABELS = [
  "서비스 아이디어",
  "주 사용자",
  "핵심 문제",
  "기대 효과",
] as const;

const GENERATION_SLOT_SUFFIX_TO_LABEL: Readonly<Record<string, string>> = {
  ".planning.servicePurpose": "서비스 아이디어",
  ".planning.coreUsers": "주 사용자",
  ".planning.problem": "핵심 문제",
  ".planning.expectedOutcome": "기대 효과",
  ".planning.coreValue": "기대 효과",
};

export function findOrchestrationSlotKeysBySuffix(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): readonly string[] {
  const s = String(suffix ?? "").trim();
  return definitions.filter((d) => d.slotKey.endsWith(s)).map((d) => d.slotKey);
}

export function findSlotRow(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  slotKey: string,
): SingleChatOrchestrationSlotV1 | null {
  if (!orchestration?.slots) return null;
  return orchestration.slots[slotKey] ?? null;
}

function slotFillLevel(row: SingleChatOrchestrationSlotV1 | null): "empty" | "candidate" | "partial" | "confirmed" {
  if (!row) return "empty";
  const v = String(row.value ?? "").trim();
  const st = normalizeSlotStatus(String(row.status));
  if (st === "confirmed" && v.length >= 8) return "confirmed";
  if (st === "partial" && v.length >= 8) return "partial";
  if ((st === "candidate" || st === "partial") && v.length >= 4) return "candidate";
  return "empty";
}

function isAtLeastPartial(level: ReturnType<typeof slotFillLevel>): boolean {
  return level === "partial" || level === "confirmed";
}

function resolvePlanningCoreKeys(definitions: readonly SingleChatOrchestrationSlotDefinition[]): string[] {
  const keys: string[] = [];
  for (const suffix of PLANNING_CORE_SUFFIXES) {
    keys.push(...findOrchestrationSlotKeysBySuffix(definitions, suffix));
  }
  const purpose = findOrchestrationSlotKeysBySuffix(definitions, ".planning.servicePurpose")[0];
  const problem = findOrchestrationSlotKeysBySuffix(definitions, ".planning.problem")[0];
  const users = findOrchestrationSlotKeysBySuffix(definitions, ".planning.coreUsers")[0];
  const outcome =
    findOrchestrationSlotKeysBySuffix(definitions, ".planning.expectedOutcome")[0] ??
    findOrchestrationSlotKeysBySuffix(definitions, ".planning.coreValue")[0];
  return [purpose, problem, users, outcome].filter((k): k is string => Boolean(k));
}

export function evaluatePlanningCoreReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): Readonly<{ readonly adequate: boolean; readonly missingLabels: readonly string[] }> {
  const coreKeys = resolvePlanningCoreKeys(input.definitions);
  const missingLabels: string[] = [];
  let partialCount = 0;

  for (const key of coreKeys) {
    const def = input.definitions.find((d) => d.slotKey === key);
    const level = slotFillLevel(findSlotRow(input.orchestration, key));
    if (isAtLeastPartial(level)) {
      partialCount += 1;
      continue;
    }
    const label =
      GENERATION_SLOT_SUFFIX_TO_LABEL[
        Object.keys(GENERATION_SLOT_SUFFIX_TO_LABEL).find((s) => key.endsWith(s)) ?? ""
      ] ?? def?.label ?? key;
    missingLabels.push(label);
  }

  const purposeKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.servicePurpose")[0];
  const purposeOk = purposeKey ? isAtLeastPartial(slotFillLevel(findSlotRow(input.orchestration, purposeKey))) : false;

  return {
    adequate: partialCount >= 2 && purposeOk,
    missingLabels,
  };
}

export function evaluateAnalysisFlowReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): boolean {
  const flowKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".flow.serviceFlow")[0];
  if (!flowKey) return false;
  const level = slotFillLevel(findSlotRow(input.orchestration, flowKey));
  return level === "candidate" || level === "partial" || level === "confirmed";
}

export function evaluateGenerationReadinessFromSlots(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): GenerationReadinessFromSlots {
  const missing: string[] = [];
  for (const suffix of [
    ".planning.servicePurpose",
    ".planning.coreUsers",
    ".planning.problem",
    ".planning.expectedOutcome",
  ]) {
    const key = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0];
    if (!key) continue;
    const level = slotFillLevel(findSlotRow(input.orchestration, key));
    if (!isAtLeastPartial(level)) {
      missing.push(GENERATION_SLOT_SUFFIX_TO_LABEL[suffix] ?? suffix);
    }
  }
  if (!missing.length) {
    const coreValueKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.coreValue")[0];
    if (coreValueKey) {
      const level = slotFillLevel(findSlotRow(input.orchestration, coreValueKey));
      if (!isAtLeastPartial(level)) missing.push("기대 효과");
    }
  }
  return { ready: missing.length === 0, missing };
}

function collectSlotsBySuffixes(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffixes: readonly string[],
): { missing: string[]; candidate: string[]; partial: string[] } {
  const missing: string[] = [];
  const candidate: string[] = [];
  const partial: string[] = [];
  for (const suffix of suffixes) {
    for (const key of findOrchestrationSlotKeysBySuffix(definitions, suffix)) {
      const def = definitions.find((d) => d.slotKey === key);
      const level = slotFillLevel(findSlotRow(orchestration, key));
      if (level === "confirmed" || level === "partial") partial.push(key);
      else if (level === "candidate") candidate.push(key);
      else missing.push(def?.label ?? key);
    }
  }
  return { missing, candidate, partial };
}

function decideSingleChatSlotNextActionCore(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow: RequirementsServiceFlowV1 | null | undefined;
}): Omit<SingleChatSlotNextActionDecision, "slotActions"> {
  const flow = input.flow;
  const conv = flow ? resolveServiceFlowConversationState(flow) : "PROPOSAL";
  const flowReviewable = serviceFlowHasMinimumDraftForApply(flow ?? null);
  const planning = evaluatePlanningCoreReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  const analysisReady = evaluateAnalysisFlowReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });

  const planningSlots = collectSlotsBySuffixes(input.orchestration, input.definitions, PLANNING_CORE_SUFFIXES);
  const analysisSlots = collectSlotsBySuffixes(input.orchestration, input.definitions, ANALYSIS_FLOW_SUFFIXES);
  const archSlots = collectSlotsBySuffixes(input.orchestration, input.definitions, ARCHITECTURE_SUFFIXES);
  const designSlots = collectSlotsBySuffixes(input.orchestration, input.definitions, DESIGN_SUFFIXES);

  const shouldSuppressFlowApprove =
    conv === "REVIEW" && flowReviewable && (!planning.adequate || !analysisReady);

  if (conv === "APPROVED" || flow?.flowApproved) {
    return {
      focusArea: "architecture",
      ownerAgent: "architect",
      missingSlotKeys: archSlots.missing,
      candidateSlotKeys: archSlots.candidate,
      partialSlotKeys: archSlots.partial,
      recommendedActionId: "DEFINE_FEATURE_SCOPE",
      recommendedLabel: "기능 범위 정리",
      assistantLeadText:
        "AI설계자 제안:\n승인된 흐름을 기준으로 기능 범위와 화면 구성을 이어가면 됩니다.",
      quickReplies: ["다음 단계 진행", "세부 기능 정리", "화면 구성 보기"],
      shouldSuppressFlowApprove: true,
    };
  }

  if (!planning.adequate) {
    return {
      focusArea: "planning",
      ownerAgent: "planner",
      missingSlotKeys: planningSlots.missing,
      candidateSlotKeys: planningSlots.candidate,
      partialSlotKeys: planningSlots.partial,
      recommendedActionId: "CONFIRM_PLANNING_CORE",
      recommendedLabel: SLOT_ACTION_DEFAULT_LABEL.CONFIRM_PLANNING_CORE,
      assistantLeadText:
        `AI기획자 제안:\n${SERVICE_DEFINITION_AREA_LABEL} 항목을 먼저 정리한 뒤 흐름을 확정하는 것이 좋습니다.`,
      quickReplies: [
        SLOT_ACTION_DEFAULT_LABEL.CONFIRM_PLANNING_CORE,
        "주 사용자 정리",
        "핵심 문제 정리",
        "흐름 보완",
      ],
      shouldSuppressFlowApprove: true,
    };
  }

  if (!analysisReady && flowReviewable) {
    return {
      focusArea: "analysis",
      ownerAgent: "analyst",
      missingSlotKeys: analysisSlots.missing,
      candidateSlotKeys: analysisSlots.candidate,
      partialSlotKeys: analysisSlots.partial,
      recommendedActionId: "REFINE_SERVICE_FLOW",
      recommendedLabel: "분석 슬롯에 반영",
      assistantLeadText:
        "AI분석가 제안:\n액터·흐름 후보를 분석 슬롯에 반영한 뒤 다음 단계로 이어가세요.",
      quickReplies: ["분석 슬롯에 반영", "흐름 보완", "기능 범위로 이어가기"],
      shouldSuppressFlowApprove: true,
    };
  }

  if (archSlots.missing.length > 0 || archSlots.partial.length + archSlots.candidate.length === 0) {
    return {
      focusArea: "architecture",
      ownerAgent: "architect",
      missingSlotKeys: archSlots.missing,
      candidateSlotKeys: archSlots.candidate,
      partialSlotKeys: archSlots.partial,
      recommendedActionId: "DEFINE_FEATURE_SCOPE",
      recommendedLabel: "기능 범위 정리",
      assistantLeadText: "AI설계자 제안:\n기능 범위와 MVP를 정리할 준비가 되었습니다.",
      quickReplies: ["기능 범위 정리", "MVP 기능 정리", "화면 구성 보기"],
      shouldSuppressFlowApprove: false,
    };
  }

  if (designSlots.missing.length > 2) {
    return {
      focusArea: "design",
      ownerAgent: "designer",
      missingSlotKeys: designSlots.missing,
      candidateSlotKeys: designSlots.candidate,
      partialSlotKeys: designSlots.partial,
      recommendedActionId: "DEFINE_SCREEN_STRUCTURE",
      recommendedLabel: "화면 구성 보기",
      assistantLeadText: "AI디자이너 제안:\n화면 목록과 사용자 동선을 정리할 수 있습니다.",
      quickReplies: ["화면 구성 보기", "기능 범위 정리", "다음 단계 진행"],
      shouldSuppressFlowApprove: false,
    };
  }

  const gen = evaluateGenerationReadinessFromSlots({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });

  if (
    gen.ready &&
    input.orchestration &&
    isPlannerStableEnough(input.orchestration, input.definitions)
  ) {
    return {
      focusArea: "generation",
      ownerAgent: "planner",
      missingSlotKeys: [],
      candidateSlotKeys: [],
      partialSlotKeys: [],
      recommendedActionId: "PREPARE_GENERATION",
      recommendedLabel: "생성 준비",
      assistantLeadText:
        "AI기획자 제안:\n핵심 서비스 정의 항목이 정리되어 구현 준비를 검토할 수 있습니다.",
      quickReplies: ["다음 단계 진행", "세부 기능 정리", "화면 구성 보기"],
      shouldSuppressFlowApprove: false,
    };
  }

  const reviewQuickReplies =
    shouldSuppressFlowApprove
      ? ["분석 슬롯에 반영", "흐름 보완", "기획 핵심 정리"]
      : ["흐름 확정", "단계 수정하기", "기능 범위로 이어가기"];

  return {
    focusArea: "analysis",
    ownerAgent: "analyst",
    missingSlotKeys: analysisSlots.missing,
    candidateSlotKeys: analysisSlots.candidate,
    partialSlotKeys: analysisSlots.partial,
    recommendedActionId: "REFINE_SERVICE_FLOW",
    recommendedLabel: shouldSuppressFlowApprove ? "분석 슬롯에 반영" : "흐름 확정",
    assistantLeadText: shouldSuppressFlowApprove
      ? `AI분석가 제안:\n흐름 후보는 정리되었습니다. 다음은 ${SERVICE_PLANNING_TEAM_AREAS_PHRASE} 항목을 맞춘 뒤 확정하세요.`
      : "AI분석가 제안:\n흐름 검토 후 확정하거나 일부 수정할 수 있습니다.",
    quickReplies: reviewQuickReplies,
    shouldSuppressFlowApprove,
  };
}

export function decideSingleChatSlotNextAction(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly flow: RequirementsServiceFlowV1 | null | undefined;
}): SingleChatSlotNextActionDecision {
  return attachSlotActions(decideSingleChatSlotNextActionCore(input), input.definitions);
}

const FLOW_APPROVE_LABELS = new Set(["흐름 확정", "흐름 승인하기", "그대로 진행"]);

export function buildSlotAwareQuickReplyWires(input: {
  readonly conversationQuickReplies: readonly QuickReplyWire[] | readonly string[];
  readonly decision: Pick<
    SingleChatSlotNextActionDecision,
    "shouldSuppressFlowApprove" | "quickReplies" | "slotActions"
  >;
}): readonly QuickReplyWire[] {
  const out: QuickReplyWire[] = [...input.decision.slotActions];
  const seen = new Set(out.map((w) => (typeof w === "string" ? w : w.label)));

  for (const wire of input.conversationQuickReplies) {
    const label = typeof wire === "string" ? wire.trim() : String(wire.label ?? "").trim();
    if (!label) continue;
    if (input.decision.shouldSuppressFlowApprove && FLOW_APPROVE_LABELS.has(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    if (typeof wire === "string") {
      const slotId = resolveSlotActionIdFromLabel(label);
      if (slotId) continue;
      out.push(label);
    } else if ("kind" in wire && wire.kind === "slot_action") {
      out.push(wire);
    } else {
      out.push(wire);
    }
  }

  for (const label of input.decision.quickReplies) {
    if (seen.has(label)) continue;
    if (input.decision.shouldSuppressFlowApprove && FLOW_APPROVE_LABELS.has(label)) continue;
    const action = input.decision.slotActions.find((a) => a.label === label);
    if (action) {
      out.push(action);
      seen.add(label);
      continue;
    }
    seen.add(label);
    out.push(label);
  }

  return out.slice(0, 6);
}

/** @deprecated string-only — prefer buildSlotAwareQuickReplyWires */
export function buildSlotAwareQuickReplies(input: {
  readonly conversationQuickReplies: readonly string[];
  readonly decision: Pick<SingleChatSlotNextActionDecision, "shouldSuppressFlowApprove" | "quickReplies">;
}): readonly string[] {
  const out: string[] = [...input.decision.quickReplies];
  const seen = new Set(out);

  for (const label of input.conversationQuickReplies) {
    if (input.decision.shouldSuppressFlowApprove && FLOW_APPROVE_LABELS.has(label.trim())) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }

  return out.slice(0, 6);
}

function slotStatusLine(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
  displayLabel: string,
): string | null {
  const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
  if (!key) return null;
  const level = slotFillLevel(findSlotRow(orchestration, key));
  const statusKo =
    level === "confirmed"
      ? "확정"
      : level === "partial"
        ? "부분"
        : level === "candidate"
          ? "후보"
          : "미정";
  return `- ${displayLabel}: ${statusKo}`;
}

export function buildSlotOrchestrationAssistantLead(input: {
  readonly decision: SingleChatSlotNextActionDecision;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): string {
  const lines: string[] = [];
  if (input.decision.ownerAgent === "analyst" || input.decision.focusArea === "analysis") {
    lines.push("AI분석가 제안:");
    lines.push(input.decision.assistantLeadText.replace(/^AI분석가 제안:\n?/, "").trim());
  } else if (input.decision.ownerAgent === "architect") {
    lines.push("AI설계자 제안:");
    lines.push(input.decision.assistantLeadText.replace(/^AI설계자 제안:\n?/, "").trim());
  } else if (input.decision.ownerAgent === "designer") {
    lines.push("AI디자이너 제안:");
    lines.push(input.decision.assistantLeadText.replace(/^AI디자이너 제안:\n?/, "").trim());
  } else {
    lines.push("AI기획자 제안:");
    lines.push(input.decision.assistantLeadText.replace(/^AI기획자 제안:\n?/, "").trim());
  }

  const slotLines = [
    slotStatusLine(input.orchestration, input.definitions, ".flow.actorTypes", "분석 > 서비스 액터"),
    slotStatusLine(input.orchestration, input.definitions, ".flow.serviceFlow", "분석 > 서비스 흐름"),
    slotStatusLine(
      input.orchestration,
      input.definitions,
      ".planning.coreUsers",
      serviceDefinitionSlotPathLabel("주 사용자"),
    ),
    slotStatusLine(
      input.orchestration,
      input.definitions,
      ".planning.problem",
      serviceDefinitionSlotPathLabel("핵심 문제"),
    ),
  ].filter((l): l is string => Boolean(l));

  if (slotLines.length) {
    lines.push("", "슬롯 반영 상태:", ...slotLines);
  }

  if (input.decision.quickReplies.length) {
    lines.push("", "다음 중 하나를 선택할 수 있습니다.", ...input.decision.quickReplies.map((q, i) => `${i + 1}. ${q}`));
  }

  return lines.join("\n");
}

export function appendSlotOrchestrationAssistantLead(input: {
  readonly assistantMessage: string;
  readonly decision: SingleChatSlotNextActionDecision;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly skipWhenTransition?: boolean;
}): string {
  if (input.skipWhenTransition) return input.assistantMessage;
  const base = String(input.assistantMessage ?? "").trim();
  const lead = buildSlotOrchestrationAssistantLead({
    decision: input.decision,
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  if (!lead.trim()) return base;
  if (base.includes("슬롯 반영 상태:")) return base;
  return base ? `${base}\n\n${lead}` : lead;
}
