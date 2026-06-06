/** P3-M30 이후 UI/프롬프트 표시용 Mock → 샘플 데이터 normalize (roleKind mock_data 유지) */

const DISPLAY_REPLACEMENTS: readonly Readonly<[RegExp, string]>[] = [
  [/Mock\s*데이터\s*구조\s*정의/giu, "샘플 데이터 생성"],
  [/Mock\s*데이터\s*기본\s*세트\s*준비/giu, "샘플 데이터 생성"],
  [/데이터\s*\/\s*Mock\s*구현/giu, "샘플 데이터 구현"],
  [/Mock\s*데이터/giu, "샘플 데이터"],
];

export function normalizeCodeTaskDisplayLabel(text: string | null | undefined): string {
  let out = String(text ?? "").trim();
  if (!out) return out;
  for (const [pattern, replacement] of DISPLAY_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** 신규 plan용 branch slug — 기존 run에 workBranch가 있으면 그대로 사용 */
export function resolveCodeTaskWorkBranchForPlan(codeTaskId: string, existingWorkBranch?: string | null): string {
  const preserved = String(existingWorkBranch ?? "").trim();
  if (preserved) return preserved;

  const id = codeTaskId.trim().toLowerCase();
  const slug = id
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.includes("mock") && !slug.includes("sample-data")) {
    return `wip/cursor/${slug.replace(/mock/g, "sample-data")}`;
  }
  return `wip/cursor/${slug || "task"}`;
}
