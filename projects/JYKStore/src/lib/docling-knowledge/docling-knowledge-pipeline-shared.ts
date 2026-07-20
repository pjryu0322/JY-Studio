/**
 * Shared DB loaders and binding helpers for Docling knowledge pipeline
 * (status reads and start/execute).
 */
import { DoclingImportBundleStatus } from "@prisma/client";
import {
  parseKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";

export function asPipelineRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export async function loadOwnedPackForKnowledgePipeline(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) return { error: "PROFILE_REQUIRED" as const };

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: { distributionMetadata: true },
      },
    },
  });
  if (!pack) return { error: "NOT_FOUND" as const };
  return { profile, pack };
}

export async function loadActiveDoclingContext(packId: string, versionId: string) {
  const bundle = await prisma.doclingImportBundle.findFirst({
    where: {
      packId,
      versionId,
      isActive: true,
      status: DoclingImportBundleStatus.REVIEW_READY,
    },
    include: {
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });
  return { bundle, nd: bundle?.normalizedDocuments[0] ?? null };
}

/** Pure: does a run binding still match active Pack·Version·Bundle·ND materials? */
export function bindingMatchesActive(input: {
  binding: KnowledgeRunBinding | null;
  versionId: string;
  ndId: string;
  fingerprint: string | null;
  bundleId: string;
}): boolean {
  if (!input.binding || !input.fingerprint) return false;
  return (
    input.binding.versionId === input.versionId &&
    input.binding.normalizedDocumentId === input.ndId &&
    input.binding.fingerprint === input.fingerprint &&
    input.binding.bundleId === input.bundleId
  );
}

export async function loadLatestKnowledgePipelineContext(packId: string): Promise<{
  versionId: string;
  bundleId: string;
  ndId: string;
  fingerprint: string;
  runStatus: string | null;
  steps: Array<{ step: string; status: string; details: Record<string, unknown> | null }>;
  pipelineCurrent: boolean;
} | null> {
  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    select: { id: true },
  });
  if (!version) return null;

  const { bundle, nd } = await loadActiveDoclingContext(packId, version.id);
  if (!bundle || !nd?.fingerprint) return null;

  const latest = await prisma.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
    },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  if (!latest) return null;

  const readyStep = latest.steps.find((s) => s.step === "READY_FOR_REVIEW");
  const binding =
    parseKnowledgeRunBinding(latest.summary) ??
    (() => {
      const details = asPipelineRecord(readyStep?.details);
      if (!details) return null;
      return {
        v: 1 as const,
        versionId: String(details.versionId ?? ""),
        normalizedDocumentId: String(details.normalizedDocumentId ?? ""),
        fingerprint: String(details.fingerprint ?? ""),
        bundleId: String(details.bundleId ?? ""),
        indexGenerationId: String(details.indexGenerationId ?? ""),
        heartbeatAt: null,
        cancelRequestedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        attempt: 0,
        failureCode: null,
        failureMessage: null,
        requestedByUserId: null,
        requestedByClientId: null,
        userMessage: null,
      };
    })();

  const pipelineCurrent = bindingMatchesActive({
    binding,
    versionId: version.id,
    ndId: nd.id,
    fingerprint: nd.fingerprint,
    bundleId: bundle.id,
  });

  return {
    versionId: version.id,
    bundleId: bundle.id,
    ndId: nd.id,
    fingerprint: nd.fingerprint,
    runStatus: latest.status,
    steps: latest.steps.map((s) => ({
      step: s.step,
      status: s.status,
      details: asPipelineRecord(s.details),
    })),
    pipelineCurrent,
  };
}
