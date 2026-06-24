import type {
  KnowledgePipelinePersistenceMode,
  KnowledgePipelineRunRecord,
  KnowledgePipelineStage,
  KnowledgePipelineStepRecord,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import { normalizePipelineRunMetrics } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

const MAX_RUNS_PER_PROJECT = 20;
const runsByProject = new Map<string, KnowledgePipelineRunRecord[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function newStepId(runId: string, stage: KnowledgePipelineStage): string {
  return `${runId}:step:${stage}:${Date.now()}`;
}

function updateRun(runId: string, updater: (run: KnowledgePipelineRunRecord) => KnowledgePipelineRunRecord): void {
  for (const [pid, runs] of runsByProject.entries()) {
    const idx = runs.findIndex((r) => r.id === runId);
    if (idx < 0) continue;
    const copy = [...runs];
    copy[idx] = updater(copy[idx]!);
    runsByProject.set(pid, copy);
    return;
  }
}

function memoryGetRunById(runId: string): KnowledgePipelineRunRecord | null {
  for (const runs of runsByProject.values()) {
    const hit = runs.find((r) => r.id === runId);
    if (hit) return hit;
  }
  return null;
}

export function memoryStartKnowledgePipelineRun(
  projectId: string,
  trigger: string,
  persistenceMode: KnowledgePipelinePersistenceMode = "MEMORY_FALLBACK",
): KnowledgePipelineRunRecord {
  const pid = projectId.trim();
  const run: KnowledgePipelineRunRecord = {
    id: `run:${pid}:${Date.now()}`,
    projectId: pid,
    trigger,
    status: "RUNNING",
    persistenceMode,
    startedAt: nowIso(),
    currentStage: "EVENT_SYNC",
    steps: [],
  };
  const list = runsByProject.get(pid) ?? [];
  list.unshift(run);
  runsByProject.set(pid, list.slice(0, MAX_RUNS_PER_PROJECT));
  return run;
}

export function memoryStartKnowledgePipelineStep(
  runId: string,
  input: Readonly<{
    stage: KnowledgePipelineStage;
    title: string;
    sourceEventId?: string;
    sourceMessageId?: string;
  }>,
): string | null {
  const stepId = newStepId(runId, input.stage);
  const startedAt = nowIso();
  const step: KnowledgePipelineStepRecord = {
    id: stepId,
    stage: input.stage,
    title: input.title,
    startedAt,
    occurredAt: startedAt,
    ok: false,
    status: "RUNNING",
  };
  updateRun(runId, (prev) => ({
    ...prev,
    currentStage: input.stage,
    steps: [...prev.steps, step],
  }));
  return stepId;
}

export function memoryCompleteKnowledgePipelineStep(
  stepId: string,
  input?: Readonly<{ summary?: string; durationMs?: number }>,
): void {
  const completedAt = nowIso();
  for (const [pid, runs] of runsByProject.entries()) {
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!;
      const stepIdx = run.steps.findIndex((s) => s.id === stepId);
      if (stepIdx < 0) continue;
      const steps = [...run.steps];
      const prev = steps[stepIdx]!;
      steps[stepIdx] = {
        ...prev,
        summary: input?.summary ?? prev.summary,
        status: "SUCCESS",
        ok: true,
        occurredAt: completedAt,
        durationMs: input?.durationMs,
      };
      const copy = [...runs];
      copy[i] = { ...run, steps };
      runsByProject.set(pid, copy);
      return;
    }
  }
}

export function memoryFailKnowledgePipelineStep(
  stepId: string,
  input?: Readonly<{ summary?: string; durationMs?: number }>,
): void {
  const completedAt = nowIso();
  for (const [pid, runs] of runsByProject.entries()) {
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i]!;
      const stepIdx = run.steps.findIndex((s) => s.id === stepId);
      if (stepIdx < 0) continue;
      const steps = [...run.steps];
      const prev = steps[stepIdx]!;
      steps[stepIdx] = {
        ...prev,
        summary: input?.summary ?? prev.summary,
        status: "FAILED",
        ok: false,
        occurredAt: completedAt,
        durationMs: input?.durationMs,
      };
      const copy = [...runs];
      copy[i] = { ...run, steps };
      runsByProject.set(pid, copy);
      return;
    }
  }
}

export function memoryAppendKnowledgePipelineStep(
  runId: string,
  input: Readonly<{
    stage: KnowledgePipelineStage;
    title: string;
    summary?: string;
    ok?: boolean;
    durationMs?: number;
  }>,
): KnowledgePipelineRunRecord | null {
  const stepId = memoryStartKnowledgePipelineStep(runId, input);
  if (!stepId) return null;
  if (input.ok === false) {
    memoryFailKnowledgePipelineStep(stepId, { summary: input.summary, durationMs: input.durationMs });
  } else {
    memoryCompleteKnowledgePipelineStep(stepId, { summary: input.summary, durationMs: input.durationMs });
  }
  return memoryGetRunById(runId);
}

export function memoryCompleteKnowledgePipelineRun(
  runId: string,
  input?: Readonly<{ failed?: boolean; summary?: string; metrics?: PipelineRunMetricsInput }>,
): KnowledgePipelineRunRecord | null {
  const stage: KnowledgePipelineStage = input?.failed ? "FAILED" : "COMPLETED";
  memoryAppendKnowledgePipelineStep(runId, {
    stage,
    title: input?.failed ? "Failed" : "Completed",
    summary: input?.summary,
    ok: !input?.failed,
  });
  const m = normalizePipelineRunMetrics(input?.metrics);
  updateRun(runId, (prev) => {
    const completedAt = nowIso();
    const durationMs = Date.parse(completedAt) - Date.parse(prev.startedAt);
    return {
      ...prev,
      status: input?.failed ? "FAILED" : "COMPLETED",
      currentStage: stage,
      completedAt,
      durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : undefined,
      errorMessage: input?.failed ? input.summary : undefined,
      eventCount: m?.eventCount,
      candidateCount: m?.candidateCount,
      nodeCount: m?.nodeCount,
      edgeCount: m?.edgeCount,
      candidateNodeCount: m?.candidateNodeCount,
      candidateEdgeCount: m?.candidateEdgeCount,
      graphNodeCount: m?.graphNodeCount,
      graphEdgeCount: m?.graphEdgeCount,
    };
  });
  return memoryGetRunById(runId);
}

export function memoryGetLatestKnowledgePipelineRun(projectId: string): KnowledgePipelineRunRecord | null {
  return runsByProject.get(projectId.trim())?.[0] ?? null;
}

export function memoryListKnowledgePipelineRuns(
  projectId: string,
  limit = 20,
): readonly KnowledgePipelineRunRecord[] {
  return (runsByProject.get(projectId.trim()) ?? []).slice(0, limit);
}

export function resetMemoryKnowledgePipelineRunsForTests(): void {
  runsByProject.clear();
}
