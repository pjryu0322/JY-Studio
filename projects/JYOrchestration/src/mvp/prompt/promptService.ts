/**
 * MVP — structured prompts for executionService (in-memory only).
 *
 * Contract:
 * - `generatePrompt(taskId)` / `regeneratePrompt(taskId, failureReason)` produce the same six core sections.
 * - Regeneration appends an explicit correction block derived from `failureReason` and a unique stamp
 *   so the text is never identical to the previous cached prompt.
 */

import { mvpGetTaskById, type Task } from "../task/taskService";

export interface TaskPromptBuildInput {
  taskId: string;
  projectId: string;
  specContext?: string | null;
}

export interface CursorPromptBuildInput {
  taskId: string;
  projectId: string;
  repoUrl: string;
  baseBranch: string;
}

export interface PromptVersionRef {
  promptId: string;
  version: number;
}

/** Explains `resolvePromptVersion` returning null before any prompt is cached for the task. */
export const MVP_PROMPT_VERSION_REQUIRES_CACHE =
  "NOT_IMPLEMENTED_IN_MVP: no cached prompt for taskId; call generatePrompt or regeneratePrompt first";

const latestPrompt = new Map<string, string>();

function stamp(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function resolveTask(taskId: string): Task | undefined {
  return mvpGetTaskById(taskId);
}

/**
 * Mandatory prompt layout:
 * 1. Project Context
 * 2. Task Objective
 * 3. Scope Constraints
 * 4. UI / Mockup Instruction
 * 5. Output Constraints
 * 6. Git/Workspace Instruction
 */
function buildStructuredPrompt(
  taskId: string,
  options?: {
    /** When set, appended as an explicit correction section (regeneration path). */
    failureReason?: string;
    /** Ensures regenerate output differs from the previous prompt. */
    regenerationStamp?: string;
  }
): string {
  const task = resolveTask(taskId);
  const title = task?.title ?? `(unknown task ${taskId})`;
  const description = task?.description ?? "No description provided for this task id.";

  const projectIdLine =
    task?.projectId != null && String(task.projectId).trim() !== ""
      ? `- MVP projectId: ${task.projectId}`
      : `- MVP projectId: (not set on task — mock context only)`;

  const sections = [
    `## 1. Project context (mock)`,
    projectIdLine,
    `- Project workspace: mock monorepo root`,
    `- Track: MVP execution lane (isolated from production pipelines)`,
    ``,
    `## 2. Task objective`,
    `- Title: ${title}`,
    `- Description: ${description}`,
    ``,
    `## 3. Scope constraints`,
    `- Implement only what the task describes; avoid unrelated refactors.`,
    `- Keep changes reviewable and small unless the task explicitly requires more.`,
    ``,
    `## 4. UI / mockup constraints`,
    `- If UI is required: prefer clear states, loading/error paths, and accessible labels.`,
    `- If no UI is required: focus on correctness of logic, APIs, and tests.`,
    ``,
    `## 5. Output constraints`,
    `- Produce code that compiles in the target stack assumed by the task.`,
    `- Add or update tests when behavior changes.`,
    `- Summarize key decisions in comments only when necessary (avoid noise).`,
    ``,
    `## 6. Git / workspace instruction`,
    `- Work on a dedicated branch; keep commits focused and reversible.`,
    `- Do not mix unrelated concerns in a single commit.`,
    ``,
  ];

  if (options?.failureReason) {
    sections.push(
      `## CORRECTION REQUIRED`,
      `The previous attempt failed validation for the following reason:`,
      `> ${options.failureReason}`,
      ``,
      `You MUST address this reason directly before proceeding.`,
      `- Do not repeat the same mistake.`,
      `- Prefer minimal, targeted fixes over broad rewrites.`,
      ``
    );
  }

  if (options?.regenerationStamp) {
    sections.push(`## REGENERATION STAMP`, `- ${options.regenerationStamp}`, ``);
  }

  return [`# MVP Execution Prompt`, `TASK_ID=${taskId}`, ``, ...sections].join("\n");
}

export async function generatePrompt(taskId: string): Promise<string> {
  const text = buildStructuredPrompt(taskId);
  latestPrompt.set(taskId, text);
  return text;
}

/**
 * Regenerates a prompt after failure. Always includes failureReason, explicit correction,
 * and a unique stamp so the returned string is never identical to the prior prompt.
 */
export async function regeneratePrompt(taskId: string, failureReason: string): Promise<string> {
  const prev = latestPrompt.get(taskId) ?? "";
  const next = buildStructuredPrompt(taskId, {
    failureReason,
    regenerationStamp: `regen-${stamp()}`,
  });
  const ensured = next === prev ? `${next}\n## UNIQUENESS\n- ${stamp()}\n` : next;
  latestPrompt.set(taskId, ensured);
  return ensured;
}

/** Last prompt text produced for a task (tests / demos). */
export function getCachedPrompt(taskId: string): string | undefined {
  return latestPrompt.get(taskId);
}

export function clearPromptCache(): void {
  latestPrompt.clear();
}

/**
 * Builds the same structured prompt as `generatePrompt`, with optional spec context appended.
 * Does not write the prompt cache; use `generatePrompt` / `regeneratePrompt` for execution flows.
 */
export function buildTaskPrompt(input: TaskPromptBuildInput): string {
  const base = buildStructuredPrompt(input.taskId);
  if (input.specContext != null && String(input.specContext).trim() !== "") {
    return `${base}\n\n## SPEC CONTEXT (caller-provided)\n${input.specContext}\n`;
  }
  return base;
}

/** Structured prompt plus explicit repo/branch metadata for cursor-oriented callers. */
export function buildCursorExecutionPrompt(input: CursorPromptBuildInput): string {
  const base = buildStructuredPrompt(input.taskId);
  return [
    base,
    ``,
    `## CURSOR EXECUTION METADATA`,
    `- projectId: ${input.projectId}`,
    `- repoUrl: ${input.repoUrl}`,
    `- baseBranch: ${input.baseBranch}`,
    ``,
  ].join("\n");
}

/**
 * Returns a deterministic version ref when a cached prompt exists for the task (hash of cached text).
 * If nothing is cached yet, returns null — see `MVP_PROMPT_VERSION_REQUIRES_CACHE`.
 */
export async function resolvePromptVersion(input: { taskId: string }): Promise<PromptVersionRef | null> {
  const cached = latestPrompt.get(input.taskId);
  if (!cached) {
    return null;
  }
  let h = 0;
  for (let i = 0; i < cached.length; i += 1) {
    h = (Math.imul(31, h) + cached.charCodeAt(i)) | 0;
  }
  return { promptId: `mvp-prompt:${input.taskId}`, version: Math.abs(h) };
}
