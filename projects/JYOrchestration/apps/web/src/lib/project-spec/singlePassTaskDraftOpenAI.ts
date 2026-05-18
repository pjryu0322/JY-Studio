import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import {
  DEFAULT_TASK_GENERATION_PROMPT_TEMPLATE,
  applyTaskGenerationPromptTemplate,
} from "@/lib/project-spec/taskGenerationPromptTemplate";
import { EXECUTION_TASK_KINDS } from "@/lib/project-spec/generatedExecutionTask";
import type { TaskDraftOpenAiUsage } from "@/lib/project-spec/generateTaskDraftsWithOpenAI";

const MAX_SPEC_CHARS = 48_000;
const MAX_TASKS = 40;

function clipSpec(md: string): string {
  return md.length > MAX_SPEC_CHARS ? `${md.slice(0, MAX_SPEC_CHARS)}\n\n[이하 생략됨 — 앞부분만 전달]` : md;
}

function parseJsonRoot(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OPENAI_SINGLE_PASS_JSON_PARSE_FAILED");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OPENAI_SINGLE_PASS_INVALID_ROOT");
  }
  return parsed as Record<string, unknown>;
}

const NFR_TITLE_HINT =
  /^(성능|보안\s*정책|가용성|확장성|로깅\s*전용|모니터링\s*전용|운영\s*전용|SLA|RTO|RPO|컴플라이언스|감사\s*전용)\b/i;
const NFR_BODY_HINT =
  /\b(performance\s+only|availability\s+only|scalability\s+only|non-?functional\s+only|NFR\s+only|SLA\s+only|RTO\/RPO)\b/i;

function looksLikeNonFunctionalOnlyTask(title: string, description: string): boolean {
  const t = title.trim();
  const d = description.trim();
  if (NFR_TITLE_HINT.test(t)) return true;
  if (NFR_BODY_HINT.test(d) || NFR_BODY_HINT.test(t)) return true;
  if (/^비기능\s*요구사항/i.test(t)) return true;
  return false;
}

function normalizeExecutionKind(raw: string): string {
  const k = raw.toLowerCase().trim();
  if (k === "infra") return "data";
  return EXECUTION_TASK_KINDS.includes(k as (typeof EXECUTION_TASK_KINDS)[number]) ? k : "logic";
}

function mapPriorityToTaskPriority(p: string): "P0" | "P1" | "P2" {
  const u = p.toUpperCase().trim();
  if (u === "HIGH" || u === "P0") return "P0";
  if (u === "LOW" || u === "P2") return "P2";
  return "P1";
}

export type SinglePassGeneratedTask = {
  title: string;
  description: string;
  executionKind: string;
  priority: "P0" | "P1" | "P2";
};

async function openAiSinglePassJson(params: {
  apiKey: string;
  model: string;
  userMessage: string;
}): Promise<{ text: string; usage: TaskDraftOpenAiUsage | null }> {
  const res = await postOpenAiChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      {
        role: "system",
        content:
          "You are a senior software engineer. Output only valid JSON: a single object with a tasks array as specified by the user. No markdown fences or commentary.",
      },
      { role: "user", content: params.userMessage },
    ],
    temperature: 0.35,
    responseFormatJsonObject: true,
    returnUsage: true,
  });

  if (!res.ok) {
    throw new Error(`OPENAI_HTTP_${res.code}:${res.message.slice(0, 200)}`);
  }
  const text = res.text;
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");

  const u = res.usage;
  const usage =
    u &&
    typeof u.promptTokens === "number" &&
    typeof u.completionTokens === "number" &&
    typeof u.totalTokens === "number"
      ? { promptTokens: u.promptTokens, completionTokens: u.completionTokens, totalTokens: u.totalTokens }
      : null;
  return { text, usage };
}

function validateAndNormalizeTasks(root: Record<string, unknown>): SinglePassGeneratedTask[] {
  const tasksRaw = root.tasks;
  if (!Array.isArray(tasksRaw)) {
    throw new Error("OPENAI_SINGLE_PASS_MISSING_TASKS_ARRAY");
  }
  const out: SinglePassGeneratedTask[] = [];
  for (const item of tasksRaw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    const description = String(o.description ?? "").trim();
    const executionKindRaw = String(o.executionKind ?? o.taskKind ?? "logic").trim();
    const priorityRaw = String(o.priority ?? "MEDIUM").trim();
    if (!title || !description) continue;
    if (looksLikeNonFunctionalOnlyTask(title, description)) continue;
    out.push({
      title: title.slice(0, 500),
      description: description.slice(0, 8000),
      executionKind: normalizeExecutionKind(executionKindRaw),
      priority: mapPriorityToTaskPriority(priorityRaw),
    });
    if (out.length >= MAX_TASKS) break;
  }
  if (out.length === 0) {
    throw new Error("OPENAI_SINGLE_PASS_NO_VALID_TASKS");
  }
  return out;
}

/**
 * 단일 OpenAI 호출로 실행 Task 목록만 생성한다 (계층 분해 없음).
 */
export async function singlePassGenerateTaskDraftsWithOpenAI(input: {
  projectName: string;
  projectDescription: string | null;
  projectType: string;
  specMarkdown: string;
  modelFromRequest?: string | null;
  /** null/빈 문자열이면 DEFAULT_TASK_GENERATION_PROMPT_TEMPLATE */
  taskGenerationPromptTemplate?: string | null;
}): Promise<{
  tasks: SinglePassGeneratedTask[];
  model: string;
  usage: TaskDraftOpenAiUsage | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const trimmed = input.modelFromRequest?.trim();
  const model =
    trimmed && trimmed.length > 0 ? trimmed : resolveOpenAiModelFromEnv();

  const template =
    String(input.taskGenerationPromptTemplate ?? "").trim() || DEFAULT_TASK_GENERATION_PROMPT_TEMPLATE;
  const userMessage = applyTaskGenerationPromptTemplate(template, {
    projectName: input.projectName,
    projectType: input.projectType,
    projectDescription: input.projectDescription?.trim() || "(없음)",
    specMarkdown: clipSpec(input.specMarkdown),
  });

  console.info("[task-drafts] single_pass openai start", { model, userLen: userMessage.length });
  const res = await openAiSinglePassJson({ apiKey, model, userMessage });
  console.info("[task-drafts] single_pass openai done", { usage: res.usage, textLen: res.text.length });

  const root = parseJsonRoot(res.text);
  const tasks = validateAndNormalizeTasks(root);
  return { tasks, model, usage: res.usage };
}
