/**
 * MVP — structured prompts for executionService (in-memory only).
 *
 * **Target path (extend here):** domain-aware screen + ScreenFlow context via `prompt/helpers/flowPromptHelpers`
 * when `task.screenId` resolves to a screen (Requirement → … → Task pipeline).
 *
 * **Legacy compatibility (temporary):** tasks without `screenId` keep the original six-section layout
 * without the `## 1.1 Screen context` block — do not remove until retirement checklist allows.
 *
 * Contract:
 * - `generatePrompt(taskId)` / `regeneratePrompt(taskId, failureReason)` produce the same six core sections.
 * - Regeneration appends an explicit correction block derived from `failureReason` and a unique stamp
 *   so the text is never identical to the previous cached prompt.
 */

import type { PromptProvider } from "../ports/mvpPorts";
import { mvpGetTaskById, type Task } from "../task/taskService";
import { getScreenByTask } from "../domain/mvpDomainTaskScreenService";
import { mvpGetMenuNodeById } from "../domain/stores/mvpMenuStore";
import {
  buildFlowContextPromptLines,
  resolveFlowGraphForTask,
  resolveNextScreenNames,
  resolvePreviousScreenNames,
} from "./mvpPromptFlowContext";

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

function assertTaskProjectMatches(
  taskId: string,
  expectedProjectId: string,
  label: "buildTaskPrompt" | "buildCursorExecutionPrompt"
): void {
  const task = mvpGetTaskById(taskId);
  if (task?.projectId != null && String(task.projectId).trim() !== "" && task.projectId !== expectedProjectId) {
    throw new Error(
      `NOT_IMPLEMENTED_IN_MVP_CROSS_PROJECT: ${label} expected projectId=${expectedProjectId} but task ${taskId} is registered under projectId=${task.projectId}`
    );
  }
}

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
  const screen = getScreenByTask(taskId);
  const menu = screen ? mvpGetMenuNodeById(screen.menuId) : undefined;
  const parentMenu = menu?.parentId ? mvpGetMenuNodeById(menu.parentId) : undefined;
  const graph = resolveFlowGraphForTask(task, screen);
  const prevNames = screen && graph ? resolvePreviousScreenNames(graph, screen.id) : [];
  const nextNames = screen && graph ? resolveNextScreenNames(graph, screen.id) : [];

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
    ...(screen
      ? [
          `## 1.1 Screen context (domain-aware)`,
          `You are building the screen: ${screen.name}`,
          menu ? `This screen belongs to menu: ${menu.name}` : `This screen belongs to menu: (unknown)`,
          parentMenu ? `Parent menu: ${parentMenu.name}` : `Parent menu: (none)`,
          `Route: ${screen.routePath}`,
          `UI Scope: this screen only`,
          ``,
          ...(graph ? buildFlowContextPromptLines({ screen, graph, prevNames, nextNames }) : buildFlowContextPromptLines({ screen, graph: null, prevNames: [], nextNames: [] })),
          `### Constraints (screen-scoped)`,
          `- Do NOT implement other screens or flows unless explicitly required for this screen.`,
          `- Do NOT add unrelated UI components; keep changes scoped to this screen.`,
          `- UI must be consistent with the previous screen when applicable.`,
          `- Navigation must connect logically to the next screen(s) when applicable.`,
          ``,
        ]
      : []),
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
    ...(screen
      ? [
          ``,
          `### Screen purpose`,
          `- UI role: ${(task as { taskPurpose?: string } | undefined)?.taskPurpose ?? "LEGACY/UNSPECIFIED"}`,
        ]
      : []),
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
 * Throws if a seeded task exists under a different `projectId` (contract guard for future wiring).
 */
export function buildTaskPrompt(input: TaskPromptBuildInput): string {
  assertTaskProjectMatches(input.taskId, input.projectId, "buildTaskPrompt");
  const base = buildStructuredPrompt(input.taskId);
  if (input.specContext != null && String(input.specContext).trim() !== "") {
    return `${base}\n\n## SPEC CONTEXT (caller-provided)\n${input.specContext}\n`;
  }
  return base;
}

/**
 * Structured prompt plus explicit repo/branch metadata for cursor-oriented callers.
 * Throws if a seeded task exists under a different `projectId` (contract guard for future wiring).
 */
export function buildCursorExecutionPrompt(input: CursorPromptBuildInput): string {
  assertTaskProjectMatches(input.taskId, input.projectId, "buildCursorExecutionPrompt");
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
 * If nothing is cached yet, returns null (explicit “no materialized prompt” — not an empty string).
 * See `MVP_PROMPT_VERSION_REQUIRES_CACHE` for the contract.
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

export const mvpDefaultPromptProvider: PromptProvider = {
  generatePrompt,
  regeneratePrompt,
};
