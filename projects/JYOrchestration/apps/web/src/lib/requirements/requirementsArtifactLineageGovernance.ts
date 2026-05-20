/**
 * Artifact lineage compaction — prune stale branches, keep summary head.
 */

import type { ArtifactLifecycleEntryWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { MAX_ARTIFACT_LINEAGE_ACTIVE } from "@/lib/requirements/requirementsOrchestrationConstants";

export function compactArtifactLineage(
  entries: readonly ArtifactLifecycleEntryWire[] | undefined,
): readonly ArtifactLifecycleEntryWire[] {
  if (!entries?.length) return [];

  const byKey = new Map<string, ArtifactLifecycleEntryWire[]>();
  for (const e of entries) {
    const list = byKey.get(e.artifactKey) ?? [];
    list.push(e);
    byKey.set(e.artifactKey, list);
  }

  const out: ArtifactLifecycleEntryWire[] = [];
  for (const [, list] of byKey) {
    const sorted = [...list].sort(
      (a, b) => Date.parse(b.updatedAt ?? b.generatedAt ?? "") - Date.parse(a.updatedAt ?? a.generatedAt ?? ""),
    );
    const stale = sorted.filter((e) => e.stale);
    const head = sorted.find((e) => !e.stale) ?? sorted[0];
    if (stale.length > 3) {
      out.push({
        ...stale[0]!,
        lineageLabel: "archive-summary",
        staleReason: `pruned:${stale.length - 2}`,
      });
      out.push(...stale.slice(-2));
    } else {
      out.push(...stale);
    }
    if (head) out.push(head);
  }

  return out.slice(-MAX_ARTIFACT_LINEAGE_ACTIVE);
}
