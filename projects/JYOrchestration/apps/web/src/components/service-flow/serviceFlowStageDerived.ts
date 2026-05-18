import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
  RequirementsServiceFlowChecklistDeferralKind,
} from "@/lib/requirements/requirementsStateJson";
import { REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS } from "@/lib/requirements/requirementsStateJson";

export type ServiceFlowStageSlotKey = (typeof REQUIREMENTS_SERVICE_FLOW_CHECKLIST_KEYS)[number];

export type ServiceFlowDecisionResolution = {
  requiredUnresolved: ServiceFlowStageSlotKey[];
  optionalUnresolved: ServiceFlowStageSlotKey[];
  headerLabel: string;
  headerCount: number;
  helperLine: string | null;
};

export type ServiceFlowStageApprovalState = {
  actorsReady: boolean;
  stepsReady: boolean;
  mapped: boolean;
  approved: boolean;
  ready: boolean;
  slots: Record<ServiceFlowStageSlotKey, boolean>;
  filledSlotCount: number;
  progressPercent: number;
  recommendedMissing: Partial<Record<ServiceFlowStageSlotKey, boolean>>;
};

export const SERVICE_FLOW_STAGE_SLOT_LABELS: Record<ServiceFlowStageSlotKey, string> = {
  humanActors: "사람 액터",
  systemActors: "시스템 액터",
  mainFlow: "주요 흐름",
  actorResponsibility: "단계별 담당",
  approvalStep: "승인/확정 단계",
  exceptionFlow: "예외 흐름",
  accessControl: "권한 범위",
  handoffToFeatures: "기능 후보",
};

export const SERVICE_FLOW_STAGE_REQUIRED_SLOTS: readonly ServiceFlowStageSlotKey[] = [
  "humanActors",
  "systemActors",
  "mainFlow",
  "actorResponsibility",
];
export const SERVICE_FLOW_STAGE_RECOMMENDED_SLOTS: readonly ServiceFlowStageSlotKey[] = ["approvalStep", "exceptionFlow"];
export const SERVICE_FLOW_STAGE_DECISION_SLOTS: readonly ServiceFlowStageSlotKey[] = [
  ...SERVICE_FLOW_STAGE_REQUIRED_SLOTS,
  ...SERVICE_FLOW_STAGE_RECOMMENDED_SLOTS,
];

function stepTitleContainsAny(steps: readonly RequirementsServiceFlowStepV1[], re: RegExp): boolean {
  return steps.some((s) => re.test(String(s.title ?? "").trim()));
}

export function computeServiceFlowDecisionResolution(input: {
  flow: RequirementsServiceFlowV1 | null;
  derivedSlots: Record<ServiceFlowStageSlotKey, boolean>;
  deferrals: Partial<Record<ServiceFlowStageSlotKey, RequirementsServiceFlowChecklistDeferralKind>> | null | undefined;
}): ServiceFlowDecisionResolution {
  const { flow, derivedSlots, deferrals } = input;
  const steps = flow?.steps ?? [];

  const approvalResolved =
    Boolean(deferrals?.approvalStep) ||
    stepTitleContainsAny(steps, /승인|확정|결재/i) ||
    Boolean(derivedSlots.approvalStep);

  const exceptionResolved =
    Boolean(deferrals?.exceptionFlow) ||
    stepTitleContainsAny(steps, /수정|반려|재처리|예외/i) ||
    Boolean(derivedSlots.exceptionFlow);

  const resolved: Record<ServiceFlowStageSlotKey, boolean> = {
    ...derivedSlots,
    approvalStep: approvalResolved,
    exceptionFlow: exceptionResolved,
  };

  const requiredUnresolved = SERVICE_FLOW_STAGE_REQUIRED_SLOTS.filter((k) => !resolved[k] && !deferrals?.[k]);
  const optionalUnresolved = SERVICE_FLOW_STAGE_RECOMMENDED_SLOTS.filter((k) => !resolved[k] && !deferrals?.[k]);

  if (requiredUnresolved.length > 0) {
    return {
      requiredUnresolved,
      optionalUnresolved,
      headerLabel: "남은 결정사항",
      headerCount: requiredUnresolved.length,
      helperLine: null,
    };
  }
  if (optionalUnresolved.length > 0) {
    return {
      requiredUnresolved,
      optionalUnresolved,
      headerLabel: "권장 검토사항",
      headerCount: optionalUnresolved.length,
      helperLine: "남은 결정사항 0개 (권장 항목 미정)",
    };
  }
  return {
    requiredUnresolved,
    optionalUnresolved,
    headerLabel: "남은 결정사항 없음",
    headerCount: 0,
    helperLine: null,
  };
}

export function unresolvedServiceFlowChecklistEntries(
  slots: Record<ServiceFlowStageSlotKey, boolean>,
  deferrals: Partial<Record<ServiceFlowStageSlotKey, RequirementsServiceFlowChecklistDeferralKind>> | null | undefined,
): Array<{ key: ServiceFlowStageSlotKey; label: string; deferral?: RequirementsServiceFlowChecklistDeferralKind }> {
  const rows: Array<{
    key: ServiceFlowStageSlotKey;
    label: string;
    deferral?: RequirementsServiceFlowChecklistDeferralKind;
  }> = [];
  for (const k of SERVICE_FLOW_STAGE_DECISION_SLOTS) {
    if (slots[k]) continue;
    rows.push({ key: k, label: SERVICE_FLOW_STAGE_SLOT_LABELS[k], deferral: deferrals?.[k] });
  }
  return rows;
}

export function serviceFlowMissingSlotQuestions(slots: Record<ServiceFlowStageSlotKey, boolean>, limit = 2): string[] {
  const questions: Record<ServiceFlowStageSlotKey, string> = {
    humanActors: "이 서비스에서 실제 사람 사용자는 누구인가요?",
    systemActors: "시스템이 자동으로 처리하는 단계는 무엇인가요?",
    mainFlow: "사용자가 처음부터 끝까지 거치는 주요 순서를 3단계 이상으로 말해 주실 수 있나요?",
    actorResponsibility: "각 단계의 최종 책임자는 누구인가요?",
    approvalStep: "승인/확정(결재) 단계가 필요한가요? 필요하다면 누가 승인하나요?",
    exceptionFlow: "반려, 수정 요청, 재처리 같은 예외 흐름이 필요한가요?",
    accessControl: "권한 범위는 다음 단계에서 정리합니다.",
    handoffToFeatures: "기능 후보는 다음 기능 정리 단계에서 정리합니다.",
  };
  return SERVICE_FLOW_STAGE_DECISION_SLOTS.filter((slot) => !slots[slot])
    .slice(0, limit)
    .map((slot) => questions[slot]);
}

export function serviceFlowProgressHint(approval: ServiceFlowStageApprovalState): string | null {
  const slots = approval.slots;
  if (!slots.humanActors) return "사람 액터 미확정";
  if (!slots.systemActors) return "시스템 액터 미확정";
  if (!slots.mainFlow) return "주요 서비스 흐름 미확정";
  if (!slots.actorResponsibility) return "담당(매핑) 미확정";
  if (!slots.approvalStep) return "승인/확정 단계 미확정";
  if (!slots.exceptionFlow) return "예외/수정 흐름 미확정";
  return null;
}

export function deriveServiceFlowApprovalFromFlow(flow: RequirementsServiceFlowV1 | null): ServiceFlowStageApprovalState {
  const actorIds = new Set((flow?.actors ?? []).map((a) => a.id));
  const text = `${(flow?.actors ?? []).map((a) => `${a.name} ${a.description ?? ""}`).join(" ")} ${(flow?.steps ?? []).map((s) => `${s.title} ${s.purpose}`).join(" ")}`;
  const hasHumanActors = (flow?.actors ?? []).some((a) => a.kind === "human");
  const hasSystemActors = (flow?.actors ?? []).some((a) => a.kind === "system");
  const stepsReady = (flow?.steps.length ?? 0) >= 3;
  const mapped = Boolean(flow?.steps.length) && (flow?.steps ?? []).every((s) => s.primaryActorId && actorIds.has(s.primaryActorId));
  const hasApprovalStep = /승인|확정|결재|결정/.test(text);
  const slots: Record<ServiceFlowStageSlotKey, boolean> = {
    humanActors: hasHumanActors,
    systemActors: hasSystemActors,
    mainFlow: stepsReady,
    actorResponsibility: mapped,
    approvalStep: hasApprovalStep,
    exceptionFlow: /예외|수정|반려|재처리|실패|오류|누락/.test(text),
    accessControl: true,
    handoffToFeatures: true,
  };
  const filledSlotCount = SERVICE_FLOW_STAGE_DECISION_SLOTS.filter((k) => slots[k]).length;
  const basePercent = Math.round((filledSlotCount / SERVICE_FLOW_STAGE_DECISION_SLOTS.length) * 100);
  const draftVisible = (flow?.actors?.length ?? 0) >= 1 && (flow?.steps?.length ?? 0) >= 3;
  const progressPercent = draftVisible ? Math.max(basePercent, 35) : basePercent;
  const actorsReady = slots.humanActors && slots.systemActors;
  const approved = Boolean(actorsReady && stepsReady && mapped && flow?.steps.every((s) => s.approved));
  return {
    actorsReady,
    stepsReady,
    mapped,
    approved,
    ready: slots.humanActors && slots.systemActors && slots.mainFlow && slots.actorResponsibility,
    slots,
    filledSlotCount,
    progressPercent,
    recommendedMissing: {
      approvalStep: !slots.approvalStep,
      exceptionFlow: !slots.exceptionFlow,
    },
  };
}

export function normalizeServiceFlowStepOrder(steps: RequirementsServiceFlowStepV1[]): RequirementsServiceFlowStepV1[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s, idx) => ({ ...s, order: idx + 1 }));
}

function recommendPrimaryActorIdForStep(
  step: { title: string; purpose: string; primaryActorId: string },
  actors: readonly RequirementsServiceFlowActorV1[],
): string {
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");
  const humanFirst = humans[0]?.id ?? actors[0]?.id ?? "";
  const systemFirst = systems[0]?.id ?? actors.find((a) => a.kind === "system")?.id ?? actors[0]?.id ?? "";
  const text = `${step.title} ${step.purpose}`;
  if (/(업로드|등록|제출|입력|선택)/.test(text)) return humanFirst || step.primaryActorId;
  if (/(변환|생성|분리|OCR|AI|자동|처리)/i.test(text)) return systemFirst || step.primaryActorId;
  if (/(수정|보완|검토|작성)/.test(text)) return humanFirst || step.primaryActorId;
  if (/(승인|확정|결재)/.test(text)) return humanFirst || step.primaryActorId;
  if (/(공유|배포|열람|알림|발송)/.test(text)) return (humans[humans.length - 1]?.id ?? humanFirst) || step.primaryActorId;
  return step.primaryActorId || humanFirst || systemFirst;
}

export function applyRecommendedServiceFlowPrimaryActors(flow: RequirementsServiceFlowV1): RequirementsServiceFlowV1 {
  const now = new Date().toISOString();
  const nextSteps = flow.steps.map((s) => ({
    ...s,
    primaryActorId: recommendPrimaryActorIdForStep(s, flow.actors),
    approved: false,
    updatedAt: now,
  }));
  return { ...flow, steps: normalizeServiceFlowStepOrder(nextSteps), updatedAt: now };
}
