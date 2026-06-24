import type {
  KnowledgePipelineRunRecord,
  KnowledgePipelineStage,
  KnowledgePipelineStepRecord,
  PipelineRunMetricsInput,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

const MAX_RUNS_PER_PROJECT = 20;
const runsByProject = new Map<string, KnowledgePipelineRunRecord[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function stepId(runId: string, stage: KnowledgePipelineStage): string {
  return `${runId}:${stage}:${Date.now()}`;
}

export function memoryStartKnowledgePipelineRun(projectId: string, trigger: string): KnowledgePipelineRunRecord {
  const pid = projectId.trim();
  const run: KnowledgePipelineRunRecord = {
    id: `run:${pid}:${Date.now()}`,
    projectId: pid,
    trigger,
    status: "RUNNING",
    startedAt: nowIso(),
    currentStage: "EVENT_SYNC",
    steps: [],
  };
  const list = runsByProject.get(pid) ?? [];
  list.unshift(run);
  runsByProject.set(pid, list.slice(0, MAX_RUNS_PER_PROJECT));
  return run;
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
  for (const [pid, runs] of runsByProject.entries()) {
    const idx = runs.findIndex((r) => r.id === runId);
    if (idx < 0) continue;
    const prev = runs[idx]!;
    const step: KnowledgePipelineStepRecord = {
      id: stepId(runId, input.stage),
      stage: input.stage,
      title: input.title,
      summary: input.summary,
      occurredAt: nowIso(),
      ok: input.ok !== false,
      durationMs: input.durationMs,
    };
    const next: KnowledgePipelineRunRecord = {
      ...prev,
      currentStage: input.stage,
      steps: [...prev.steps, step],
    };
    const copy = [...runs];
    copy[idx] = next;
    runsByProject.set(pid, copy);
    return next;
  }
  return null;
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
  for (const [pid, runs] of runsByProject.entries()) {
    const idx = runs.findIndex((r) => r.id === runId);
    if (idx < 0) continue;
    const prev = runs[idx]!;
    const completedAt = nowIso();
    const durationMs = Date.parse(completedAt) - Date.parse(prev.startedAt);
    const next: KnowledgePipelineRunRecord = {
      ...prev,
      status: input?.failed ? "FAILED" : "COMPLETED",
      currentStage: stage,
      completedAt,
      durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : undefined,
      errorMessage: input?.failed ? input.summary : undefined,
      eventCount: input?.metrics?.eventCount,
      candidateCount: input?.metrics?.candidateCount,
      nodeCount: input?.metrics?.nodeCount,
      edgeCount: input?.metrics?.edgeCount,
    };
    const copy = [...runs];
    copy[idx] = next;
    runsByProject.set(pid, copy);
    return next;
  }
  return null;
}

export function memoryGetLatestKnowledgePipelineRun(projectId: string): KnowledgePipelineRunRecord | null {
  return runsByProject.get(projectId.trim())?.[0] ?? null;
}

export function memoryListKnowledgePipelineRuns(projectId: string, limit = 20): readonly KnowledgePipelineRunRecord[] {
  return (runsByProject.get(projectId.trim()) ?? []).slice(0, limit);
}

export function resetMemoryKnowledgePipelineRunsForTests(): void {
  runsByProject.clear();
}
