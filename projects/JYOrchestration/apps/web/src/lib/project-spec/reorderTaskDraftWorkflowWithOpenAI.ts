export type TaskDraftWorkflowSuggestion = {
  id: string;
  dependsOnIds: string[];
  positionX: number;
  positionY: number;
};

export type TaskDraftWorkflowAiMeta = {
  reason: string;
  parallelGroups: string[][];
  cycleCandidateEdges: Array<{ source: string; target: string }>;
};

const DEFAULT_MODEL = "gpt-4o-mini";

function toStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

function toNumber(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function parseWorkflowSuggestionJson(
  text: string
): { tasks: TaskDraftWorkflowSuggestion[]; meta: TaskDraftWorkflowAiMeta } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("OPENAI_WORKFLOW_JSON_PARSE_FAILED");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OPENAI_WORKFLOW_INVALID_ROOT");
  }
  const root = parsed as Record<string, unknown>;
  const raw = root.tasks;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("OPENAI_WORKFLOW_EMPTY_TASKS");
  }
  const tasks: TaskDraftWorkflowSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    tasks.push({
      id,
      dependsOnIds: toStringArray(o.dependsOnIds).slice(0, 50),
      positionX: toNumber(o.positionX),
      positionY: toNumber(o.positionY),
    });
  }
  if (tasks.length === 0) {
    throw new Error("OPENAI_WORKFLOW_NO_VALID_TASKS");
  }
  const reason = String(root.reason ?? "").trim() || "의존성과 병렬 실행 가능성을 기준으로 재배치";
  const rawParallel = Array.isArray(root.parallelGroups) ? root.parallelGroups : [];
  const parallelGroups = rawParallel
    .filter((g): g is unknown[] => Array.isArray(g))
    .map((g) => toStringArray(g).slice(0, 50))
    .filter((g) => g.length > 0)
    .slice(0, 20);
  const rawCycle = Array.isArray(root.cycleCandidateEdges) ? root.cycleCandidateEdges : [];
  const cycleCandidateEdges = rawCycle
    .map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => Boolean(x))
    .map((o) => ({ source: String(o.source ?? "").trim(), target: String(o.target ?? "").trim() }))
    .filter((e) => e.source.length > 0 && e.target.length > 0)
    .slice(0, 30);

  return { tasks, meta: { reason, parallelGroups, cycleCandidateEdges } };
}

function buildUserMessage(input: {
  projectName: string;
  specVersionNumber: number | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: string;
    acceptanceCriteria: string[];
    dependsOnIds: string[];
  }>;
}): string {
  const taskLines = input.tasks
    .map((t) => {
      const ac = (t.acceptanceCriteria ?? []).slice(0, 5).map((x) => `- ${x}`).join("\n");
      return `- id: ${t.id}
  title: ${t.title}
  priority: ${t.priority}
  dependsOnIds: ${(t.dependsOnIds ?? []).join(", ") || "(없음)"}
  acceptanceCriteria:
${ac || "- (없음)"}
  description: ${(t.description ?? "").slice(0, 240) || "(없음)"}`;
    })
    .join("\n\n");

  return `다음은 Project Spec 기반으로 생성된 TaskDraft 노드 목록이다. 목표는 "실행 흐름" 관점에서 적절한 DAG 의존성과 워크플로우 캔버스 좌표를 추천하는 것이다.

[프로젝트]
- 이름: ${input.projectName}
- Spec 버전: ${input.specVersionNumber != null ? `v${input.specVersionNumber}` : "(알 수 없음)"}

[현재 TaskDraft 목록]
${taskLines}

[출력 JSON 스키마 — 키 이름을 정확히 맞출 것]
{
  "reason": "재정렬 이유 한 줄 요약",
  "parallelGroups": [["병렬로 시작 가능한 TaskDraft id", "..."], ["..."]],
  "cycleCandidateEdges": [{"source":"idA","target":"idB"}],
  "tasks": [
    {
      "id": "TaskDraft id",
      "dependsOnIds": ["선행 TaskDraft id", "..."],
      "positionX": 0,
      "positionY": 0
    }
  ]
}

[규칙]
- 반드시 DAG가 되게 구성(순환 금지). 순환이 의심되면 기존 dependsOnIds를 유지.
- dependsOnIds는 위 목록에 있는 id만 사용.
- positionX/positionY는 px 단위. 좌→우로 진행되도록 rankdir=LR 스타일로 배치(선행이 왼쪽).
- JSON만 출력. 마크다운 코드펜스/설명 금지.`;
}

export async function reorderTaskDraftWorkflowWithOpenAI(input: {
  projectName: string;
  specVersionNumber: number | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: string;
    acceptanceCriteria: string[];
    dependsOnIds: string[];
  }>;
  modelFromRequest?: string | null;
}): Promise<{
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
  suggestion: TaskDraftWorkflowSuggestion[];
  meta: TaskDraftWorkflowAiMeta;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");
  }

  const trimmed = input.modelFromRequest?.trim();
  const model = trimmed && trimmed.length > 0 ? trimmed : process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const userMessage = buildUserMessage({
    projectName: input.projectName,
    specVersionNumber: input.specVersionNumber,
    tasks: input.tasks,
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
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
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const parsed = parseWorkflowSuggestionJson(raw);
  const u = body.usage;
  const usage =
    typeof u?.prompt_tokens === "number" &&
    typeof u?.completion_tokens === "number" &&
    typeof u?.total_tokens === "number"
      ? { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens }
      : null;

  return { model, usage, suggestion: parsed.tasks, meta: parsed.meta };
}

