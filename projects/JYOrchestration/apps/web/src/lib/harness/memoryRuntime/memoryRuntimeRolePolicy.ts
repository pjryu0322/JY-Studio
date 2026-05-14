/**
 * Harness Phase H4 Preparation — **Role-aware Memory Policy**.
 *
 * "어떤 역할이 어떤 종류의 기억을 우선 참조해야 하는가"의 단일 출처.
 * **read-only / planning hint only.** 실제 retrieval/injection 결정과 무관하다.
 *
 * 각 정책은:
 * - `preferredScopes`: 해당 역할이 우선 보는 메모리 스코프 우선순위 배열(앞일수록 우선).
 * - `keywordHints`: timeline/working context의 텍스트에서 매칭할 키워드(소문자 비교; 소속 모듈에서 정규화).
 * - `description`: 사용자/문서 표시용 한 줄 설명.
 */

import type { MemoryScopeType } from "./memoryRuntimeTypes";

export type MemoryRuntimeRolePolicy = Readonly<{
  roleKey: string;
  preferredScopes: readonly MemoryScopeType[];
  keywordHints: readonly string[];
  description: string;
}>;

/**
 * 역할 키 정규화: 다양한 형태(`AI_PLANNER`, `planner`, `aiPlanner` 등)를 단일 키로 normalize.
 * **lookup용으로만 사용**, 외부 노출/payload 변형 아님.
 */
function normalizeRoleKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^ai[\s_:-]?/u, "")
    .replace(/[\s\-:_/.]+/g, "_");
}

/**
 * 역할별 메모리 우선순위 정책 표.
 *
 * - **planner/기획자**: UX/goal/persona memory 우선 → project + role.
 * - **architect/설계자**: architecture decision memory 우선 → project + session(최근 결정).
 * - **developer/개발자**: 구현 전략/도구 선택 → project + working.
 * - **security/보안관**: security issue memory 우선 → project + platform.
 * - **reviewer/검수자**: 품질/정책 위반 memory 우선 → project + session.
 * - **analyst/분석가**: 시장/사용자/지표 → project + platform.
 * - **designer/디자이너**: UI/style/persona → project + role.
 */
const MEMORY_RUNTIME_ROLE_POLICY_TABLE: Readonly<Record<string, MemoryRuntimeRolePolicy>> = {
  planner: {
    roleKey: "planner",
    preferredScopes: ["project", "role", "session"],
    keywordHints: ["goal", "ux", "persona", "user", "목표", "사용자", "기획", "요구"],
    description: "기획자 역할: 사용자 목표/UX/페르소나 메모리를 우선 참조합니다.",
  },
  architect: {
    roleKey: "architect",
    preferredScopes: ["project", "session", "role"],
    keywordHints: [
      "architecture",
      "monolith",
      "microservice",
      "schema",
      "system",
      "design",
      "아키텍처",
      "설계",
      "구조",
    ],
    description: "설계자 역할: 아키텍처 결정 기록을 우선 참조합니다.",
  },
  developer: {
    roleKey: "developer",
    preferredScopes: ["project", "working", "session"],
    keywordHints: ["implementation", "framework", "library", "code", "구현", "코드", "라이브러리"],
    description: "개발자 역할: 구현 전략·기술 선택 메모리를 우선 참조합니다.",
  },
  security: {
    roleKey: "security",
    preferredScopes: ["project", "platform", "session"],
    keywordHints: ["security", "vulnerability", "auth", "보안", "취약점", "권한", "인증"],
    description: "보안관 역할: 보안 이슈·인증·정책 메모리를 우선 참조합니다.",
  },
  reviewer: {
    roleKey: "reviewer",
    preferredScopes: ["project", "session", "role"],
    keywordHints: ["review", "quality", "regression", "검수", "품질", "리뷰", "회귀"],
    description: "검수자 역할: 품질·회귀·정책 위반 기록을 우선 참조합니다.",
  },
  analyst: {
    roleKey: "analyst",
    preferredScopes: ["project", "platform", "session"],
    keywordHints: ["analysis", "metric", "market", "분석", "지표", "시장"],
    description: "분석가 역할: 시장·사용자·지표 메모리를 우선 참조합니다.",
  },
  designer: {
    roleKey: "designer",
    preferredScopes: ["project", "role", "session"],
    keywordHints: ["design", "ui", "ux", "style", "color", "디자인", "스타일", "톤"],
    description: "디자이너 역할: UI/UX/스타일 메모리를 우선 참조합니다.",
  },
};

/** 역할이 매칭되지 않을 때 사용하는 안전 fallback. */
export const MEMORY_RUNTIME_DEFAULT_POLICY: MemoryRuntimeRolePolicy = Object.freeze({
  roleKey: "default",
  preferredScopes: ["project", "session", "role"] as const,
  keywordHints: [] as readonly string[],
  description: "기본 정책: 프로젝트·세션 메모리를 우선 참조합니다.",
}) as MemoryRuntimeRolePolicy;

/**
 * `roleKey`에 매칭되는 정책을 안전하게 반환한다. 매칭 실패 시 `MEMORY_RUNTIME_DEFAULT_POLICY`.
 */
export function resolveMemoryRuntimeRolePolicy(roleKey: string | null | undefined): MemoryRuntimeRolePolicy {
  const normalized = normalizeRoleKey(roleKey);
  if (!normalized) return MEMORY_RUNTIME_DEFAULT_POLICY;
  return MEMORY_RUNTIME_ROLE_POLICY_TABLE[normalized] ?? MEMORY_RUNTIME_DEFAULT_POLICY;
}

/** 진단/문서용: 등록된 모든 정책의 정렬된 목록. */
export function listMemoryRuntimeRolePolicies(): readonly MemoryRuntimeRolePolicy[] {
  return Object.values(MEMORY_RUNTIME_ROLE_POLICY_TABLE).sort((a, b) => a.roleKey.localeCompare(b.roleKey));
}
