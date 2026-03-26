/**
 * 확정 Project Spec(마크다운 + 프로젝트 메타)을 바탕으로 실행 가능한 Task 초안 목록을 JSON으로 생성한다.
 */

export type TaskDraftAiItem = {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dependsOn: string[];
  acceptanceCriteria: string[];
};

export type TaskDraftOpenAiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_SPEC_CHARS = 48_000;

function buildUserMessage(input: {
  projectName: string;
  projectDescription: string | null;
  projectType: string;
  specCoreGoals: string | null;
  specScopeIn: string | null;
  specScopeOut: string | null;
  specTargetUsers: string | null;
  specSuccessCriteria: string | null;
  specMarkdown: string;
}): string {
  const md =
    input.specMarkdown.length > MAX_SPEC_CHARS
      ? `${input.specMarkdown.slice(0, MAX_SPEC_CHARS)}\n\n[이하 생략됨 — 앞부분만 전달]`
      : input.specMarkdown;

  return `다음은 프로젝트와 확정 Project Spec입니다. 구현·검증 가능한 작업 단위로 Task 목록을 JSON으로 설계하라.

[프로젝트]
- 이름: ${input.projectName}
- 유형: ${input.projectType}
- 설명: ${input.projectDescription?.trim() || "(없음)"}

[Spec 컨텍스트 필드]
- 핵심 목표: ${input.specCoreGoals?.trim() || "(없음)"}
- In scope: ${input.specScopeIn?.trim() || "(없음)"}
- Out of scope: ${input.specScopeOut?.trim() || "(없음)"}
- 대상 사용자: ${input.specTargetUsers?.trim() || "(없음)"}
- 성공 기준: ${input.specSuccessCriteria?.trim() || "(없음)"}

[확정 Project Spec 본문 (Markdown)]
---
${md}
---

[출력 JSON 스키마 — 키 이름을 정확히 맞출 것]
{
  "tasks": [
    {
      "title": "짧고 실행 가능한 작업명",
      "description": "무엇을 하면 완료인지, 산출물·범위",
      "priority": "HIGH|MEDIUM|LOW",
      "dependsOn": ["선행으로 완료되어야 할 다른 task의 title 문자열", "..."],
      "acceptanceCriteria": ["검증 가능한 기준1", "기준2"]
    }
  ]
}

[규칙]
- tasks는 5~20개 권장. 너무 쪼개지 말고, 오케스트레이션에서 실행·검증 가능한 단위로.
- dependsOn에는 같은 목록에 있는 다른 task의 title과 정확히 일치하는 문자열만 사용. 없으면 빈 배열.
- priority는 과도하게 HIGH만 쓰지 말 것.
- JSON만 출력. 마크다운 코드펜스나 설명 문장 금지.`;
}

function normalizePriority(p: unknown): "HIGH" | "MEDIUM" | "LOW" {
  const s = String(p ?? "").toUpperCase().trim();
  if (s === "HIGH" || s === "LOW" || s === "MEDIUM") {
    return s;
  }
  return "MEDIUM";
}

function toStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) {
    return [];
  }
  return x.map((v) => (typeof v === "string" ? v.trim() : "")).filter((item) => item.length > 0);
}

export function parseTaskDraftOpenAiJson(text: string): TaskDraftAiItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OPENAI_TASK_DRAFT_JSON_PARSE_FAILED");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OPENAI_TASK_DRAFT_INVALID_ROOT");
  }
  const root = parsed as Record<string, unknown>;
  const rawTasks = root.tasks;
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    throw new Error("OPENAI_TASK_DRAFT_EMPTY_TASKS");
  }
  const out: TaskDraftAiItem[] = [];
  for (const item of rawTasks) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) {
      continue;
    }
    const description = String(o.description ?? "").trim();
    out.push({
      title: title.slice(0, 500),
      description: description.slice(0, 8000),
      priority: normalizePriority(o.priority),
      dependsOn: toStringArray(o.dependsOn).slice(0, 30),
      acceptanceCriteria: toStringArray(o.acceptanceCriteria).slice(0, 20),
    });
  }
  if (out.length === 0) {
    throw new Error("OPENAI_TASK_DRAFT_NO_VALID_TASKS");
  }
  return out;
}

export async function generateTaskDraftsWithOpenAI(input: {
  projectName: string;
  projectDescription: string | null;
  projectType: string;
  specCoreGoals: string | null;
  specScopeIn: string | null;
  specScopeOut: string | null;
  specTargetUsers: string | null;
  specSuccessCriteria: string | null;
  specMarkdown: string;
  modelFromRequest?: string | null;
}): Promise<{
  tasks: TaskDraftAiItem[];
  model: string;
  usage: TaskDraftOpenAiUsage | null;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const trimmed = input.modelFromRequest?.trim();
  const model =
    trimmed && trimmed.length > 0 ? trimmed : process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  const userMessage = buildUserMessage({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    projectType: input.projectType,
    specCoreGoals: input.specCoreGoals,
    specScopeIn: input.specScopeIn,
    specScopeOut: input.specScopeOut,
    specTargetUsers: input.specTargetUsers,
    specSuccessCriteria: input.specSuccessCriteria,
    specMarkdown: input.specMarkdown,
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior engineering lead. Output only valid JSON matching the user's schema. No markdown fences or commentary.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const tasks = parseTaskDraftOpenAiJson(raw);

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? {
          promptTokens: u.prompt_tokens,
          completionTokens: u.completion_tokens,
          totalTokens: u.total_tokens,
        }
      : null;

  return { tasks, model, usage };
}
