/**
 * MVP — Cursor-style execution (in-memory stub; no real API).
 */

export interface AgentJobSubmitInput {
  projectId: string;
  prompt: string;
  metadata?: Record<string, string> | null;
}

export interface AgentJobRef {
  jobId: string;
}

export type AgentJobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface AgentJobStatus {
  jobId: string;
  state: AgentJobState;
}

export interface AgentResultPayload {
  jobId: string;
  summary: string;
  changedFiles: string[];
}

export type SubmitTaskPromptInput = {
  projectId: string;
  taskId: string;
  prompt: string;
};

export type SubmitTaskPromptResult = { jobId: string };

export type WaitForCompletionResult = {
  ok: boolean;
  summary: string;
  changedFiles: string[];
};

const jobResults = new Map<string, WaitForCompletionResult>();
/** Test hook: next N `waitForCompletion` calls return failure (`CURSOR_FAILED`) before checking `jobResults`. */
let failNextCursorWaits = 0;

export function mvpCursorFailNextWaits(count: number): void {
  failNextCursorWaits = Math.max(0, count);
}

/** Configure stub outcome for a jobId (tests). */
export function mvpCursorSetJobResult(jobId: string, result: WaitForCompletionResult): void {
  jobResults.set(jobId, result);
}

export function mvpCursorResetTestHooks(): void {
  jobResults.clear();
  failNextCursorWaits = 0;
}

export async function submitTaskPrompt(input: SubmitTaskPromptInput): Promise<SubmitTaskPromptResult> {
  const jobId = `mvp-job:${input.projectId}:${input.taskId}:${Date.now()}`;
  if (!jobResults.has(jobId)) {
    jobResults.set(jobId, { ok: true, summary: "mvp-cursor-ok", changedFiles: [`mvp/${input.taskId}.ts`] });
  }
  return { jobId };
}

export async function waitForCompletion(jobId: string): Promise<WaitForCompletionResult> {
  if (failNextCursorWaits > 0) {
    failNextCursorWaits -= 1;
    return { ok: false, summary: "CURSOR_FAILED", changedFiles: [] };
  }
  return jobResults.get(jobId) ?? { ok: true, summary: "mvp-cursor-ok", changedFiles: ["mvp/change.ts"] };
}

export async function submitAgentJob(_input: AgentJobSubmitInput): Promise<AgentJobRef> {
  return { jobId: "mvp-job" };
}

export async function pollAgentJob(_jobId: string): Promise<AgentJobStatus> {
  return { jobId: _jobId, state: "queued" };
}

export async function collectAgentResult(_jobId: string): Promise<AgentResultPayload | null> {
  return null;
}
