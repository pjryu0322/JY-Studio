/**
 * 확정 Project Spec을 R->D->F->T 계층으로 분해해 생성한다.
 * Task 행은 Feature별로만 생성·검증한다 (Feature → Task).
 */

import type { TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";
import {
  EXECUTION_TASK_KINDS,
  ESTIMATED_SIZES,
  TASK_PRIORITIES,
  type GeneratedExecutionTask,
} from "@/lib/project-spec/generatedExecutionTask";
import { buildFallbackExecutionTasks, validateGeneratedExecutionTasks } from "@/lib/project-spec/validateGeneratedExecutionTasks";

export type TaskDraftAiItem = {
  type: TaskNodeType;
  title: string;
  description: string;
  /** R/D/F: HIGH|MEDIUM|LOW · 실행 Task: P0|P1|P2 */
  priority: string;
  parentTitle: string | null;
  acceptanceCriteria: string[];
  taskInput?: string;
  taskOutput?: string;
  estimatedSize?: "S" | "M" | "L";
  executionKind?: "api" | "logic" | "ui" | "infra" | "test";
  /** Feature 내 로컬 ID → DB 저장 시 형제 Task 간 dependsOn 해석용 */
  localTaskId?: string;
  dependsOnLocalIds?: string[];
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

function buildExecutionTasksForSingleFeaturePrompt(feature: {
  title: string;
  description: string;
  priority: string;
}): string {
  return `아래 **단일 Feature**에 대해서만 실행 가능한 개발 Task를 JSON으로 생성하라. (다른 Feature는 무시)

[Feature]
- 제목: ${feature.title}
- 우선순위 힌트: ${feature.priority}
- 설명:
${feature.description.slice(0, 6000)}

[출력 JSON — 키 이름을 정확히 맞출 것]
{
  "tasks": [
    {
      "localId": "영문_snake_또는_kebab (Feature 내 고유)",
      "dependsOn": ["선행 task의 localId. 루트 Task만 []"],
      "title": "구체적 실행 단위 (예: POST /orders API 엔드포인트 및 DTO 구현)",
      "description": "무엇을 어느 레이어/모듈에서 구현하는지, 핵심 로직 요약",
      "input": "이 Task가 사용하는 입력(필드·문서·환경 등)",
      "output": "산출물(코드·스키마·응답 형식 등)",
      "acceptanceCriteria": ["측정·검증 가능한 문장 3~5개"],
      "estimatedSize": "S|M|L",
      "priority": "P0|P1|P2",
      "type": "api|logic|ui|infra|test"
    }
  ]
}

[하드 규칙]
- tasks 배열 길이는 반드시 3~7.
- DAG: 순환 금지. dependsOn은 반드시 같은 배열 안의 다른 task의 localId만 참조.
- **루트 Task는 정확히 1개**(dependsOn이 []). 나머지는 최소 1개 이상의 선행 Task를 가진다.
- 그래프는 **약한 의미에서 연결**되어 있어야 함(고립된 Task/분리된 그룹 금지).
- 권장 흐름: 계약/API·스키마(api/infra) → 비즈니스 로직(logic) → UI(ui, 필요 시) → 검증(test).
- title은 모호한 표현 금지(예: "API 구현" 단독). 최소 14자 이상의 구체적 문장.
- input·output은 각각 충분히 구체적으로(6자 이상).
- JSON만 출력. 마크다운·설명 문장 금지.`;
}

function parseExecutionTasksFromJson(tasksUnknown: unknown): GeneratedExecutionTask[] {
  if (!Array.isArray(tasksUnknown) || tasksUnknown.length === 0) {
    throw new Error("EMPTY_EXECUTION_TASKS");
  }
  const out: GeneratedExecutionTask[] = [];
  for (const item of tasksUnknown) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const localId = String(o.localId ?? "").trim();
    const title = String(o.title ?? "").trim();
    if (!localId || !title) continue;
    const dependsRaw = Array.isArray(o.dependsOn) ? o.dependsOn : [];
    const dependsOn = dependsRaw.map((x) => String(x ?? "").trim()).filter(Boolean);
    const description = String(o.description ?? "").trim();
    const input = String(o.input ?? "").trim();
    const output = String(o.output ?? "").trim();
    const criteria = Array.isArray(o.acceptanceCriteria)
      ? o.acceptanceCriteria.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    const est = String(o.estimatedSize ?? "").toUpperCase().trim();
    const estimatedSize = ESTIMATED_SIZES.includes(est as "S" | "M" | "L") ? (est as "S" | "M" | "L") : ("M" as const);
    const pr = String(o.priority ?? "P1").toUpperCase().trim();
    const priority = TASK_PRIORITIES.includes(pr as "P0" | "P1" | "P2") ? (pr as "P0" | "P1" | "P2") : "P1";
    const kindRaw = String(o.type ?? o.taskKind ?? "logic").toLowerCase().trim();
    const taskKind = EXECUTION_TASK_KINDS.includes(kindRaw as GeneratedExecutionTask["taskKind"])
      ? (kindRaw as GeneratedExecutionTask["taskKind"])
      : "logic";
    out.push({
      localId,
      dependsOn,
      title: title.slice(0, 500),
      description: description.slice(0, 8000),
      input: input.slice(0, 4000),
      output: output.slice(0, 4000),
      acceptanceCriteria: criteria.slice(0, 8),
      estimatedSize,
      priority,
      taskKind,
    });
  }
  return out;
}

async function generateValidatedExecutionTasksForFeature(params: {
  apiKey: string;
  model: string;
  feature: { title: string; description: string; priority: string };
}): Promise<{ tasks: GeneratedExecutionTask[]; usage: TaskDraftOpenAiUsage | null }> {
  const { apiKey, model, feature } = params;
  const MAX = 3;
  let lastUsage: TaskDraftOpenAiUsage | null = null;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const res = await completeJson({
      apiKey,
      model,
      userMessage: buildExecutionTasksForSingleFeaturePrompt(feature),
    });
    lastUsage = res.usage;
    let parsed: GeneratedExecutionTask[];
    try {
      const root = parseJson(res.text);
      parsed = parseExecutionTasksFromJson(root.tasks);
    } catch {
      continue;
    }
    const v = validateGeneratedExecutionTasks(parsed);
    if (v.ok) {
      return { tasks: parsed, usage: res.usage };
    }
  }
  return {
    tasks: buildFallbackExecutionTasks(feature),
    usage: lastUsage,
  };
}

function executionTasksToAiItems(
  featureTitle: string,
  generated: GeneratedExecutionTask[]
): TaskDraftAiItem[] {
  return generated.map((t) => ({
    type: "task",
    title: t.title,
    description: t.description,
    priority: t.priority,
    parentTitle: featureTitle,
    acceptanceCriteria: t.acceptanceCriteria,
    taskInput: t.input,
    taskOutput: t.output,
    estimatedSize: t.estimatedSize,
    executionKind: t.taskKind,
    localTaskId: t.localId,
    dependsOnLocalIds: t.dependsOn,
  }));
}

function normalizePriority(p: unknown): "HIGH" | "MEDIUM" | "LOW" {
  const s = String(p ?? "").toUpperCase().trim();
  if (s === "HIGH" || s === "LOW" || s === "MEDIUM") {
    return s;
  }
  return "MEDIUM";
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

  const executionTaskItems: TaskDraftAiItem[] = [];
  let featureGenPrompt = 0;
  let featureGenCompletion = 0;
  let featureGenTotal = 0;
  for (const f of features) {
    const { tasks: execTasks, usage: fu } = await generateValidatedExecutionTasksForFeature({
      apiKey,
      model,
      feature: {
        title: f.title,
        description: f.description,
        priority: f.priority,
      },
    });
    executionTaskItems.push(...executionTasksToAiItems(f.title, execTasks));
    if (fu) {
      featureGenPrompt += fu.promptTokens;
      featureGenCompletion += fu.completionTokens;
      featureGenTotal += fu.totalTokens;
    }
  }

  const all = [...requirements, ...designTargets, ...features, ...executionTaskItems];
  if (all.length === 0) {
    throw new Error("OPENAI_TASK_DRAFT_NO_VALID_TASKS");
  }

  const usage =
    reqRes.usage || designRes.usage || featureRes.usage || featureGenTotal > 0
      ? {
          promptTokens:
            (reqRes.usage?.promptTokens ?? 0) +
            (designRes.usage?.promptTokens ?? 0) +
            (featureRes.usage?.promptTokens ?? 0) +
            featureGenPrompt,
          completionTokens:
            (reqRes.usage?.completionTokens ?? 0) +
            (designRes.usage?.completionTokens ?? 0) +
            (featureRes.usage?.completionTokens ?? 0) +
            featureGenCompletion,
          totalTokens:
            (reqRes.usage?.totalTokens ?? 0) +
            (designRes.usage?.totalTokens ?? 0) +
            (featureRes.usage?.totalTokens ?? 0) +
            featureGenTotal,
        }
      : null;

  return { tasks: all, model, usage };
}
