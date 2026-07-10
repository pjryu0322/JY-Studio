export type KuDraftDedupRecord = {
  sourceDocumentId: string;
  title: string;
  sourcePath: string | null;
  primaryHeading: string | null;
  contentChecksum: string;
};

export function computeKuDraftContentChecksum(content: string): string {
  const normalized = content.trim().replace(/\s+/g, " ");
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return `ku${(hash >>> 0).toString(16)}`;
}

export function normalizeKuDraftTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9가-힣]/gi, "");
}

export function areKuDraftTitlesSimilar(a: string, b: string): boolean {
  const left = normalizeKuDraftTitleKey(a);
  const right = normalizeKuDraftTitleKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return shorter / longer >= 0.72;
  }
  return false;
}

export function isKuDraftDuplicate(
  candidate: KuDraftDedupRecord,
  existing: KuDraftDedupRecord,
): boolean {
  if (candidate.contentChecksum && candidate.contentChecksum === existing.contentChecksum) {
    return true;
  }
  if (candidate.sourceDocumentId !== existing.sourceDocumentId) {
    if (
      candidate.sourcePath &&
      existing.sourcePath &&
      candidate.sourcePath === existing.sourcePath &&
      areKuDraftTitlesSimilar(candidate.title, existing.title)
    ) {
      return true;
    }
    return false;
  }

  if (
    candidate.primaryHeading &&
    existing.primaryHeading &&
    normalizeKuDraftTitleKey(candidate.primaryHeading) ===
      normalizeKuDraftTitleKey(existing.primaryHeading)
  ) {
    return true;
  }

  return areKuDraftTitlesSimilar(candidate.title, existing.title);
}

export function dedupeKuDraftCandidates<T extends KuDraftDedupRecord>(candidates: T[]): {
  kept: T[];
  mergedCount: number;
} {
  const kept: T[] = [];
  let mergedCount = 0;

  for (const candidate of candidates) {
    const duplicate = kept.some((item) => isKuDraftDuplicate(candidate, item));
    if (duplicate) {
      mergedCount += 1;
      continue;
    }
    kept.push(candidate);
  }

  return { kept, mergedCount };
}
