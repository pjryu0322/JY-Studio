/**
 * Harness Phase H3 — meta/stage 입력을 가장 가까운 표준 `taskType`으로 매핑하는 헬퍼.
 *
 * **read-only / pure helper.** payload·routing 변경 없음.
 *
 * 우선순위:
 * 1. `decisionAxis`에서 명시적으로 task type을 추론 가능하면 그 값.
 * 2. `roleKey`가 명확한 직무라면 직무에 해당하는 task type(예: developer → development).
 * 3. `workspaceStage` 기반 보수적 추론.
 * 4. null.
 */

import {
  listKnowledgeActivationTaskTypes,
  type KnowledgeActivationTaskType,
} from "./knowledgeActivationTaskPolicy";

const ROLE_TO_TASK_TYPE: Readonly<Record<string, KnowledgeActivationTaskType>> = {
  planner: "planning",
  analyst: "analysis",
  architect: "architecture",
  designer: "design",
  developer: "development",
  reviewer: "review",
  security: "security",
};

const STAGE_TO_TASK_TYPE: Readonly<Record<string, KnowledgeActivationTaskType>> = {
  "idea-refinement": "planning",
  "service-flow": "analysis",
  "feature-definition": "analysis",
  "prototype-build": "development",
  "prototype-review": "review",
  "security-review": "security",
};

const KNOWN_TASK_TYPES = new Set<string>(listKnowledgeActivationTaskTypes());

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * meta+stage→taskType 안전 추론. 실패 시 null(builder는 빈 task policy로 처리).
 */
export function deriveKnowledgeActivationTaskTypeFromMeta(input: {
  readonly decisionAxis?: string | null;
  readonly roleKey?: string | null;
  readonly workspaceStage?: string | null;
}): KnowledgeActivationTaskType | null {
  const axis = normalize(input.decisionAxis);
  if (axis && KNOWN_TASK_TYPES.has(axis)) return axis as KnowledgeActivationTaskType;

  const role = normalize(input.roleKey);
  const fromRole = ROLE_TO_TASK_TYPE[role];
  if (fromRole) return fromRole;

  const stage = normalize(input.workspaceStage);
  const fromStage = STAGE_TO_TASK_TYPE[stage];
  if (fromStage) return fromStage;

  return null;
}
