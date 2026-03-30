/** Task 초안 requirement 노드 설명에 부가 메타(리뷰어·도구용)를 넣을 때 사용 */

export const REQUIREMENT_META_PREFIX = "[requirement-meta]";

export type StoredRequirementType = "FUNCTIONAL" | "NON_FUNCTIONAL";

export type NfrCategory = "performance" | "security" | "quality" | "operational" | "policy";

export function withRequirementMeta(
  body: string,
  meta: { requirementType: StoredRequirementType; nfrCategory?: NfrCategory | null }
): string {
  const parts = [`type=${meta.requirementType}`];
  if (meta.requirementType === "NON_FUNCTIONAL" && meta.nfrCategory) {
    parts.push(`nfr=${meta.nfrCategory}`);
  }
  const head = `${REQUIREMENT_META_PREFIX} ${parts.join(" ")}`;
  const t = body.trim();
  return t ? `${head}\n\n${t}` : head;
}

export function parseRequirementDescriptionMeta(description: string | null | undefined): {
  requirementType: StoredRequirementType | null;
  nfrCategory: NfrCategory | null;
  body: string;
} {
  const raw = description?.trim() ?? "";
  if (!raw.startsWith(REQUIREMENT_META_PREFIX)) {
    return { requirementType: null, nfrCategory: null, body: raw };
  }
  const nl = raw.indexOf("\n");
  const first = nl === -1 ? raw : raw.slice(0, nl);
  const body = nl === -1 ? "" : raw.slice(nl).trim();
  let requirementType: StoredRequirementType | null = null;
  let nfrCategory: NfrCategory | null = null;
  const rest = first.slice(REQUIREMENT_META_PREFIX.length).trim();
  for (const token of rest.split(/\s+/)) {
    const [k, v] = token.split("=", 2);
    if (k === "type" && (v === "FUNCTIONAL" || v === "NON_FUNCTIONAL")) {
      requirementType = v;
    }
    if (k === "nfr" && v) {
      nfrCategory = v as NfrCategory;
    }
  }
  return { requirementType, nfrCategory, body };
}
