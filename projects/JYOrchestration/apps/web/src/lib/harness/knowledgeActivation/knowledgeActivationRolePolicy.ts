/**
 * Harness Phase H3 — **Role-aware Knowledge Activation Policy**.
 *
 * "역할별로 어떤 지식팩을 활성화 후보로 고려할지"의 단일 출처.
 * **read-only / planning hint only.** 실제 retrieval/주입과 무관하다.
 *
 * `knowledgePackId`는 향후 지식팩 등록 체계와 충돌하지 않도록 **kebab-case**를 사용한다.
 * 현재 실제 지식팩 존재 여부와 관계없이 planning 후보로만 사용된다.
 */

import type {
  KnowledgeActivationPolicyRef,
  KnowledgeActivationPriority,
} from "./knowledgeActivationPolicyTypes";

/**
 * 역할 키 정규화: `AI_PLANNER`/`ai-Architect`/`planner` 등 다양한 형태를 단일 키로 매핑.
 * **lookup용으로만 사용**, 외부 payload 변형 아님.
 */
function normalizeRoleKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^ai[\s_:-]?/u, "")
    .replace(/[\s\-:_/.]+/g, "_");
}

/**
 * 역할별 지식팩 후보 정책 표.
 *
 * 우선순위 표기는 모두 **planning 후보**이며 실제 강제 주입 아님:
 * - `required`: 해당 역할에서 거의 항상 필요한 표준(예: security → owasp-top10-guide).
 * - `recommended`: 일반적으로 권장.
 * - `optional`: 선택적 보조.
 */
export const KNOWLEDGE_ACTIVATION_ROLE_POLICY: Readonly<
  Record<string, readonly KnowledgeActivationPolicyRef[]>
> = {
  planner: [
    { knowledgePackId: "service-planning-guide", priority: "recommended" },
    { knowledgePackId: "ux-standard-guide", priority: "optional" },
  ],
  architect: [
    { knowledgePackId: "architecture-standard-guide", priority: "recommended" },
    { knowledgePackId: "egovframe-architecture-guide", priority: "optional" },
  ],
  developer: [
    { knowledgePackId: "coding-standard-guide", priority: "recommended" },
    { knowledgePackId: "egovframe-development-guide", priority: "recommended" },
  ],
  security: [
    { knowledgePackId: "owasp-top10-guide", priority: "required" },
    { knowledgePackId: "cwe-top25-guide", priority: "recommended" },
  ],
  reviewer: [
    { knowledgePackId: "quality-review-guide", priority: "recommended" },
    { knowledgePackId: "acceptance-criteria-guide", priority: "optional" },
  ],
  analyst: [
    { knowledgePackId: "requirements-analysis-guide", priority: "recommended" },
    { knowledgePackId: "ux-standard-guide", priority: "optional" },
  ],
  designer: [
    { knowledgePackId: "ux-standard-guide", priority: "recommended" },
    { knowledgePackId: "design-system-guide", priority: "optional" },
  ],
};

/** 안전 fallback. 빈 배열을 반환해 호출부에서 후보 없음으로 처리되게 한다. */
export const KNOWLEDGE_ACTIVATION_ROLE_POLICY_FALLBACK: readonly KnowledgeActivationPolicyRef[] = [];

/**
 * `roleKey`에 매칭되는 후보 정책을 반환한다. 매칭 실패 시 빈 배열(findings에서 안내).
 */
export function resolveKnowledgeActivationRolePolicy(
  roleKey: string | null | undefined
): readonly KnowledgeActivationPolicyRef[] {
  const normalized = normalizeRoleKey(roleKey);
  if (!normalized) return KNOWLEDGE_ACTIVATION_ROLE_POLICY_FALLBACK;
  return KNOWLEDGE_ACTIVATION_ROLE_POLICY[normalized] ?? KNOWLEDGE_ACTIVATION_ROLE_POLICY_FALLBACK;
}

/** UI/문서용: 등록된 모든 역할 정책의 정렬된 목록(`[roleKey, refs]` 튜플). */
export function listKnowledgeActivationRolePolicies(): readonly (readonly [
  string,
  readonly KnowledgeActivationPolicyRef[]
])[] {
  return Object.entries(KNOWLEDGE_ACTIVATION_ROLE_POLICY).sort(([a], [b]) => a.localeCompare(b));
}

/** priority literal type-safe 헬퍼(타입 시스템에서 잘못된 값 차단). */
export function asKnowledgeActivationPriority(value: string): KnowledgeActivationPriority | null {
  return value === "required" || value === "recommended" || value === "optional" ? value : null;
}
