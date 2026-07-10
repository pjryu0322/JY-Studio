import {
  isBroadSemanticTopicKey,
  kuSourcePathRepresentativeScore,
} from "./ku-draft-topic-key";

export type KuDraftDedupRecord = {
  sourceDocumentId: string;
  title: string;
  sourcePath: string | null;
  primaryHeading: string | null;
  contentChecksum: string;
  semanticTopicKey?: string | null;
  canonicalSourcePath?: string | null;
  rawContentChecksum?: string | null;
};

export type KuDraftDuplicateSourceRef = {
  sourceDocumentId: string;
  sourcePath: string | null;
  title: string;
  reason: string;
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
  if (
    candidate.rawContentChecksum &&
    existing.rawContentChecksum &&
    candidate.rawContentChecksum === existing.rawContentChecksum
  ) {
    return true;
  }

  const candidateTopic = candidate.semanticTopicKey ?? null;
  const existingTopic = existing.semanticTopicKey ?? null;
  const candidateCanonical = candidate.canonicalSourcePath ?? null;
  const existingCanonical = existing.canonicalSourcePath ?? null;

  if (candidateTopic && existingTopic && candidateTopic === existingTopic) {
    if (!isBroadSemanticTopicKey(candidateTopic)) {
      return true;
    }
    if (
      candidateCanonical &&
      existingCanonical &&
      candidateCanonical === existingCanonical
    ) {
      return true;
    }
    if (areKuDraftTitlesSimilar(candidate.title, existing.title)) {
      return true;
    }
  }

  if (
    candidate.sourcePath &&
    existing.sourcePath &&
    candidate.sourcePath === existing.sourcePath &&
    candidate.primaryHeading &&
    existing.primaryHeading &&
    normalizeKuDraftTitleKey(candidate.primaryHeading) ===
      normalizeKuDraftTitleKey(existing.primaryHeading)
  ) {
    return true;
  }

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

function representativeScore(record: KuDraftDedupRecord): number {
  return kuSourcePathRepresentativeScore(record.sourcePath);
}

export function dedupeKuDraftCandidates<T extends KuDraftDedupRecord>(candidates: T[]): {
  kept: T[];
  mergedCount: number;
  mergedSourcesByKeptIndex: Map<number, KuDraftDuplicateSourceRef[]>;
} {
  const kept: T[] = [];
  const mergedSourcesByKeptIndex = new Map<number, KuDraftDuplicateSourceRef[]>();
  let mergedCount = 0;

  for (const candidate of candidates) {
    const duplicateIndex = kept.findIndex((item) => isKuDraftDuplicate(candidate, item));
    if (duplicateIndex < 0) {
      kept.push(candidate);
      continue;
    }

    mergedCount += 1;
    const existing = kept[duplicateIndex]!;
    const ref: KuDraftDuplicateSourceRef = {
      sourceDocumentId: candidate.sourceDocumentId,
      sourcePath: candidate.sourcePath,
      title: candidate.title,
      reason: "semanticTopicKey duplicate",
    };
    const bucket = mergedSourcesByKeptIndex.get(duplicateIndex) ?? [];
    bucket.push(ref);
    mergedSourcesByKeptIndex.set(duplicateIndex, bucket);

    if (representativeScore(candidate) > representativeScore(existing)) {
      kept[duplicateIndex] = candidate;
      const prevRefs = mergedSourcesByKeptIndex.get(duplicateIndex) ?? [];
      prevRefs.push({
        sourceDocumentId: existing.sourceDocumentId,
        sourcePath: existing.sourcePath,
        title: existing.title,
        reason: "replaced by higher-priority source",
      });
      mergedSourcesByKeptIndex.set(duplicateIndex, prevRefs);
    }
  }

  return { kept, mergedCount, mergedSourcesByKeptIndex };
}
