/**
 * Legacy / DB string → strongly typed PackWorkflowFacts fields.
 * Only Facts loader and compatibility adapters should import this.
 */
import { PackStatus } from "@prisma/client";
import {
  PackReviewStatus,
  type PackReviewStatusValue,
} from "@/lib/pack-review-status";
import type {
  AdminProviderReviewPhase,
  AdminServiceValidationPhase,
  AdminWorkerZipPhase,
} from "@/lib/workflow/admin-workflow-state";

const PACK_STATUSES = new Set<string>(Object.values(PackStatus));
const WORKER_ZIP_PHASES = new Set<AdminWorkerZipPhase>([
  "NONE",
  "REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
const PROVIDER_PHASES = new Set<AdminProviderReviewPhase>([
  "NONE",
  "REQUESTED",
  "CONFIRMED",
  "WITHDRAWN",
]);
const SERVICE_PHASES = new Set<AdminServiceValidationPhase>(["NONE", "PASSED"]);
const REVIEW_STATUSES = new Set<string>(Object.values(PackReviewStatus));

export function normalizePackStatus(raw: unknown): PackStatus {
  const s = String(raw ?? "DRAFT");
  if (PACK_STATUSES.has(s)) return s as PackStatus;
  return PackStatus.DRAFT;
}

export function normalizeWorkerZipPhase(raw: unknown): AdminWorkerZipPhase {
  const s = String(raw ?? "NONE");
  if (WORKER_ZIP_PHASES.has(s as AdminWorkerZipPhase)) {
    return s as AdminWorkerZipPhase;
  }
  if (s === "RUNNING") return "ACCEPTED";
  if (s === "PASS" || s === "DONE") return "COMPLETED";
  if (s === "PENDING") return "REQUESTED";
  return "NONE";
}

export function normalizeServiceValidationPhase(
  raw: unknown,
): AdminServiceValidationPhase {
  const s = String(raw ?? "NONE");
  if (SERVICE_PHASES.has(s as AdminServiceValidationPhase)) {
    return s as AdminServiceValidationPhase;
  }
  if (s === "PASS" || s === "COMPLETED" || s === "DONE") return "PASSED";
  return "NONE";
}

export function normalizeProviderReviewPhase(raw: unknown): AdminProviderReviewPhase {
  const s = String(raw ?? "NONE");
  if (PROVIDER_PHASES.has(s as AdminProviderReviewPhase)) {
    return s as AdminProviderReviewPhase;
  }
  return "NONE";
}

export function normalizePackReviewStatus(
  raw: unknown,
): PackReviewStatusValue | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  if (REVIEW_STATUSES.has(s)) return s as PackReviewStatusValue;
  if (s === "REVIEWING") return PackReviewStatus.IN_REVIEW;
  return null;
}
