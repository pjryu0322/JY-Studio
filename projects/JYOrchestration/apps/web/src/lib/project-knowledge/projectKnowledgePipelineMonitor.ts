import type { ProjectKnowledgeActivityItem } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

export type KnowledgePipelineStage =
  | "EVENT_SYNC"
  | "ARTIFACT_INTEGRATION"
  | "CANDIDATE_EXTRACTION"
  | "GRAPH_PROJECTION"
  | "ACTIVITY_BUILD"
  | "COMPLETED"
  | "FAILED";

export type KnowledgePipelineStepRecord = Readonly<{
  readonly id: string;
  readonly stage: KnowledgePipelineStage;
  readonly title: string;
  readonly summary?: string;
  readonly occurredAt: string;
  readonly ok: boolean;
}>;

export type KnowledgePipelineRunRecord = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly trigger: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly currentStage: KnowledgePipelineStage;
  readonly steps: readonly KnowledgePipelineStepRecord[];
}>;

const MAX_RUNS_PER_PROJECT = 8;
const runsByProject = new Map<string, KnowledgePipelineRunRecord[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function stepId(runId: string, stage: KnowledgePipelineStage): string {
  return `${runId}:${stage}:${Date.now()}`;
}

export function startKnowledgePipelineRun(projectId: string, trigger: string): KnowledgePipelineRunRecord {
  const pid = projectId.trim();
  const run: KnowledgePipelineRunRecord = {
    id: `run:${pid}:${Date.now()}`,
    projectId: pid,
    trigger,
    startedAt: nowIso(),
    currentStage: "EVENT_SYNC",
    steps: [],
  };
  const list = runsByProject.get(pid) ?? [];
  list.unshift(run);
  runsByProject.set(pid, list.slice(0, MAX_RUNS_PER_PROJECT));
  return run;
}

export function appendKnowledgePipelineStep(
  runId: string,
  input: Readonly<{
    stage: KnowledgePipelineStage;
    title: string;
    summary?: string;
    ok?: boolean;
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

export function completeKnowledgePipelineRun(
  runId: string,
  input?: Readonly<{ failed?: boolean; summary?: string }>,
): KnowledgePipelineRunRecord | null {
  const stage: KnowledgePipelineStage = input?.failed ? "FAILED" : "COMPLETED";
  appendKnowledgePipelineStep(runId, {
    stage,
    title: input?.failed ? "Failed" : "Completed",
    summary: input?.summary,
    ok: !input?.failed,
  });
  for (const [pid, runs] of runsByProject.entries()) {
    const idx = runs.findIndex((r) => r.id === runId);
    if (idx < 0) continue;
    const prev = runs[idx]!;
    const next: KnowledgePipelineRunRecord = {
      ...prev,
      currentStage: stage,
      completedAt: nowIso(),
    };
    const copy = [...runs];
    copy[idx] = next;
    runsByProject.set(pid, copy);
    return next;
  }
  return null;
}

export function getLatestKnowledgePipelineRun(projectId: string): KnowledgePipelineRunRecord | null {
  const list = runsByProject.get(projectId.trim());
  return list?.[0] ?? null;
}

export function listKnowledgePipelineRuns(projectId: string, limit = 5): readonly KnowledgePipelineRunRecord[] {
  return (runsByProject.get(projectId.trim()) ?? []).slice(0, limit);
}

const STAGE_USER_LABELS: Record<KnowledgePipelineStage, string> = {
  EVENT_SYNC: "Conversation Saved",
  ARTIFACT_INTEGRATION: "Snapshot / Proposal Integrated",
  CANDIDATE_EXTRACTION: "Candidate Generated",
  GRAPH_PROJECTION: "Graph Synced",
  ACTIVITY_BUILD: "Activity Built",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function pipelineStepsToActivityItems(run: KnowledgePipelineRunRecord): ProjectKnowledgeActivityItem[] {
  return run.steps.map((step) => ({
    id: step.id,
    type: step.ok ? "graph" : "warning",
    title: STAGE_USER_LABELS[step.stage] ?? step.title,
    summary: step.summary ?? step.title,
    occurredAt: step.occurredAt,
    technicalDetail: { stage: step.stage, runId: run.id },
  }));
}
