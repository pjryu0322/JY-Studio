import type { ProjectStructureCandidate } from "@prisma/client";
import {
  STRUCTURE_CONFLICT_KINDS,
  STRUCTURE_CANDIDATE_NODE_TYPES,
  type StructureConflict,
} from "@/lib/project-structure/projectStructureTypes";
import {
  fingerprintStructureText,
  normalizeForFingerprint,
} from "@/lib/project-structure/projectStructureExtractorPlan";

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeForFingerprint(text)
      .split(/[^a-z0-9가-힣]+/i)
      .filter((t) => t.length >= 2),
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function readMetadataString(meta: unknown, key: string): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  return String((meta as Record<string, unknown>)[key] ?? "").trim();
}

export function detectStructureConflicts(
  candidates: readonly Pick<
    ProjectStructureCandidate,
    "id" | "nodeType" | "title" | "summary" | "fingerprint" | "metadata" | "lifecycleStatus"
  >[],
): StructureConflict[] {
  const active = candidates.filter(
    (c) => c.lifecycleStatus !== "DEPRECATED" && c.lifecycleStatus !== "ARCHIVED",
  );
  const conflicts: StructureConflict[] = [];
  const seenPairs = new Set<string>();

  const pushPair = (kind: StructureConflict["kind"], a: string, b: string, score: number, message: string) => {
    const key = [a, b].sort().join("|");
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    conflicts.push({ kind, candidateIds: [a, b], score, message });
  };

  const requirements = active.filter((c) => c.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT);
  for (let i = 0; i < requirements.length; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      const a = requirements[i]!;
      const b = requirements[j]!;
      const srcA = readMetadataString(a.metadata, "sourceMessageId");
      const srcB = readMetadataString(b.metadata, "sourceMessageId");
      if (srcA && srcA === srcB) {
        pushPair(STRUCTURE_CONFLICT_KINDS.DUPLICATE_REQUIREMENT, a.id, b.id, 1, "동일 sourceMessageId Requirement");
        continue;
      }
      if (a.fingerprint && a.fingerprint === b.fingerprint) {
        pushPair(STRUCTURE_CONFLICT_KINDS.DUPLICATE_REQUIREMENT, a.id, b.id, 0.95, "동일 fingerprint Requirement");
        continue;
      }
      const sim = jaccardSimilarity(`${a.title} ${a.summary}`, `${b.title} ${b.summary}`);
      if (sim >= 0.72) {
        pushPair(STRUCTURE_CONFLICT_KINDS.SEMANTIC_DUPLICATE, a.id, b.id, sim, "유사한 Requirement 표현");
      }
    }
  }

  const features = active.filter((c) => c.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE);
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i]!;
      const b = features[j]!;
      if (a.fingerprint && a.fingerprint === b.fingerprint) {
        pushPair(STRUCTURE_CONFLICT_KINDS.DUPLICATE_FEATURE, a.id, b.id, 0.95, "동일 fingerprint Feature");
        continue;
      }
      const sim = jaccardSimilarity(`${a.title} ${a.summary}`, `${b.title} ${b.summary}`);
      if (sim >= 0.8) {
        pushPair(STRUCTURE_CONFLICT_KINDS.SIMILAR_NODE, a.id, b.id, sim, "유사 Feature");
      }
    }
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.nodeType !== b.nodeType) continue;
      if (a.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT || a.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE) {
        continue;
      }
      const fpA = a.fingerprint ?? fingerprintStructureText(a.nodeType, a.title, a.summary);
      const fpB = b.fingerprint ?? fingerprintStructureText(b.nodeType, b.title, b.summary);
      if (fpA === fpB) {
        pushPair(STRUCTURE_CONFLICT_KINDS.SIMILAR_NODE, a.id, b.id, 0.9, `유사 ${a.nodeType}`);
        continue;
      }
      const sim = jaccardSimilarity(`${a.title} ${a.summary}`, `${b.title} ${b.summary}`);
      if (sim >= 0.85) {
        pushPair(STRUCTURE_CONFLICT_KINDS.SEMANTIC_DUPLICATE, a.id, b.id, sim, `동일 의미의 다른 ${a.nodeType} 표현`);
      }
    }
  }

  return conflicts.sort((x, y) => y.score - x.score);
}
