/**
 * PrototypeRun persistence — 파일 기반(.data/prototype-runs). DB 마이그레이션 없음.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import type {
  PrototypeRun,
  PrototypeRunFileEnvelope,
  PrototypeRunStatus,
  PrototypeRunStatusReason,
} from "@/lib/prototype/prototypeRunTypes";

function dataDir(): string {
  return join(process.cwd(), ".data", "prototype-runs");
}

function filePath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(dataDir(), `${safe}.json`);
}

function emptyEnvelope(): PrototypeRunFileEnvelope {
  return { runs: [] };
}

function loadEnvelope(projectId: string): PrototypeRunFileEnvelope {
  const p = filePath(projectId);
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<PrototypeRunFileEnvelope>;
    if (!parsed || !Array.isArray(parsed.runs)) return emptyEnvelope();
    return { runs: parsed.runs.map((r) => normalizeStoredRun(r as Record<string, unknown>)) };
  } catch {
    return emptyEnvelope();
  }
}

function saveEnvelope(projectId: string, envelope: PrototypeRunFileEnvelope): void {
  const p = filePath(projectId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(envelope, null, 2), "utf8");
}

function migrateStatus(raw: string): PrototypeRunStatus {
  if (raw === "PR_READY") return "PR_OPENED";
  if (raw === "MERGE_READY") return "MERGED";
  if (raw === "FLOW_CONFIRMED") return "PROMPT_READY";
  return raw as PrototypeRunStatus;
}

/** 이전 JSON(mergeCommitSha, PR_READY 등) 호환. */
export function normalizeStoredRun(raw: Record<string, unknown>): PrototypeRun {
  const mergeSha =
    (typeof raw.mergeSha === "string" ? raw.mergeSha : null) ??
    (typeof raw.mergeCommitSha === "string" ? raw.mergeCommitSha : null) ??
    null;
  const st = migrateStatus(String(raw.status ?? "DRAFT"));
  const files = Array.isArray(raw.changedFiles) ? (raw.changedFiles as string[]).filter(Boolean) : [];
  const plannerTasksRaw = Array.isArray(raw.plannerTasks) ? (raw.plannerTasks as unknown[]) : [];
  const plannerTasks = plannerTasksRaw
    .map((t) => {
      const o = t as { order?: unknown; title?: unknown };
      const order = Number(o?.order);
      const title = String(o?.title ?? "").trim();
      if (!Number.isFinite(order) || order <= 0 || !title) return null;
      return { order, title };
    })
    .filter(Boolean) as Array<{ order: number; title: string }>;
  return {
    id: String(raw.id ?? ""),
    projectId: String(raw.projectId ?? ""),
    selectedTemplate: String(raw.selectedTemplate ?? ""),
    promptSnapshot: String(raw.promptSnapshot ?? ""),
    branchName: String(raw.branchName ?? ""),
    cursorRunId: typeof raw.cursorRunId === "string" ? raw.cursorRunId : null,
    status: st,
    statusReason: (raw.statusReason as PrototypeRunStatusReason) ?? null,
    cancelRequestedAt: typeof raw.cancelRequestedAt === "string" ? raw.cancelRequestedAt : null,
    cancelReason: typeof raw.cancelReason === "string" ? raw.cancelReason : null,
    plannerStatus: (raw.plannerStatus as PrototypeRun["plannerStatus"]) ?? null,
    plannerTasks,
    cursorTaskCurrent: typeof raw.cursorTaskCurrent === "number" && Number.isFinite(raw.cursorTaskCurrent) ? raw.cursorTaskCurrent : null,
    cursorTaskTotal: typeof raw.cursorTaskTotal === "number" && Number.isFinite(raw.cursorTaskTotal) ? raw.cursorTaskTotal : null,
    commitSha: typeof raw.commitSha === "string" ? raw.commitSha : null,
    changedFiles: files,
    aiReviewDecision: (raw.aiReviewDecision as PrototypeRun["aiReviewDecision"]) ?? null,
    aiReviewSummary: typeof raw.aiReviewSummary === "string" ? raw.aiReviewSummary : null,
    prUrl: typeof raw.prUrl === "string" ? raw.prUrl : null,
    prNumber: typeof raw.prNumber === "number" && Number.isFinite(raw.prNumber) ? raw.prNumber : null,
    mergeSha,
    suggestedPreviewUrl: typeof raw.suggestedPreviewUrl === "string" ? raw.suggestedPreviewUrl : null,
    previewUrl: typeof raw.previewUrl === "string" ? raw.previewUrl : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

function nowIso(): string {
  return new Date().toISOString();
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

export function createRun(input: {
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
    cancelRequestedAt: null,
    cancelReason: null,
    plannerStatus: "PENDING",
    plannerTasks: [],
    cursorTaskCurrent: null,
    cursorTaskTotal: null,
    commitSha: null,
    changedFiles: [],
    aiReviewDecision: null,
    aiReviewSummary: null,
    prUrl: null,
    prNumber: null,
    mergeSha: null,
    suggestedPreviewUrl: null,
    previewUrl: null,
    createdAt: t,
    updatedAt: t,
  };
  const env = loadEnvelope(run.projectId);
  saveEnvelope(run.projectId, { runs: [...env.runs, run] });
  logPrototypePipelineEvent("prototype_run_created", { projectId: run.projectId, runId: run.id, status: run.status });
  return run;
}

export function getRun(projectId: string, runId: string): PrototypeRun | null {
  const env = loadEnvelope(projectId);
  return env.runs.find((r) => r.id === runId) ?? null;
}

export function getLatestRun(projectId: string): PrototypeRun | null {
  const env = loadEnvelope(projectId);
  if (!env.runs.length) return null;
  const sorted = [...env.runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sorted[0] ?? null;
}

export function updateRun(
  projectId: string,
  runId: string,
  patch: Partial<
    Pick<
      PrototypeRun,
      | "status"
      | "statusReason"
      | "cursorRunId"
      | "cancelRequestedAt"
      | "cancelReason"
      | "plannerStatus"
      | "plannerTasks"
      | "cursorTaskCurrent"
      | "cursorTaskTotal"
      | "commitSha"
      | "changedFiles"
      | "aiReviewDecision"
      | "aiReviewSummary"
      | "prUrl"
      | "prNumber"
      | "mergeSha"
      | "suggestedPreviewUrl"
      | "previewUrl"
      | "promptSnapshot"
    >
  >,
): PrototypeRun | null {
  const env = loadEnvelope(projectId);
  const prev = env.runs.find((r) => r.id === runId);
  if (!prev) return null;
  const next: PrototypeRun = {
    ...prev,
    ...patch,
    changedFiles: patch.changedFiles ?? prev.changedFiles,
    updatedAt: nowIso(),
  };
  const nextRuns = env.runs.map((r) => (r.id === runId ? next : r));
  saveEnvelope(projectId, { runs: nextRuns });
  return next;
}

/** 상태 전이 + 로그(감사는 로그에 위임). */
export function appendStatus(
  projectId: string,
  runId: string,
  status: PrototypeRunStatus,
  statusReason?: PrototypeRunStatusReason | null,
): PrototypeRun | null {
  return updateRun(projectId, runId, { status, statusReason: statusReason ?? null });
}

export function attachPreviewUrl(projectId: string, runId: string, previewUrl: string): PrototypeRun | null {
  const updated = updateRun(projectId, runId, { previewUrl, status: "PREVIEW_READY", statusReason: null });
  if (updated) {
    logPrototypePipelineEvent("prototype_preview_ready", { projectId, runId, previewUrl });
  }
  return updated;
}

export function markReworkRequired(projectId: string, runId: string, summary: string): PrototypeRun | null {
  const u = updateRun(projectId, runId, {
    status: "REWORK_REQUIRED",
    statusReason: null,
    aiReviewDecision: "REWORK",
    aiReviewSummary: summary,
  });
  if (u) logPrototypePipelineEvent("prototype_review_started", { projectId, runId, phase: "rework_required" });
  return u;
}

export function markFailed(projectId: string, runId: string, reason: PrototypeRunStatusReason, message?: string): PrototypeRun | null {
  const u = updateRun(projectId, runId, {
    status: "FAILED",
    statusReason: reason,
    aiReviewSummary: message ?? null,
  });
  if (u) logPrototypePipelineEvent("prototype_failed", { projectId, runId, reason });
  return u;
}

export function markBlocked(projectId: string, runId: string, reason: PrototypeRunStatusReason): PrototypeRun | null {
  const u = updateRun(projectId, runId, { status: "BLOCKED", statusReason: reason });
  if (u) logPrototypePipelineEvent("prototype_failed", { projectId, runId, reason, blocked: true });
  return u;
}

/** @deprecated 호환용 — prototypeRunStore.createRun 사용 */
export const createPrototypeRun = createRun;
/** @deprecated */
export const getPrototypeRunById = getRun;
/** @deprecated */
export const getLatestPrototypeRun = getLatestRun;
/** @deprecated */
export const updatePrototypeRunStatus = updateRun;
