/**
 * Harness Phase H4.5 — **Memory Runtime Scope Classifier**.
 *
 * `resolveMemoryScopeFromSource`의 source-label 휴리스틱을 그대로 두고, Memory Runtime 내부에서만
 * 사용하는 보강 분류기. 우선순위 기반으로 explicit source / role / project / working / session →
 * fallback working으로 안전 분류한다.
 *
 * **read-only / 순수 함수.** 실제 prompt payload·retrieval·provider/Cursor 어디에도 영향 없음.
 */

import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";
import { resolveMemoryScopeFromSource } from "@/lib/overlay/memoryScopeRuntime";

/**
 * Explicit scope token 매처. **순서가 의미를 가진다**(role → session → working → project → platform).
 *
 * - role 토큰은 source/memoryId에서 `role` 단어가 명시적으로 등장한 경우만 매칭(예: `role-policy`,
 *   `rolePolicy`, `role-knowledge`). "project" 같은 일반 명사보다 더 구체적이므로 우선순위 상위.
 * - "project" 같은 광범위한 토큰은 후순위로 두어 `projectMember-foo`의 부분 매칭이 다른 보다 구체적인
 *   역할/세션 토큰을 가리지 않도록 한다.
 */
const EXPLICIT_SCOPE_TOKEN_ORDER: readonly { readonly scope: MemoryScope; readonly tokens: readonly string[] }[] = [
  { scope: "role", tokens: ["role:", "role-", "rolepolicy", "rolekey", "roleknowledge", "role_identity"] },
  { scope: "session", tokens: ["session", "chatmessage", "dialogueexcerpt"] },
  { scope: "working", tokens: ["working", "workspace", "current-"] },
  { scope: "project", tokens: ["project"] },
  { scope: "platform", tokens: ["platform"] },
];

const ROLE_MEMORY_TOKENS: readonly string[] = [
  "role-policy",
  "role:",
  "rolepolicy",
  "roleidentity",
  "aiidentity",
  "role-knowledge",
];

const PROJECT_MEMORY_TOKENS: readonly string[] = [
  "project",
  "requirementsstatejson",
  "singlechatorchestration",
  "projectmember",
  "projectcontext",
];

const WORKING_MEMORY_TOKENS: readonly string[] = [
  "working",
  "current",
  "workspace",
  "localstorage",
  "sessionstorage",
];

const SESSION_MEMORY_TOKENS: readonly string[] = [
  "chatmessage",
  "dialogueexcerpt",
  "messengerprompttimelinelog",
  "prompttimeline",
];

function toLowerKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasAnyToken(text: string, tokens: readonly string[]): boolean {
  if (!text) return false;
  for (const t of tokens) {
    if (text.includes(t)) return true;
  }
  return false;
}

/**
 * Memory Runtime 후보의 `memoryId` / `source` / `roleKey` / `workspaceScreenKey`를 모아
 * 가장 합리적인 `MemoryScope`로 분류한다.
 *
 * 우선순위:
 * 1. source/memoryId에 explicit scope 토큰이 있으면 그대로 사용.
 * 2. role memory token 포함 → `role`.
 * 3. project memory token 포함 → `project`.
 * 4. working/workspaceScreenKey 기반 → `working`.
 * 5. session memory token 포함 → `session`.
 * 6. fallback: 기존 `resolveMemoryScopeFromSource` 결과 → 그래도 모르면 `working`.
 */
export function classifyMemoryRuntimeScope(input: {
  readonly source?: string | null;
  readonly memoryId?: string | null;
  readonly roleKey?: string | null;
  readonly workspaceScreenKey?: string | null;
}): MemoryScope {
  const source = toLowerKey(input.source);
  const memoryId = toLowerKey(input.memoryId);
  const workspace = toLowerKey(input.workspaceScreenKey);
  const roleKey = toLowerKey(input.roleKey);

  // 1. source/memoryId에 explicit scope token이 명시되어 있으면 그대로 사용.
  //    우선순위는 EXPLICIT_SCOPE_TOKEN_ORDER가 결정한다(role > session > working > project > platform).
  for (const candidate of [source, memoryId]) {
    if (!candidate) continue;
    for (const { scope, tokens } of EXPLICIT_SCOPE_TOKEN_ORDER) {
      if (hasAnyToken(candidate, tokens)) return scope;
    }
  }

  const composite = `${source} ${memoryId}`.trim();

  // 2. role memory(역할 관련 메모리 token + roleKey 존재).
  if (roleKey && hasAnyToken(composite, ROLE_MEMORY_TOKENS)) return "role";
  if (roleKey && composite.includes(roleKey)) return "role";

  // 3. project memory(도메인 모델·요구사항 stateJson 등).
  if (hasAnyToken(composite, PROJECT_MEMORY_TOKENS)) return "project";

  // 4. working memory(현재 화면/세션 storage/명시 working/workspace 매치).
  if (hasAnyToken(composite, WORKING_MEMORY_TOKENS)) return "working";
  if (workspace && composite.includes(workspace)) return "working";

  // 5. session memory(채팅/대화 발췌 등).
  if (hasAnyToken(composite, SESSION_MEMORY_TOKENS)) return "session";

  // 6. fallback: 기존 resolver의 보수적 추정이 working/project/role/platform이면 그대로 채택,
  //    `session`/알 수 없음은 보수적으로 "working"으로 통일(spec: fallback=working).
  const resolved = resolveMemoryScopeFromSource(input.source ?? null);
  if (resolved && resolved !== "session") return resolved;
  return "working";
}
