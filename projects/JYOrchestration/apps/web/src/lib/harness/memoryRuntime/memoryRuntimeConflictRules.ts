/**
 * Harness Phase H4.5 — **Memory Runtime Conflict Rules**.
 *
 * "이번 턴의 방향 키워드"와 "메모리 텍스트"가 카테고리별 상반 키워드와 부딪히는지 감지한다.
 *
 * **warning only / read-only.** 결과는 `evaluateMemoryFreshness` / planner finding의 입력으로만
 * 사용되며 실제 메모리 삭제·persistence·retrieval 동작은 하지 않는다.
 *
 * - 카테고리: architecture / auth / storage / deployment.
 * - 충돌 정의: 한 카테고리 안에서 메모리 텍스트가 `A`를 언급하고, 현재 방향 키워드가 `B`를 가진 경우(또는 그 반대).
 */

/** 단순화된 카테고리 키. */
export type MemoryRuntimeConflictCategory =
  | "architecture"
  | "auth"
  | "storage"
  | "deployment";

/** 카테고리별 상반 키워드 쌍 정의. 각 entry의 두 set은 서로 충돌한다고 본다. */
const CONFLICT_RULE_TABLE: Readonly<
  Record<MemoryRuntimeConflictCategory, readonly (readonly [readonly string[], readonly string[]])[]>
> = {
  architecture: [
    [["monolith", "monolithic"], ["microservice", "microservices"]],
    [["client-side", "csr", "spa-only"], ["server-side", "ssr", "server rendering"]],
  ],
  auth: [
    [["session", "session-based", "cookie-session"], ["jwt", "json web token", "bearer-jwt"]],
    [["cookie", "set-cookie", "cookie auth"], ["bearer token", "authorization: bearer", "bearer auth"]],
  ],
  storage: [
    [["localstorage", "local storage"], ["server db", "server database", "rdbms", "postgres", "mysql"]],
    [["sql", "rdbms", "relational db"], ["nosql", "mongodb", "documentdb", "dynamodb"]],
  ],
  deployment: [
    [["on-premise", "on premise", "self-hosted"], ["cloud", "aws", "gcp", "azure"]],
    [["static hosting", "static site"], ["server runtime", "node server", "long-running server"]],
  ],
};

function normalize(text: string | null | undefined): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\s_/.]+/g, " ")
    .trim();
}

function includesAny(haystack: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

/**
 * `memoryText`와 `currentDirectionalKeywords`가 한 카테고리에서 상반되면 true.
 *
 * - directional keywords가 비어 있으면 false(판단 보류).
 * - 양쪽 모두 같은 진영(A↔A)이면 false.
 */
export function detectMemoryRuntimeDirectionalConflict(input: {
  readonly memoryText: string | null | undefined;
  readonly currentDirectionalKeywords: readonly string[] | null | undefined;
}): boolean {
  const memory = normalize(input.memoryText);
  if (!memory) return false;
  const directional = (input.currentDirectionalKeywords ?? [])
    .map((s) => normalize(s))
    .filter(Boolean);
  if (!directional.length) return false;
  const directionalText = ` ${directional.join(" ")} `;

  for (const category of Object.keys(CONFLICT_RULE_TABLE) as MemoryRuntimeConflictCategory[]) {
    for (const [aSide, bSide] of CONFLICT_RULE_TABLE[category]) {
      const memoryA = includesAny(memory, aSide);
      const memoryB = includesAny(memory, bSide);
      const dirA = includesAny(directionalText, aSide);
      const dirB = includesAny(directionalText, bSide);
      if ((memoryA && dirB) || (memoryB && dirA)) return true;
    }
  }
  return false;
}

/**
 * 메모리 텍스트가 어떤 카테고리의 어느 쪽을 가리키는지 1차 라벨링(diagnostic 용).
 *
 * 결과는 finding message 보조 텍스트 등에서 사용될 수 있다. 충돌 판정 자체는
 * `detectMemoryRuntimeDirectionalConflict`를 사용한다(이쪽은 단방향 진단 정보).
 */
export function classifyMemoryRuntimeConflictCategory(
  memoryText: string | null | undefined
): MemoryRuntimeConflictCategory | null {
  const text = normalize(memoryText);
  if (!text) return null;
  for (const category of Object.keys(CONFLICT_RULE_TABLE) as MemoryRuntimeConflictCategory[]) {
    for (const [aSide, bSide] of CONFLICT_RULE_TABLE[category]) {
      if (includesAny(text, aSide) || includesAny(text, bSide)) return category;
    }
  }
  return null;
}

/** UI/문서 노출용: 카테고리 키 목록(정렬). */
export function listMemoryRuntimeConflictCategories(): readonly MemoryRuntimeConflictCategory[] {
  return (Object.keys(CONFLICT_RULE_TABLE) as MemoryRuntimeConflictCategory[]).sort();
}
