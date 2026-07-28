import type { KnowledgeScopeInventoryStatus } from "@prisma/client";
import type { KnowledgeScopeInventorySummaryDto } from "@/lib/knowledge-scope/inventory-types";

/** Minimal summary shape for pure gate checks (no DB). */
export type KnowledgeScopeGateSummary = {
  status: KnowledgeScopeInventoryStatus;
  pendingCount: number;
  reviewRequiredCount: number;
  providerRequestedCount: number;
  includedCount: number;
  workingCopyId?: string | null;
  inventorySourceFingerprint?: string | null;
};

export function toKnowledgeScopeGateSummary(
  summary:
    | KnowledgeScopeGateSummary
    | KnowledgeScopeInventorySummaryDto
    | null
    | undefined,
): KnowledgeScopeGateSummary | null {
  if (!summary) return null;
  if ("counts" in summary) {
    return {
      status: summary.status,
      pendingCount: summary.counts.pending,
      reviewRequiredCount: summary.counts.reviewRequired,
      providerRequestedCount: summary.counts.providerRequested,
      includedCount: summary.counts.included,
      workingCopyId: summary.workingCopyId,
      inventorySourceFingerprint: summary.inventorySourceFingerprint,
    };
  }
  return summary;
}

function hasWorkingCopyBinding(gate: KnowledgeScopeGateSummary): boolean {
  return Boolean(gate.workingCopyId?.trim()) && Boolean(gate.inventorySourceFingerprint?.trim());
}

export function canFinalizeKnowledgeScope(
  summary:
    | KnowledgeScopeGateSummary
    | KnowledgeScopeInventorySummaryDto
    | null
    | undefined,
): boolean {
  const gate = toKnowledgeScopeGateSummary(summary);
  if (!gate) return false;
  if (gate.status !== "DRAFT") return false;
  if (!hasWorkingCopyBinding(gate)) return false;
  return (
    gate.pendingCount === 0 &&
    gate.reviewRequiredCount === 0 &&
    gate.providerRequestedCount === 0 &&
    gate.includedCount >= 1
  );
}

export function isKnowledgeScopeReadyForGeneration(
  summary:
    | KnowledgeScopeGateSummary
    | KnowledgeScopeInventorySummaryDto
    | null
    | undefined,
): boolean {
  const gate = toKnowledgeScopeGateSummary(summary);
  if (!gate) return false;
  if (!hasWorkingCopyBinding(gate)) return false;
  if (
    gate.pendingCount > 0 ||
    gate.reviewRequiredCount > 0 ||
    gate.providerRequestedCount > 0 ||
    gate.includedCount < 1
  ) {
    return false;
  }
  return gate.status === "FINALIZED";
}
