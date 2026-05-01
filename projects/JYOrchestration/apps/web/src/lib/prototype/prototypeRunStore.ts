/**
 * PrototypeRun persistence — 파일 기반(.data/prototype-runs). DB 마이그레이션 없음.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { buildPrototypeBranchName, buildWorkUnitBranchName } from "@/lib/prototype/prototypeBranchNames";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import type {
  PrototypeRun,
  PrototypeRunFileEnvelope,
  PrototypeWorkUnit,
  PrototypeWorkUnitStatus,
  PrototypeDeploymentStatus,
  PrototypeRunStatus,
  PrototypeRunStatusReason,
  PrototypePlannerSource,
  PrototypeWorkUnitComplexity,
  PrototypeWorkUnitRiskLevel,
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
  if (raw === "TASK_PACKAGES_READY") return "WORK_UNITS_READY";
  return raw as PrototypeRunStatus;
}

function parseRiskLevel(x: unknown): PrototypeWorkUnitRiskLevel {
  const u = String(x ?? "").trim().toLowerCase();
  if (u === "low" || u === "high" || u === "medium") return u;
  return "medium";
}

function parseComplexityLevel(x: unknown): PrototypeWorkUnitComplexity {
  const u = String(x ?? "").trim().toLowerCase();
  if (u === "low" || u === "high" || u === "medium") return u;
  return "medium";
}

function normalizeStringList(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return (x as unknown[]).map((v) => String(v ?? "").trim()).filter(Boolean);
}

function workUnitDefaultsFromTitle(title: string): Pick<
  PrototypeWorkUnit,
  "description" | "targetArea" | "implementationScope" | "dependencies" | "acceptanceCriteria" | "riskLevel" | "estimatedComplexity"
> {
  return {
    description: title,
    targetArea: "",
    implementationScope: "",
    dependencies: [],
    acceptanceCriteria: [],
    riskLevel: "medium",
    estimatedComplexity: "medium",
  };
}

function isNewWorkUnitStatus(x: unknown): x is PrototypeWorkUnitStatus {
  return (
    x === "PENDING" ||
    x === "CURSOR_RUNNING" ||
    x === "CURSOR_DONE" ||
    x === "GIT_PUSHED" ||
    x === "REVIEWING" ||
    x === "REVIEW_PASS" ||
    x === "REVIEW_REWORK" ||
    x === "PR_OPENED" ||
    x === "MERGED" ||
    x === "SKIPPED" ||
    x === "FAILED"
  );
}

function migrateLegacyWorkUnitStatus(old: Record<string, unknown>): PrototypeWorkUnitStatus {
  const uStatus = String(old.status ?? "");
  const mergeDone = old.mergeStatus === "DONE";
  const prDone = old.prStatus === "DONE";
  const revDone = old.reviewStatus === "DONE";
  const gitDone = old.gitStatus === "DONE";
  const curDone = old.cursorStatus === "DONE";
  const curRun = old.cursorStatus === "RUNNING";
  if (mergeDone || uStatus === "DONE") return "MERGED";
  if (prDone) return "PR_OPENED";
  if (revDone) return "REVIEW_PASS";
  if (gitDone) return "GIT_PUSHED";
  if (curDone) return "CURSOR_DONE";
  if (curRun || uStatus === "RUNNING") return "CURSOR_RUNNING";
  return "PENDING";
}

function normalizeWorkUnitsJson(
  raw: unknown,
  runId: string,
  projectNameForBranch: string,
  plannerTasksFallback: ReadonlyArray<{ order: number; title: string }>,
): PrototypeWorkUnit[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    if (plannerTasksFallback.length) {
      return plannerTasksFallback.map((t) => ({
        id: randomUUID(),
        order: t.order,
        title: t.title,
        ...workUnitDefaultsFromTitle(t.title),
        status: "PENDING" as const,
        branchName: buildWorkUnitBranchName(projectNameForBranch, runId, t.order),
        cursorRunId: null,
        commitSha: null,
        changedFiles: [],
        prNumber: null,
        prUrl: null,
        mergeSha: null,
        reviewSummary: null,
        cursorPrompt: null,
        cursorPromptGeneratedAt: null,
        cursorPromptVersion: 0,
        cursorPromptSource: null,
        executionStartedAt: null,
        executionCompletedAt: null,
        startedAt: null,
        finishedAt: null,
        cursorAgentStatusUpper: null,
        cursorLastPolledAt: null,
        cursorLastSummary: null,
      }));
    }
    return [];
  }

  const first = raw[0] as Record<string, unknown>;
  const isLegacyShape = first && typeof first === "object" && "cursorStatus" in first && !isNewWorkUnitStatus(first.status);

  const out: PrototypeWorkUnit[] = [];
  for (const it of raw) {
    const r = it as Record<string, unknown>;
    const id = String(r?.id ?? "").trim() || randomUUID();
    const order = Number(r?.order);
    const title = String(r?.title ?? "").trim();
    const branchName = String(r?.branchName ?? "").trim();
    if (!Number.isFinite(order) || order <= 0 || !title) continue;

    const status: PrototypeWorkUnitStatus = isLegacyShape
      ? migrateLegacyWorkUnitStatus(r)
      : isNewWorkUnitStatus(r?.status)
        ? r.status
        : "PENDING";

    const changedFiles = Array.isArray(r?.changedFiles) ? (r.changedFiles as unknown[]).map(String).filter(Boolean) : [];
    const descRaw = String(r?.description ?? "").trim();
    const def = workUnitDefaultsFromTitle(title);
    const cpv = Number((r as { cursorPromptVersion?: unknown }).cursorPromptVersion);
    const cursorPromptVersion = Number.isFinite(cpv) && cpv >= 0 ? Math.floor(cpv) : 0;
    const cps = (r as { cursorPromptSource?: unknown }).cursorPromptSource;
    const cursorPromptSource =
      cps === "planner" || cps === "regenerated" || cps === "retry" ? (cps as "planner" | "regenerated" | "retry") : null;

    out.push({
      id,
      order,
      title,
      description: descRaw || def.description,
      targetArea: String(r?.targetArea ?? "").trim() || def.targetArea,
      implementationScope: String(r?.implementationScope ?? "").trim() || def.implementationScope,
      dependencies: normalizeStringList(r?.dependencies).length ? normalizeStringList(r?.dependencies) : def.dependencies,
      acceptanceCriteria: normalizeStringList(r?.acceptanceCriteria).length
        ? normalizeStringList(r?.acceptanceCriteria)
        : def.acceptanceCriteria,
      riskLevel: parseRiskLevel(r?.riskLevel),
      estimatedComplexity: parseComplexityLevel(r?.estimatedComplexity),
      status,
      branchName: branchName || buildWorkUnitBranchName(projectNameForBranch, runId, order),
      cursorPrompt: typeof (r as { cursorPrompt?: unknown }).cursorPrompt === "string" ? String((r as { cursorPrompt: string }).cursorPrompt) : null,
      cursorPromptGeneratedAt:
        typeof (r as { cursorPromptGeneratedAt?: unknown }).cursorPromptGeneratedAt === "string"
          ? String((r as { cursorPromptGeneratedAt: string }).cursorPromptGeneratedAt)
          : null,
      cursorPromptVersion,
      cursorPromptSource,
      executionStartedAt:
        typeof (r as { executionStartedAt?: unknown }).executionStartedAt === "string"
          ? String((r as { executionStartedAt: string }).executionStartedAt)
          : null,
      executionCompletedAt:
        typeof (r as { executionCompletedAt?: unknown }).executionCompletedAt === "string"
          ? String((r as { executionCompletedAt: string }).executionCompletedAt)
          : null,
      cursorRunId: typeof r?.cursorRunId === "string" ? String(r.cursorRunId) : null,
      commitSha: typeof r?.commitSha === "string" ? String(r.commitSha) : null,
      changedFiles,
      prNumber: typeof r?.prNumber === "number" && Number.isFinite(r.prNumber) ? (r.prNumber as number) : null,
      prUrl: typeof r?.prUrl === "string" ? String(r.prUrl) : null,
      mergeSha: typeof r?.mergeSha === "string" ? String(r.mergeSha) : null,
      reviewSummary: typeof r?.reviewSummary === "string" ? String(r.reviewSummary) : null,
      startedAt: typeof r?.startedAt === "string" ? String(r.startedAt) : null,
      finishedAt: typeof r?.finishedAt === "string" ? String(r.finishedAt) : null,
      cursorAgentStatusUpper:
        typeof (r as { cursorAgentStatusUpper?: unknown }).cursorAgentStatusUpper === "string"
          ? String((r as { cursorAgentStatusUpper: string }).cursorAgentStatusUpper).trim() || null
          : null,
      cursorLastPolledAt:
        typeof (r as { cursorLastPolledAt?: unknown }).cursorLastPolledAt === "string"
          ? String((r as { cursorLastPolledAt: string }).cursorLastPolledAt)
          : null,
      cursorLastSummary:
        typeof (r as { cursorLastSummary?: unknown }).cursorLastSummary === "string"
          ? String((r as { cursorLastSummary: string }).cursorLastSummary).trim() || null
          : null,
    });
  }
  return out.sort((a, b) => a.order - b.order);
}

function normalizeDeploymentStatus(raw: unknown): PrototypeDeploymentStatus {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "REQUESTED" || s === "RUNNING" || s === "DONE" || s === "FAILED") return s as PrototypeDeploymentStatus;
  return "PENDING";
}

function inferProjectNameForBranch(raw: Record<string, unknown>): string {
  const snap = String(raw.promptSnapshot ?? "");
  const m = snap.match(/프로젝트\s*[:：]\s*(.+)/i) ?? snap.match(/project\s*[:]\s*(.+)/i);
  if (m?.[1]) return m[1].trim().slice(0, 80);
  return "project";
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

  const runId = String(raw.id ?? "");
  const branchGuess = inferProjectNameForBranch(raw);
  let workUnits = normalizeWorkUnitsJson((raw as { workUnits?: unknown }).workUnits, runId, branchGuess, plannerTasks);

  const totalFromRaw = typeof (raw as { totalWorkUnits?: unknown }).totalWorkUnits === "number" ? Number((raw as { totalWorkUnits: number }).totalWorkUnits) : null;
  let totalWorkUnits =
    typeof totalFromRaw === "number" && Number.isFinite(totalFromRaw) && totalFromRaw > 0 ? totalFromRaw : workUnits.length;

  if (workUnits.length && totalWorkUnits < workUnits.length) totalWorkUnits = workUnits.length;

  let currentWorkUnitOrder: number | null =
    typeof (raw as { currentWorkUnitOrder?: unknown }).currentWorkUnitOrder === "number" &&
    Number.isFinite((raw as { currentWorkUnitOrder: number }).currentWorkUnitOrder)
      ? Math.floor((raw as { currentWorkUnitOrder: number }).currentWorkUnitOrder)
      : null;

  if (currentWorkUnitOrder == null && workUnits.length) {
    const failed = workUnits.find((u) => u.status === "FAILED");
    const unfinished = failed ?? workUnits.find((u) => u.status !== "MERGED" && u.status !== "SKIPPED");
    currentWorkUnitOrder = unfinished ? unfinished.order : null;
  }

  const plannerSummary = typeof (raw as { plannerSummary?: unknown }).plannerSummary === "string" ? String((raw as { plannerSummary: string }).plannerSummary) : null;
  const plannerError = typeof (raw as { plannerError?: unknown }).plannerError === "string" ? String((raw as { plannerError: string }).plannerError) : null;

  const schemaVersion =
    typeof (raw as { runSchemaVersion?: unknown }).runSchemaVersion === "number" &&
    Number((raw as { runSchemaVersion: number }).runSchemaVersion) >= 2
      ? 2
      : 1;
  const workUnitsExecutionConfirmed =
    schemaVersion >= 2 ? Boolean((raw as { workUnitsExecutionConfirmed?: unknown }).workUnitsExecutionConfirmed) : true;
  const ps = (raw as { plannerSource?: unknown }).plannerSource;
  const plannerSource: PrototypePlannerSource | null =
    ps === "llm" || ps === "fallback" ? (ps as PrototypePlannerSource) : null;

  return {
    id: runId,
    projectId: String(raw.projectId ?? ""),
    selectedTemplate: String(raw.selectedTemplate ?? ""),
    promptSnapshot: String(raw.promptSnapshot ?? ""),
    prototypeIdeationSummary:
      typeof (raw as { prototypeIdeationSummary?: unknown }).prototypeIdeationSummary === "string"
        ? String((raw as { prototypeIdeationSummary: string }).prototypeIdeationSummary)
        : null,
    prototypeActorFlowSummary:
      typeof (raw as { prototypeActorFlowSummary?: unknown }).prototypeActorFlowSummary === "string"
        ? String((raw as { prototypeActorFlowSummary: string }).prototypeActorFlowSummary)
        : null,
    prototypeFeatureDraftTitlesJson:
      typeof (raw as { prototypeFeatureDraftTitlesJson?: unknown }).prototypeFeatureDraftTitlesJson === "string"
        ? String((raw as { prototypeFeatureDraftTitlesJson: string }).prototypeFeatureDraftTitlesJson)
        : null,
    prototypeProjectDescription:
      typeof (raw as { prototypeProjectDescription?: unknown }).prototypeProjectDescription === "string"
        ? String((raw as { prototypeProjectDescription: string }).prototypeProjectDescription)
        : null,
    runSchemaVersion: schemaVersion,
    workUnitsExecutionConfirmed,
    plannerSource,
    plannerError,
    branchName: String(raw.branchName ?? ""),
    cursorRunId: typeof raw.cursorRunId === "string" ? raw.cursorRunId : null,
    status: st,
    statusReason: (raw.statusReason as PrototypeRunStatusReason) ?? null,
    cancelRequestedAt: typeof raw.cancelRequestedAt === "string" ? raw.cancelRequestedAt : null,
    cancelReason: typeof raw.cancelReason === "string" ? raw.cancelReason : null,
    plannerStatus: (raw.plannerStatus as PrototypeRun["plannerStatus"]) ?? null,
    plannerSummary,
    workUnits,
    currentWorkUnitOrder,
    totalWorkUnits,
    commitSha: typeof raw.commitSha === "string" ? raw.commitSha : null,
    changedFiles: files,
    aiReviewDecision: (raw.aiReviewDecision as PrototypeRun["aiReviewDecision"]) ?? null,
    aiReviewSummary: typeof raw.aiReviewSummary === "string" ? raw.aiReviewSummary : null,
    prUrl: typeof raw.prUrl === "string" ? raw.prUrl : null,
    prNumber: typeof raw.prNumber === "number" && Number.isFinite(raw.prNumber) ? raw.prNumber : null,
    mergeSha,
    deploymentStatus: normalizeDeploymentStatus((raw as { deploymentStatus?: unknown }).deploymentStatus),
    deploymentRequestedAt: typeof (raw as { deploymentRequestedAt?: unknown }).deploymentRequestedAt === "string" ? String((raw as { deploymentRequestedAt: string }).deploymentRequestedAt) : null,
    deploymentStartedAt: typeof (raw as { deploymentStartedAt?: unknown }).deploymentStartedAt === "string" ? String((raw as { deploymentStartedAt: string }).deploymentStartedAt) : null,
    deploymentEndedAt: typeof (raw as { deploymentEndedAt?: unknown }).deploymentEndedAt === "string" ? String((raw as { deploymentEndedAt: string }).deploymentEndedAt) : null,
    resultUrl: typeof (raw as { resultUrl?: unknown }).resultUrl === "string" ? String((raw as { resultUrl: string }).resultUrl) : null,
    suggestedPreviewUrl: typeof raw.suggestedPreviewUrl === "string" ? raw.suggestedPreviewUrl : null,
    previewUrl: typeof raw.previewUrl === "string" ? raw.previewUrl : null,
    pagesDeployWorkflowRunUrl:
      typeof (raw as { pagesDeployWorkflowRunUrl?: unknown }).pagesDeployWorkflowRunUrl === "string"
        ? String((raw as { pagesDeployWorkflowRunUrl: string }).pagesDeployWorkflowRunUrl)
        : null,
    deployFailureDetail:
      typeof (raw as { deployFailureDetail?: unknown }).deployFailureDetail === "string"
        ? String((raw as { deployFailureDetail: string }).deployFailureDetail)
        : null,
    pagesDeployTriggerCommitSha:
      typeof (raw as { pagesDeployTriggerCommitSha?: unknown }).pagesDeployTriggerCommitSha === "string"
        ? String((raw as { pagesDeployTriggerCommitSha: string }).pagesDeployTriggerCommitSha)
        : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

function nowIso(): string {
  return new Date().toISOString();
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
    prototypeIdeationSummary: null,
    prototypeActorFlowSummary: null,
    prototypeFeatureDraftTitlesJson: null,
    prototypeProjectDescription: null,
    runSchemaVersion: 2,
    workUnitsExecutionConfirmed: false,
    plannerSource: null,
    plannerError: null,
    branchName,
    cursorRunId: null,
    status: input.initialStatus,
    statusReason: input.statusReason,
    cancelRequestedAt: null,
    cancelReason: null,
    plannerStatus: "PENDING",
    plannerSummary: null,
    workUnits: [],
    currentWorkUnitOrder: null,
    totalWorkUnits: 0,
    commitSha: null,
    changedFiles: [],
    aiReviewDecision: null,
    aiReviewSummary: null,
    prUrl: null,
    prNumber: null,
    mergeSha: null,
    deploymentStatus: "PENDING",
    deploymentRequestedAt: null,
    deploymentStartedAt: null,
    deploymentEndedAt: null,
    resultUrl: null,
    suggestedPreviewUrl: null,
    previewUrl: null,
    pagesDeployWorkflowRunUrl: null,
    deployFailureDetail: null,
    pagesDeployTriggerCommitSha: null,
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

/** 최신순 전체 실행(검토 화면에서 이전 실행 선택 등). */
export function listProjectPrototypeRuns(projectId: string): PrototypeRun[] {
  const env = loadEnvelope(projectId);
  return [...env.runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 생성 순서 기준 버전 번호(1-based). 동일 프로젝트 내 최신 실행 표시용. */
export function getRunVersionMeta(projectId: string, runId: string): { versionNo: number; totalRuns: number } | null {
  const env = loadEnvelope(projectId);
  if (!env.runs.length) return null;
  const chronological = [...env.runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const idx = chronological.findIndex((r) => r.id === runId);
  if (idx < 0) return null;
  return { versionNo: idx + 1, totalRuns: chronological.length };
}

export function updateRun(
  projectId: string,
  runId: string,
  patch: Partial<
    Pick<
      PrototypeRun,
      | "status"
      | "statusReason"
      | "selectedTemplate"
      | "cursorRunId"
      | "cancelRequestedAt"
      | "cancelReason"
      | "plannerStatus"
      | "plannerSummary"
      | "workUnits"
      | "currentWorkUnitOrder"
      | "totalWorkUnits"
      | "branchName"
      | "commitSha"
      | "changedFiles"
      | "aiReviewDecision"
      | "aiReviewSummary"
      | "prUrl"
      | "prNumber"
      | "mergeSha"
      | "deploymentStatus"
      | "deploymentRequestedAt"
      | "deploymentStartedAt"
      | "deploymentEndedAt"
      | "resultUrl"
      | "suggestedPreviewUrl"
      | "previewUrl"
      | "promptSnapshot"
      | "prototypeIdeationSummary"
      | "prototypeActorFlowSummary"
      | "prototypeFeatureDraftTitlesJson"
      | "prototypeProjectDescription"
      | "runSchemaVersion"
      | "workUnitsExecutionConfirmed"
      | "plannerSource"
      | "plannerError"
      | "pagesDeployWorkflowRunUrl"
      | "deployFailureDetail"
      | "pagesDeployTriggerCommitSha"
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

export { buildPrototypeBranchName, buildWorkUnitBranchName, slugifyForBranchSegment } from "@/lib/prototype/prototypeBranchNames";

/** @deprecated 호환용 — prototypeRunStore.createRun 사용 */
export const createPrototypeRun = createRun;
/** @deprecated */
export const getPrototypeRunById = getRun;
/** @deprecated */
export const getLatestPrototypeRun = getLatestRun;
/** @deprecated */
export const updatePrototypeRunStatus = updateRun;
