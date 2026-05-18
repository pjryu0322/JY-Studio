/**
 * Harness Phase H3 — **Stage-aware Knowledge Activation Policy**.
 *
 * "프로젝트 단계/화면 키 기준으로 어떤 지식팩을 활성화 후보로 고려할지"의 단일 출처.
 * **read-only / planning hint only.** 실제 retrieval/주입과 무관하다.
 */

import type { KnowledgeActivationPolicyRef } from "./knowledgeActivationPolicyTypes";

/**
 * stage 키 정규화: `IdeaRefinement`/`idea-refinement`/`idea_refinement` 같은 다양한 표기를
 * kebab-case 단일 키로 lookup한다.
 */
function normalizeStageKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 단계별 지식팩 후보 정책 표.
 *
 * - `idea-refinement`: 아이디어 정제 단계.
 * - `service-flow`: 서비스 플로우 설계.
 * - `feature-definition`: 기능 정의/명세.
 * - `prototype-build`: 프로토타입 구현.
 * - `prototype-review`: 프로토타입 검수/리뷰.
 * - `security-review`: 보안 검토.
 */
export const KNOWLEDGE_ACTIVATION_STAGE_POLICY: Readonly<
  Record<string, readonly KnowledgeActivationPolicyRef[]>
> = {
  "idea-refinement": [
    { knowledgePackId: "service-planning-guide", priority: "recommended" },
    { knowledgePackId: "ux-standard-guide", priority: "optional" },
  ],
  "service-flow": [
    { knowledgePackId: "user-flow-guide", priority: "recommended" },
    { knowledgePackId: "requirements-analysis-guide", priority: "recommended" },
  ],
  "feature-definition": [
    { knowledgePackId: "functional-spec-guide", priority: "recommended" },
  ],
  "prototype-build": [
    { knowledgePackId: "coding-standard-guide", priority: "recommended" },
    { knowledgePackId: "frontend-implementation-guide", priority: "optional" },
  ],
  "prototype-review": [
    { knowledgePackId: "quality-review-guide", priority: "recommended" },
    { knowledgePackId: "usability-review-guide", priority: "optional" },
  ],
  "security-review": [
    { knowledgePackId: "owasp-top10-guide", priority: "required" },
    { knowledgePackId: "cwe-top25-guide", priority: "recommended" },
  ],
};

/** alias 매핑: 기존 `RequirementsPromptTimelineEntry.stage` 값을 정책 키로 정규화. */
const STAGE_ALIASES: Readonly<Record<string, string>> = {
  ideation: "idea-refinement",
  idea: "idea-refinement",
  "idea-refining": "idea-refinement",
  flow: "service-flow",
  "service-design": "service-flow",
  "feature-planning": "feature-definition",
  "feature-spec": "feature-definition",
  "prototype": "prototype-build",
  build: "prototype-build",
  development: "prototype-build",
  review: "prototype-review",
  "quality-review": "prototype-review",
  security: "security-review",
};

/** 안전 fallback. */
export const KNOWLEDGE_ACTIVATION_STAGE_POLICY_FALLBACK: readonly KnowledgeActivationPolicyRef[] = [];

/**
 * `workspaceStage`에 매칭되는 후보 정책을 반환한다. 매칭 실패 시 빈 배열.
 */
export function resolveKnowledgeActivationStagePolicy(
  workspaceStage: string | null | undefined
): readonly KnowledgeActivationPolicyRef[] {
  const normalized = normalizeStageKey(workspaceStage);
  if (!normalized) return KNOWLEDGE_ACTIVATION_STAGE_POLICY_FALLBACK;
  const canonical = STAGE_ALIASES[normalized] ?? normalized;
  return (
    KNOWLEDGE_ACTIVATION_STAGE_POLICY[canonical] ??
    KNOWLEDGE_ACTIVATION_STAGE_POLICY_FALLBACK
  );
}

/** 정책 키 목록(문서/UI용). */
export function listKnowledgeActivationStageKeys(): readonly string[] {
  return Object.keys(KNOWLEDGE_ACTIVATION_STAGE_POLICY).sort();
}
