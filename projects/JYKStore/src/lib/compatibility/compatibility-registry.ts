/**
 * Compatibility registry — inventory of legacy boundaries kept for bookmarks/clients.
 * Does not implement telemetry. Removal requires explicit gate per entry.
 */
export type CompatibilityEntry = {
  id: string;
  legacyContract: string;
  canonicalContract: string;
  reason: string;
  removalGate: string;
};

export const COMPATIBILITY_REGISTRY: readonly CompatibilityEntry[] = [
  {
    id: "admin-queue-aliases",
    legacyContract: "queue=accept|quality|provider-review|approval-publish",
    canonicalContract: "queue=receipt|generation|publish (via normalizeAdminWorkQueue)",
    reason: "Deep-link / bookmark compatibility",
    removalGate: "P14 after zero legacy query hits confirmed",
  },
  {
    id: "admin-step-aliases",
    legacyContract: "?step=providerConfirm|decision|searchValidation|quality",
    canonicalContract: "resolveAdminWorkflowStepQuery → canonical AdminWorkflowStep",
    reason: "Legacy review detail deep-links",
    removalGate: "P14 after bookmark window",
  },
  {
    id: "legacy-builder-410",
    legacyContract: "POST .../chunks|evaluate|knowledge-unit-drafts → 410 LEGACY_BUILDER_DISABLED",
    canonicalContract: "Worker ZIP + Store generation path",
    reason: "External clients may still call frozen routes",
    removalGate: "Client confirmation + release note; do not delete in P12",
  },
  {
    id: "provider-legacy-docling-ui",
    legacyContract: "NEXT_PUBLIC_PROVIDER_LEGACY_DOCLING=1",
    canonicalContract: "ZIP-only provider upload UX",
    reason: "Optional debug UI for Docling import",
    removalGate: "P11+ schema cutover after write path removal",
  },
  {
    id: "worker-request-stable-mirror",
    legacyContract: "payloads/.../worker-request/source.zip",
    canonicalContract: "immutable source-revisions/{id}/source.zip",
    reason: "Lazy backfill / legacy readers",
    removalGate: "After all revisions use dedicated keys",
  },
  {
    id: "json-vector-fallback",
    legacyContract: "JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK",
    canonicalContract: "JYKSTORE_REQUIRE_PGVECTOR / pgvector path",
    reason: "Ops degraded mode when pgvector unavailable",
    removalGate: "Production always require pgvector",
  },
  {
    id: "admin-review-service-facade",
    legacyContract: "@/lib/admin-review-service publish helpers",
    canonicalContract: "@/lib/publishing/*",
    reason: "Import compatibility during P12 split",
    removalGate: "After all call sites import publishing/",
  },
] as const;
