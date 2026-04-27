import { randomUUID } from "node:crypto";
import {
  loadPrototypeRunsEnvelope,
  upsertPrototypeRun,
} from "@/lib/prototype/prototypeRunFileStore";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import type {
  PrototypeRun,
  PrototypeRunStatus,
  PrototypeRunStatusReason,
} from "@/lib/prototype/prototypeRunTypes";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRun(raw: PrototypeRun): PrototypeRun {
  return {
    ...raw,
    changedFiles: Array.isArray(raw.changedFiles) ? [...raw.changedFiles] : [],
  };
}

export function slugifyForBranchSegment(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "project";
}

export function buildPrototypeBranchName(projectName: string, runId: string): string {
  const slug = slugifyForBranchSegment(projectName);
  const short = runId.replace(/-/g, "").slice(0, 8);
  return `prototype/${slug}/${short}`;
}

export function createPrototypeRun(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly selectedTemplate: string;
  readonly promptSnapshot: string;
  readonly initialStatus: PrototypeRunStatus;
  readonly statusReason: PrototypeRunStatusReason;
}): PrototypeRun {
  const id = randomUUID();
  const t = nowIso();
  const branchName = buildPrototypeBranchName(input.projectName, id);
  const run: PrototypeRun = {
    id,
    projectId: input.projectId.trim(),
    selectedTemplate: input.selectedTemplate,
    promptSnapshot: input.promptSnapshot,
    branchName,
    cursorRunId: null,
    status: input.initialStatus,
    statusReason: input.statusReason,
    commitSha: null,
    changedFiles: [],
    aiReviewDecision: null,
    aiReviewSummary: null,
    prUrl: null,
    prNumber: null,
    mergeCommitSha: null,
    previewUrl: null,
    createdAt: t,
    updatedAt: t,
  };
  upsertPrototypeRun(run.projectId, run);
  logPrototypePipelineEvent("prototype_run_created", { projectId: run.projectId, runId: run.id, status: run.status });
  return run;
}

export function updatePrototypeRunStatus(
  projectId: string,
  runId: string,
  patch: Partial<
    Pick<
      PrototypeRun,
      | "status"
      | "statusReason"
      | "cursorRunId"
      | "commitSha"
      | "changedFiles"
      | "aiReviewDecision"
      | "aiReviewSummary"
      | "prUrl"
      | "prNumber"
      | "mergeCommitSha"
      | "previewUrl"
    >
  >,
): PrototypeRun | null {
  const env = loadPrototypeRunsEnvelope(projectId);
  const prev = env.runs.find((r) => r.id === runId);
  if (!prev) return null;
  const next: PrototypeRun = normalizeRun({
    ...prev,
    ...patch,
    changedFiles: patch.changedFiles ?? prev.changedFiles,
    updatedAt: nowIso(),
  });
  upsertPrototypeRun(projectId, next);
  return next;
}

export function getLatestPrototypeRun(projectId: string): PrototypeRun | null {
  const env = loadPrototypeRunsEnvelope(projectId);
  if (!env.runs.length) return null;
  const sorted = [...env.runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sorted[0] ?? null;
}

export function getPrototypeRunById(projectId: string, runId: string): PrototypeRun | null {
  const env = loadPrototypeRunsEnvelope(projectId);
  return env.runs.find((r) => r.id === runId) ?? null;
}

export function attachPreviewUrl(projectId: string, runId: string, previewUrl: string): PrototypeRun | null {
  const updated = updatePrototypeRunStatus(projectId, runId, { previewUrl, status: "PREVIEW_READY", statusReason: null });
  if (updated) {
    logPrototypePipelineEvent("prototype_preview_ready", { projectId, runId, previewUrl });
  }
  return updated;
}

export function markReworkRequired(projectId: string, runId: string, summary: string): PrototypeRun | null {
  const u = updatePrototypeRunStatus(projectId, runId, {
    status: "REWORK_REQUIRED",
    statusReason: null,
    aiReviewDecision: "REWORK",
    aiReviewSummary: summary,
  });
  if (u) logPrototypePipelineEvent("prototype_rework_required", { projectId, runId });
  return u;
}

export function markFailed(projectId: string, runId: string, reason: PrototypeRunStatusReason, message?: string): PrototypeRun | null {
  const u = updatePrototypeRunStatus(projectId, runId, {
    status: "FAILED",
    statusReason: reason,
    aiReviewSummary: message ?? null,
  });
  if (u) logPrototypePipelineEvent("prototype_failed", { projectId, runId, reason });
  return u;
}

export function markBlocked(projectId: string, runId: string, reason: PrototypeRunStatusReason): PrototypeRun | null {
  const u = updatePrototypeRunStatus(projectId, runId, { status: "BLOCKED", statusReason: reason });
  if (u) logPrototypePipelineEvent("prototype_cursor_blocked", { projectId, runId, reason });
  return u;
}
