/**
 * Harness Phase H3 — **Task-type-aware Knowledge Activation Policy**.
 *
 * "작업 유형(taskType)별로 어떤 지식팩을 활성화 후보로 고려할지"의 단일 출처.
 * **read-only / planning hint only.** 실제 retrieval/주입과 무관하다.
 */

import type { KnowledgeActivationPolicyRef } from "./knowledgeActivationPolicyTypes";

/** 작업 유형 표준 값. 정규화된 lookup용. */
export type KnowledgeActivationTaskType =
  | "planning"
  | "analysis"
  | "architecture"
  | "design"
  | "development"
  | "review"
  | "security"
  | "deployment";

function normalizeTaskType(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 작업 유형 정책 표.
 *
 * 출처는 `singleChatOrchestrationMeta.decisionAxis` 등에서 매핑 가능하지만,
 * H3 단계에서는 직접 입력으로만 받는다. retrieval/payload에 영향 없음.
 */
export const KNOWLEDGE_ACTIVATION_TASK_POLICY: Readonly<
  Record<KnowledgeActivationTaskType, readonly KnowledgeActivationPolicyRef[]>
> = {
  planning: [
    { knowledgePackId: "service-planning-guide", priority: "recommended" },
    { knowledgePackId: "ux-standard-guide", priority: "optional" },
  ],
  analysis: [
    { knowledgePackId: "requirements-analysis-guide", priority: "recommended" },
  ],
  architecture: [
    { knowledgePackId: "architecture-standard-guide", priority: "recommended" },
    { knowledgePackId: "egovframe-architecture-guide", priority: "optional" },
  ],
  design: [
    { knowledgePackId: "ux-standard-guide", priority: "recommended" },
    { knowledgePackId: "design-system-guide", priority: "optional" },
  ],
  development: [
    { knowledgePackId: "coding-standard-guide", priority: "recommended" },
    { knowledgePackId: "egovframe-development-guide", priority: "recommended" },
  ],
  review: [
    { knowledgePackId: "quality-review-guide", priority: "recommended" },
    { knowledgePackId: "acceptance-criteria-guide", priority: "optional" },
  ],
  security: [
    { knowledgePackId: "owasp-top10-guide", priority: "required" },
    { knowledgePackId: "cwe-top25-guide", priority: "recommended" },
  ],
  deployment: [
    { knowledgePackId: "deployment-runbook-guide", priority: "recommended" },
  ],
};

/** alias 매핑. owner agent / decisionAxis 값을 표준 taskType으로 정규화. */
const TASK_TYPE_ALIASES: Readonly<Record<string, KnowledgeActivationTaskType>> = {
  planner: "planning",
  analyst: "analysis",
  architect: "architecture",
  designer: "design",
  developer: "development",
  reviewer: "review",
  qa: "review",
  secops: "security",
  deploy: "deployment",
  ops: "deployment",
};

const KNOWN_TASK_TYPES = new Set<KnowledgeActivationTaskType>([
  "planning",
  "analysis",
  "architecture",
  "design",
  "development",
  "review",
  "security",
  "deployment",
]);

/** 안전 fallback. */
export const KNOWLEDGE_ACTIVATION_TASK_POLICY_FALLBACK: readonly KnowledgeActivationPolicyRef[] = [];

/**
 * `taskType`에 매칭되는 후보 정책을 반환한다. 매칭 실패 시 빈 배열.
 */
export function resolveKnowledgeActivationTaskPolicy(
  taskType: string | null | undefined
): readonly KnowledgeActivationPolicyRef[] {
  const normalized = normalizeTaskType(taskType);
  if (!normalized) return KNOWLEDGE_ACTIVATION_TASK_POLICY_FALLBACK;
  const aliased = TASK_TYPE_ALIASES[normalized];
  const canonical = aliased ?? (KNOWN_TASK_TYPES.has(normalized as KnowledgeActivationTaskType)
    ? (normalized as KnowledgeActivationTaskType)
    : null);
  if (!canonical) return KNOWLEDGE_ACTIVATION_TASK_POLICY_FALLBACK;
  return KNOWLEDGE_ACTIVATION_TASK_POLICY[canonical] ?? KNOWLEDGE_ACTIVATION_TASK_POLICY_FALLBACK;
}

/** 정책 키 목록(문서/UI용). */
export function listKnowledgeActivationTaskTypes(): readonly KnowledgeActivationTaskType[] {
  return Array.from(KNOWN_TASK_TYPES).sort();
}
