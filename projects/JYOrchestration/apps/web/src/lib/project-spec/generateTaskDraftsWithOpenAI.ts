/**
 * 확정 Project Spec을 R->D->F->T 계층으로 분해해 생성한다.
 */

import type { TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";

export type TaskDraftAiItem = {
  type: TaskNodeType;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  parentTitle: string | null;
  acceptanceCriteria: string[];
};

export type TaskDraftOpenAiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_SPEC_CHARS = 48_000;

function clipSpec(md: string): string {
  return md.length > MAX_SPEC_CHARS ? `${md.slice(0, MAX_SPEC_CHARS)}\n\n[이하 생략됨 — 앞부분만 전달]` : md;
}

function buildRequirementsPrompt(input: {
  projectName: string;
  projectDescription: string | null;
  projectType: string;
  specMarkdown: string;
}): string {
  return `다음 Project Spec에서 사용자 중심 Functional Requirement를 추출하라.

[프로젝트]
- 이름: ${input.projectName}
- 유형: ${input.projectType}
- 설명: ${input.projectDescription?.trim() || "(없음)"}

[Project Spec]
---
${clipSpec(input.specMarkdown)}
---

[출력 JSON 스키마 — 키 이름을 정확히 맞출 것]
{
  "requirements": [
    {
      "id": "FR-1",
      "title": "요구사항 제목",
      "description": "사용자 가치 중심 설명",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ]
}

[규칙]
- 요구사항은 3~12개.
- 반드시 사용자 중심(무엇을 위해 필요한가).
- JSON만 출력. 마크다운 코드펜스나 설명 문장 금지.`;
}

function buildDesignPrompt(requirements: Array<{ title: string; description: string }>): string {
  const lines = requirements.map((r, i) => `${i + 1}. ${r.title} — ${r.description}`).join("\n");
  return `다음 요구사항 목록을 설계 대상으로 분해하라.

[요구사항]
${lines}

[출력 JSON]
{
  "designTargets": [
    {
      "title": "설계 대상",
      "description": "왜 필요한 설계 대상인지",
      "requirementTitle": "상위 requirement title 정확히 일치"
    }
  ]
}

[규칙]
- 각 requirement당 1~4개 design target.
- requirementTitle은 반드시 입력 목록의 title과 정확히 일치.
- JSON만 출력.`;
}

function buildFeaturePrompt(designs: Array<{ title: string; description: string }>): string {
  const lines = designs.map((d, i) => `${i + 1}. ${d.title} — ${d.description}`).join("\n");
  return `다음 설계 대상을 구현 가능한 feature로 분해하라.

[설계 대상]
${lines}

[출력 JSON]
{
  "features": [
    {
      "title": "기능 항목",
      "description": "기능 설명",
      "designTitle": "상위 design title 정확히 일치",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ]
}

[규칙]
- 각 design당 1~4개 feature.
- designTitle은 반드시 입력 목록 title과 정확히 일치.
- JSON만 출력.`;
}

function buildTaskPrompt(features: Array<{ title: string; description: string; priority: string }>): string {
  const lines = features.map((f, i) => `${i + 1}. ${f.title} (${f.priority}) — ${f.description}`).join("\n");
  return `다음 feature를 실제 구현 단위 task로 분해하라.

[Feature]
${lines}

[출력 JSON]
{
  "tasks": [
    {
      "title": "구현 단위 task",
      "description": "완료 기준 중심",
      "featureTitle": "상위 feature title 정확히 일치",
      "priority": "HIGH|MEDIUM|LOW",
      "acceptanceCriteria": ["검증 기준 1", "검증 기준 2"]
    }
  ]
}

[규칙]
- 각 feature당 1~4개 task.
- featureTitle은 반드시 입력 목록 title과 정확히 일치.
- JSON만 출력.`;
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

function parseJson(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OPENAI_TASK_DRAFT_JSON_PARSE_FAILED");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OPENAI_TASK_DRAFT_INVALID_ROOT");
  }
  return parsed as Record<string, unknown>;
}

function parseRows(
  rows: unknown,
  mapRow: (o: Record<string, unknown>) => TaskDraftAiItem | null
): TaskDraftAiItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: TaskDraftAiItem[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const mapped = mapRow(o);
    if (mapped) out.push(mapped);
  }
  return out;
}

async function completeJson(params: {
  apiKey: string;
  model: string;
  userMessage: string;
}): Promise<{
  text: string;
  usage: TaskDraftOpenAiUsage | null;
}> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior product/engineering lead. Output only valid JSON matching the user's schema.",
        },
        { role: "user", content: params.userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${errText.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");

  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens }
      : null;
  return { text, usage };
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

  const reqRes = await completeJson({
    apiKey,
    model,
    userMessage: buildRequirementsPrompt({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      projectType: input.projectType,
      specMarkdown: input.specMarkdown,
    }),
  });
  const reqJson = parseJson(reqRes.text);
  const requirements = parseRows(reqJson.requirements, (o) => {
    const title = String(o.title ?? "").trim();
    if (!title) return null;
    return {
      type: "requirement",
      title: title.slice(0, 500),
      description: String(o.description ?? "").trim().slice(0, 8000),
      priority: normalizePriority(o.priority),
      parentTitle: null,
      acceptanceCriteria: [],
    };
  });
  if (requirements.length === 0) throw new Error("OPENAI_TASK_DRAFT_EMPTY_TASKS");

  const designRes = await completeJson({
    apiKey,
    model,
    userMessage: buildDesignPrompt(requirements),
  });
  const designJson = parseJson(designRes.text);
  const reqTitleSet = new Set(requirements.map((r) => r.title));
  const designTargets = parseRows(designJson.designTargets, (o) => {
    const title = String(o.title ?? "").trim();
    const requirementTitle = String(o.requirementTitle ?? "").trim();
    if (!title || !reqTitleSet.has(requirementTitle)) return null;
    return {
      type: "design",
      title: title.slice(0, 500),
      description: String(o.description ?? "").trim().slice(0, 8000),
      priority: "MEDIUM",
      parentTitle: requirementTitle,
      acceptanceCriteria: [],
    };
  });

  const featureRes = await completeJson({
    apiKey,
    model,
    userMessage: buildFeaturePrompt(designTargets),
  });
  const featureJson = parseJson(featureRes.text);
  const designTitleSet = new Set(designTargets.map((d) => d.title));
  const features = parseRows(featureJson.features, (o) => {
    const title = String(o.title ?? "").trim();
    const designTitle = String(o.designTitle ?? "").trim();
    if (!title || !designTitleSet.has(designTitle)) return null;
    return {
      type: "feature",
      title: title.slice(0, 500),
      description: String(o.description ?? "").trim().slice(0, 8000),
      priority: normalizePriority(o.priority),
      parentTitle: designTitle,
      acceptanceCriteria: [],
    };
  });

  const taskRes = await completeJson({
    apiKey,
    model,
    userMessage: buildTaskPrompt(features),
  });
  const taskJson = parseJson(taskRes.text);
  const featureTitleSet = new Set(features.map((f) => f.title));
  const tasks = parseRows(taskJson.tasks, (o) => {
    const title = String(o.title ?? "").trim();
    const featureTitle = String(o.featureTitle ?? "").trim();
    if (!title || !featureTitleSet.has(featureTitle)) return null;
    return {
      type: "task",
      title: title.slice(0, 500),
      description: String(o.description ?? "").trim().slice(0, 8000),
      priority: normalizePriority(o.priority),
      parentTitle: featureTitle,
      acceptanceCriteria: toStringArray(o.acceptanceCriteria).slice(0, 20),
    };
  });

  const all = [...requirements, ...designTargets, ...features, ...tasks];
  if (all.length === 0) {
    throw new Error("OPENAI_TASK_DRAFT_NO_VALID_TASKS");
  }

  const usage =
    reqRes.usage || designRes.usage || featureRes.usage || taskRes.usage
      ? {
          promptTokens:
            (reqRes.usage?.promptTokens ?? 0) +
            (designRes.usage?.promptTokens ?? 0) +
            (featureRes.usage?.promptTokens ?? 0) +
            (taskRes.usage?.promptTokens ?? 0),
          completionTokens:
            (reqRes.usage?.completionTokens ?? 0) +
            (designRes.usage?.completionTokens ?? 0) +
            (featureRes.usage?.completionTokens ?? 0) +
            (taskRes.usage?.completionTokens ?? 0),
          totalTokens:
            (reqRes.usage?.totalTokens ?? 0) +
            (designRes.usage?.totalTokens ?? 0) +
            (featureRes.usage?.totalTokens ?? 0) +
            (taskRes.usage?.totalTokens ?? 0),
        }
      : null;

  return { tasks: all, model, usage };
}
