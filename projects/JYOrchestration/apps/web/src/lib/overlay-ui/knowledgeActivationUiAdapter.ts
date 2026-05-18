/**
 * Harness Phase H3 — **Knowledge Activation UI adapter**.
 *
 * `KnowledgeActivationPlan` → 사용자 표현 ViewModel. 순수 함수, read-only display.
 *
 * 사용자에게 "지식팩이 검색·주입되었다" 같은 enforcement 표현 금지.
 * 항상 **planning / dry-run / 후보 정보** 톤을 유지한다.
 */

import type {
  KnowledgeActivationFinding,
  KnowledgeActivationFindingSeverity,
  KnowledgeActivationPlan,
  KnowledgeActivationPlanItem,
  KnowledgeActivationPriority,
  KnowledgeActivationReasonType,
  KnowledgeActivationSummary,
} from "@/lib/harness/knowledgeActivation/knowledgeActivationPolicyTypes";
import {
  OVERLAY_UI_MISSING_LABEL,
  formatKoreanInt,
} from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** "실제 검색·검색결과 주입이 아니다"라는 사실을 노출하는 공식 안내 문구. */
export const KNOWLEDGE_ACTIVATION_PLAN_DISCLAIMER =
  "이 정보는 실제 검색/검색결과 주입이 아니라, 현재 역할과 단계 기준으로 어떤 지식팩을 고려할지 정리한 계획 정보입니다.";

const PRIORITY_LABEL: Readonly<Record<KnowledgeActivationPriority, string>> = {
  required: "필수",
  recommended: "추천",
  optional: "선택",
};

const PRIORITY_TONE: Readonly<Record<KnowledgeActivationPriority, OverlayUiBadgeTone>> = {
  required: "warning",
  recommended: "info",
  optional: "neutral",
};

const REASON_TYPE_LABEL: Readonly<Record<KnowledgeActivationReasonType, string>> = {
  role_policy: "역할 기준",
  stage_policy: "단계 기준",
  task_type_policy: "작업 유형 기준",
  project_context: "프로젝트 맥락",
  manual_selection: "수동 선택",
  safety_requirement: "보안 기준",
  existing_hint: "기존 힌트",
};

const REASON_TYPE_TONE: Readonly<Record<KnowledgeActivationReasonType, OverlayUiBadgeTone>> = {
  safety_requirement: "warning",
  role_policy: "info",
  stage_policy: "info",
  task_type_policy: "info",
  existing_hint: "positive",
  manual_selection: "neutral",
  project_context: "neutral",
};

const SEVERITY_LABEL: Readonly<Record<KnowledgeActivationFindingSeverity, string>> = {
  info: "안내",
  warning: "주의",
};

export function knowledgeActivationPriorityLabel(priority: KnowledgeActivationPriority): string {
  return PRIORITY_LABEL[priority] ?? OVERLAY_UI_MISSING_LABEL;
}

export function knowledgeActivationPriorityTone(
  priority: KnowledgeActivationPriority
): OverlayUiBadgeTone {
  return PRIORITY_TONE[priority] ?? "neutral";
}

export function knowledgeActivationReasonTypeLabel(
  reasonType: KnowledgeActivationReasonType
): string {
  return REASON_TYPE_LABEL[reasonType] ?? OVERLAY_UI_MISSING_LABEL;
}

export function knowledgeActivationReasonTypeTone(
  reasonType: KnowledgeActivationReasonType
): OverlayUiBadgeTone {
  return REASON_TYPE_TONE[reasonType] ?? "neutral";
}

export function knowledgeActivationFindingSeverityLabel(
  severity: KnowledgeActivationFindingSeverity
): string {
  return SEVERITY_LABEL[severity] ?? "안내";
}

export type KnowledgeActivationItemVM = Readonly<{
  knowledgePackId: string;
  priority: KnowledgeActivationPriority;
  priorityLabel: string;
  priorityTone: OverlayUiBadgeTone;
  reasonType: KnowledgeActivationReasonType;
  reasonTypeLabel: string;
  reasonTypeTone: OverlayUiBadgeTone;
  reasonLabel: string;
  contextHint: string | null;
}>;

export type KnowledgeActivationFindingVM = Readonly<{
  code: string;
  severity: KnowledgeActivationFindingSeverity;
  severityLabel: string;
  message: string;
}>;

export type KnowledgeActivationPlanVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  roleLabel: string;
  stageLabel: string;
  taskTypeLabel: string;
  totalLabel: string;
  requiredLabel: string;
  recommendedLabel: string;
  optionalLabel: string;
  reasonBreakdownText: string;
  items: readonly KnowledgeActivationItemVM[];
  findings: readonly KnowledgeActivationFindingVM[];
}>;

function buildContextHint(item: KnowledgeActivationPlanItem): string | null {
  const parts: string[] = [];
  if (item.roleKey) parts.push(`역할 ${item.roleKey}`);
  if (item.workspaceStage) parts.push(`단계 ${item.workspaceStage}`);
  if (item.taskType) parts.push(`작업 ${item.taskType}`);
  return parts.length ? parts.join(" · ") : null;
}

function toItemVM(item: KnowledgeActivationPlanItem): KnowledgeActivationItemVM {
  return {
    knowledgePackId: item.knowledgePackId,
    priority: item.priority,
    priorityLabel: knowledgeActivationPriorityLabel(item.priority),
    priorityTone: knowledgeActivationPriorityTone(item.priority),
    reasonType: item.reasonType,
    reasonTypeLabel: knowledgeActivationReasonTypeLabel(item.reasonType),
    reasonTypeTone: knowledgeActivationReasonTypeTone(item.reasonType),
    reasonLabel: item.reasonLabel,
    contextHint: buildContextHint(item),
  };
}

function toFindingVM(f: KnowledgeActivationFinding): KnowledgeActivationFindingVM {
  return {
    code: f.code,
    severity: f.severity,
    severityLabel: knowledgeActivationFindingSeverityLabel(f.severity),
    message: f.message,
  };
}

function buildReasonBreakdownText(summary: KnowledgeActivationSummary): string {
  if (summary.total <= 0) return "후보 없음";
  const parts: string[] = [];
  if (summary.rolePolicyDriven > 0) {
    parts.push(`역할 기준 ${formatKoreanInt(summary.rolePolicyDriven)}`);
  }
  if (summary.stagePolicyDriven > 0) {
    parts.push(`단계 기준 ${formatKoreanInt(summary.stagePolicyDriven)}`);
  }
  if (summary.taskTypePolicyDriven > 0) {
    parts.push(`작업 유형 기준 ${formatKoreanInt(summary.taskTypePolicyDriven)}`);
  }
  if (summary.existingHintDriven > 0) {
    parts.push(`기존 힌트 ${formatKoreanInt(summary.existingHintDriven)}`);
  }
  return parts.length ? parts.join(" · ") : "기타";
}

function emptyPlanVM(): KnowledgeActivationPlanVM {
  return {
    hasData: false,
    disclaimer: KNOWLEDGE_ACTIVATION_PLAN_DISCLAIMER,
    roleLabel: `역할: ${OVERLAY_UI_MISSING_LABEL}`,
    stageLabel: `단계: ${OVERLAY_UI_MISSING_LABEL}`,
    taskTypeLabel: `작업 유형: ${OVERLAY_UI_MISSING_LABEL}`,
    totalLabel: "후보 0개",
    requiredLabel: "필수 0",
    recommendedLabel: "추천 0",
    optionalLabel: "선택 0",
    reasonBreakdownText: "후보 없음",
    items: [],
    findings: [],
  };
}

/**
 * `KnowledgeActivationPlan` → UI VM. 빈/잘못된 입력은 안전 fallback VM 반환.
 */
export function buildKnowledgeActivationPlanVM(
  plan: KnowledgeActivationPlan | null | undefined,
  summary?: KnowledgeActivationSummary | null
): KnowledgeActivationPlanVM {
  const safe = plan && plan.mode === "dry_run" ? plan : null;
  if (!safe) return emptyPlanVM();

  const computed: KnowledgeActivationSummary =
    summary && summary.mode === "dry_run"
      ? summary
      : {
          mode: "dry_run",
          total: safe.items.length,
          required: safe.items.filter((i) => i.priority === "required").length,
          recommended: safe.items.filter((i) => i.priority === "recommended").length,
          optional: safe.items.filter((i) => i.priority === "optional").length,
          rolePolicyDriven: safe.items.filter((i) => i.reasonType === "role_policy").length,
          stagePolicyDriven: safe.items.filter((i) => i.reasonType === "stage_policy").length,
          taskTypePolicyDriven: safe.items.filter((i) => i.reasonType === "task_type_policy").length,
          existingHintDriven: safe.items.filter((i) => i.reasonType === "existing_hint").length,
          findingsCount: safe.findings.length,
        };

  return {
    hasData: safe.items.length > 0 || safe.findings.length > 0,
    disclaimer: KNOWLEDGE_ACTIVATION_PLAN_DISCLAIMER,
    roleLabel: `역할: ${safe.roleKey?.length ? safe.roleKey : OVERLAY_UI_MISSING_LABEL}`,
    stageLabel: `단계: ${safe.workspaceStage?.length ? safe.workspaceStage : OVERLAY_UI_MISSING_LABEL}`,
    taskTypeLabel: `작업 유형: ${safe.taskType?.length ? safe.taskType : OVERLAY_UI_MISSING_LABEL}`,
    totalLabel: `후보 ${formatKoreanInt(computed.total)}개`,
    requiredLabel: `필수 ${formatKoreanInt(computed.required)}`,
    recommendedLabel: `추천 ${formatKoreanInt(computed.recommended)}`,
    optionalLabel: `선택 ${formatKoreanInt(computed.optional)}`,
    reasonBreakdownText: buildReasonBreakdownText(computed),
    items: safe.items.map(toItemVM),
    findings: safe.findings.map(toFindingVM),
  };
}
