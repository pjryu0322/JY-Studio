/**
 * ENV_TEST 플랫폼 머지 스모크 전용 파일 허용 규칙.
 * 일반 Task의 변경 파일 스코프 가드와 별도이며, evaluateEnvTestMergeGuards + taskKind=ENV_TEST 에서만 적용된다.
 */

export const ENV_TEST_MERGE_ALLOWED_ROOT_PREFIX = "orchestration-test/";

/** PR 파일 1단계: orchestration-test/*.md */
export const ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD = "orchestration-test/*.md";

/** PR 파일 중첩: orchestration-test/ 이하 깊이의 .md (문자열 값은 ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD) */
export const ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD = "orchestration-test/**/*.md";

/** PR files API filename 정규화 — 가드 오류 메시지와 화이트리스트 판정에 동일하게 사용 */
export function normalizeEnvTestMergePrFilename(filename: string): string {
  return String(filename ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

export function isEnvTestMergeWhitelistedPath(
  filename: string
): { ok: boolean; matchedPathPattern?: string } {
  const n = normalizeEnvTestMergePrFilename(filename);
  if (!n || n.includes("..")) {
    return { ok: false };
  }
  if (!n.startsWith(ENV_TEST_MERGE_ALLOWED_ROOT_PREFIX)) {
    return { ok: false };
  }
  if (!n.endsWith(".md")) {
    return { ok: false };
  }
  const rest = n.slice(ENV_TEST_MERGE_ALLOWED_ROOT_PREFIX.length);
  if (!rest) {
    return { ok: false };
  }
  const segments = rest.split("/").filter((s) => s.length > 0);
  if (!segments.length) {
    return { ok: false };
  }
  for (const seg of segments) {
    if (seg === "." || seg === "..") {
      return { ok: false };
    }
  }
  const baseName = segments[segments.length - 1];
  if (!baseName.endsWith(".md")) {
    return { ok: false };
  }
  const stem = baseName.slice(0, -3);
  if (!stem) {
    return { ok: false };
  }
  const matchedPathPattern =
    segments.length === 1 ? ENV_TEST_MERGE_WHITELIST_PATTERN_TOP_LEVEL_MD : ENV_TEST_MERGE_WHITELIST_PATTERN_NESTED_MD;
  return { ok: true, matchedPathPattern };
}
