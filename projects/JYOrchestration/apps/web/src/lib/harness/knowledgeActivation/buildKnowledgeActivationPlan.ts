/**
 * Harness Phase H3 — **Knowledge Activation Plan Builder**.
 *
 * role/stage/taskType 정책 후보와 기존 hint를 입력으로 받아 결정론적으로 활성화 plan을 만든다.
 *
 * **read-only / planning metadata only.** retrieval/주입/payload에 영향 없음.
 *
 * 결정론적 보장:
 * - 동일 입력은 동일 items 순서를 만든다.
 * - 정렬 키: priority desc → reasonType rank → roleKey/stage/taskType → knowledgePackId asc.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";
import type { ActiveKnowledgePackRef } from "@/lib/overlay/activeKnowledgePackRef";

import {
  KNOWLEDGE_ACTIVATION_ROLE_POLICY_FALLBACK,
  resolveKnowledgeActivationRolePolicy,
} from "./knowledgeActivationRolePolicy";
import {
  KNOWLEDGE_ACTIVATION_STAGE_POLICY_FALLBACK,
  resolveKnowledgeActivationStagePolicy,
} from "./knowledgeActivationStagePolicy";
import {
  KNOWLEDGE_ACTIVATION_TASK_POLICY_FALLBACK,
  resolveKnowledgeActivationTaskPolicy,
} from "./knowledgeActivationTaskPolicy";
import {
  emptyKnowledgeActivationPlan,
  mergeKnowledgeActivationPriorities,
  type KnowledgeActivationFinding,
  type KnowledgeActivationPlan,
  type KnowledgeActivationPlanItem,
  type KnowledgeActivationPolicyRef,
  type KnowledgeActivationPriority,
  type KnowledgeActivationReasonType,
} from "./knowledgeActivationPolicyTypes";

/** items / findings 상한(UI·timeline 비대화 방지). */
export const KNOWLEDGE_ACTIVATION_ITEMS_MAX = 24;
export const KNOWLEDGE_ACTIVATION_FINDINGS_MAX = 6;

const KNOWLEDGE_PACK_ID_MAX = 200;
const REASON_LABEL_MAX = 200;
const CONTEXT_FIELD_MAX = 80;

const REASON_TYPE_RANK: Readonly<Record<KnowledgeActivationReasonType, number>> = {
  safety_requirement: 0,
  role_policy: 1,
  stage_policy: 2,
  task_type_policy: 3,
  existing_hint: 4,
  manual_selection: 5,
  project_context: 6,
};

const PRIORITY_RANK: Readonly<Record<KnowledgeActivationPriority, number>> = {
  required: 3,
  recommended: 2,
  optional: 1,
};

const REASON_LABEL_DEFAULT: Readonly<Record<KnowledgeActivationReasonType, string>> = {
  role_policy: "역할 기준 후보",
  stage_policy: "단계 기준 후보",
  task_type_policy: "작업 유형 기준 후보",
  project_context: "프로젝트 맥락 기준 후보",
  manual_selection: "수동 선택 후보",
  safety_requirement: "보안 기준 후보",
  existing_hint: "기존 활성화 힌트",
};

export type BuildKnowledgeActivationPlanInput = Readonly<{
  roleKey?: string | null;
  workspaceStage?: string | null;
  taskType?: string | null;
  existingHints?: readonly ActiveKnowledgePackRef[];
}>;

type ItemDraft = {
  knowledgePackId: string;
  priority: KnowledgeActivationPriority;
  reasonType: KnowledgeActivationReasonType;
  reasonLabel: string;
  roleKey?: string;
  workspaceStage?: string;
  taskType?: string;
};

/**
 * Knowledge Activation Plan 빌더. **결정론적·read-only**.
 */
export function buildKnowledgeActivationPlan(
  input: BuildKnowledgeActivationPlanInput
): KnowledgeActivationPlan {
  const roleKey = trimAndClipString(input.roleKey, CONTEXT_FIELD_MAX) || null;
  const workspaceStage = trimAndClipString(input.workspaceStage, CONTEXT_FIELD_MAX) || null;
  const taskType = trimAndClipString(input.taskType, CONTEXT_FIELD_MAX) || null;

  const rolePolicyRefs = resolveKnowledgeActivationRolePolicy(roleKey);
  const stagePolicyRefs = resolveKnowledgeActivationStagePolicy(workspaceStage);
  const taskPolicyRefs = resolveKnowledgeActivationTaskPolicy(taskType);
  const existingHints = Array.isArray(input.existingHints) ? input.existingHints : [];

  // 후보 모으기(reasonType 부여; dedupe는 아래에서 수행).
  const draftMap = new Map<string, ItemDraft>();

  const collect = (
    refs: readonly KnowledgeActivationPolicyRef[],
    reasonType: KnowledgeActivationReasonType,
    context: { roleKey?: string; workspaceStage?: string; taskType?: string }
  ) => {
    for (const ref of refs) {
      const id = trimAndClipString(ref.knowledgePackId, KNOWLEDGE_PACK_ID_MAX);
      if (!id) continue;
      const priority = isPriority(ref.priority) ? ref.priority : "optional";
      const reasonLabel = ref.reasonLabel
        ? trimAndClipString(ref.reasonLabel, REASON_LABEL_MAX)
        : REASON_LABEL_DEFAULT[reasonType];
      const existing = draftMap.get(id);
      if (!existing) {
        draftMap.set(id, {
          knowledgePackId: id,
          priority,
          reasonType,
          reasonLabel,
          ...context,
        });
        continue;
      }
      // dedupe: priority merge + reasonType은 더 강한(rank가 낮은) 쪽 유지.
      const mergedPriority = mergeKnowledgeActivationPriorities(existing.priority, priority);
      const keepExistingReason =
        (REASON_TYPE_RANK[existing.reasonType] ?? 99) <= (REASON_TYPE_RANK[reasonType] ?? 99);
      draftMap.set(id, {
        ...existing,
        priority: mergedPriority,
        reasonType: keepExistingReason ? existing.reasonType : reasonType,
        reasonLabel: keepExistingReason ? existing.reasonLabel : reasonLabel,
        roleKey: existing.roleKey ?? context.roleKey,
        workspaceStage: existing.workspaceStage ?? context.workspaceStage,
        taskType: existing.taskType ?? context.taskType,
      });
    }
  };

  if (rolePolicyRefs.length) {
    collect(rolePolicyRefs, "role_policy", { roleKey: roleKey ?? undefined });
  }
  if (stagePolicyRefs.length) {
    collect(stagePolicyRefs, "stage_policy", { workspaceStage: workspaceStage ?? undefined });
  }
  if (taskPolicyRefs.length) {
    collect(taskPolicyRefs, "task_type_policy", { taskType: taskType ?? undefined });
  }
  if (existingHints.length) {
    const hintRefs: KnowledgeActivationPolicyRef[] = [];
    for (const hint of existingHints) {
      const id = trimAndClipString(hint.knowledgePackId, KNOWLEDGE_PACK_ID_MAX);
      if (!id) continue;
      const priority = priorityFromHintPriority(hint.priority);
      hintRefs.push({
        knowledgePackId: id,
        priority,
        reasonLabel: trimAndClipString(hint.activationReason, REASON_LABEL_MAX) || undefined,
      });
    }
    collect(hintRefs, "existing_hint", { roleKey: roleKey ?? undefined });
  }

  const sortedItems = [...draftMap.values()].sort(compareDrafts).slice(0, KNOWLEDGE_ACTIVATION_ITEMS_MAX);
  const items: readonly KnowledgeActivationPlanItem[] = sortedItems.map(toPlanItem);

  const findings = buildFindings({
    items,
    rolePolicyMatched: rolePolicyRefs !== KNOWLEDGE_ACTIVATION_ROLE_POLICY_FALLBACK,
    stagePolicyMatched: stagePolicyRefs !== KNOWLEDGE_ACTIVATION_STAGE_POLICY_FALLBACK,
    taskPolicyMatched: taskPolicyRefs !== KNOWLEDGE_ACTIVATION_TASK_POLICY_FALLBACK,
    existingHintCount: existingHints.length,
    duplicatesMerged: rolePolicyRefs.length + stagePolicyRefs.length + taskPolicyRefs.length + existingHints.length > draftMap.size,
  });

  if (items.length === 0 && findings.length === 0) {
    return { ...emptyKnowledgeActivationPlan(), roleKey, workspaceStage, taskType };
  }

  return {
    mode: "dry_run",
    roleKey,
    workspaceStage,
    taskType,
    items,
    findings,
  };
}

// ── internal helpers ────────────────────────────────────────────────────────

function isPriority(value: unknown): value is KnowledgeActivationPriority {
  return value === "required" || value === "recommended" || value === "optional";
}

/**
 * `ActiveKnowledgePackRef.priority`(숫자)를 본 정책의 priority enum으로 안전 매핑.
 *
 * - 0~1: required
 * - 2~3: recommended
 * - 그 외: optional
 */
function priorityFromHintPriority(value: unknown): KnowledgeActivationPriority {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 99;
  if (n <= 1) return "required";
  if (n <= 3) return "recommended";
  return "optional";
}

function compareDrafts(a: ItemDraft, b: ItemDraft): number {
  const pa = PRIORITY_RANK[a.priority] ?? 0;
  const pb = PRIORITY_RANK[b.priority] ?? 0;
  if (pa !== pb) return pb - pa;
  const ra = REASON_TYPE_RANK[a.reasonType] ?? 99;
  const rb = REASON_TYPE_RANK[b.reasonType] ?? 99;
  if (ra !== rb) return ra - rb;
  return a.knowledgePackId.localeCompare(b.knowledgePackId);
}

function toPlanItem(draft: ItemDraft): KnowledgeActivationPlanItem {
  const out: ItemDraft = { ...draft };
  return {
    knowledgePackId: out.knowledgePackId,
    priority: out.priority,
    reasonType: out.reasonType,
    reasonLabel: out.reasonLabel,
    ...(out.roleKey ? { roleKey: out.roleKey } : {}),
    ...(out.workspaceStage ? { workspaceStage: out.workspaceStage } : {}),
    ...(out.taskType ? { taskType: out.taskType } : {}),
  };
}

function buildFindings(input: {
  items: readonly KnowledgeActivationPlanItem[];
  rolePolicyMatched: boolean;
  stagePolicyMatched: boolean;
  taskPolicyMatched: boolean;
  existingHintCount: number;
  duplicatesMerged: boolean;
}): readonly KnowledgeActivationFinding[] {
  const findings: KnowledgeActivationFinding[] = [];
  if (!input.rolePolicyMatched) {
    findings.push({
      code: "NO_ROLE_POLICY_MATCH",
      severity: "info",
      message: "역할에 매칭되는 지식팩 정책이 없어 후보로 추가하지 않았습니다.",
    });
  }
  if (!input.stagePolicyMatched) {
    findings.push({
      code: "NO_STAGE_POLICY_MATCH",
      severity: "info",
      message: "프로젝트 단계에 매칭되는 지식팩 정책이 없습니다.",
    });
  }
  if (!input.taskPolicyMatched) {
    findings.push({
      code: "NO_TASK_POLICY_MATCH",
      severity: "info",
      message: "작업 유형에 매칭되는 지식팩 정책이 없습니다.",
    });
  }
  if (input.existingHintCount === 0) {
    findings.push({
      code: "NO_KNOWLEDGE_HINTS",
      severity: "info",
      message: "이번 턴에 기록된 기존 지식 활성화 힌트가 없습니다.",
    });
  }
  if (input.duplicatesMerged) {
    findings.push({
      code: "DUPLICATE_PACK_MERGED",
      severity: "info",
      message: "여러 정책에서 같은 지식팩이 후보로 등장해 우선순위를 병합했습니다.",
    });
  }
  return findings.slice(0, KNOWLEDGE_ACTIVATION_FINDINGS_MAX);
}
