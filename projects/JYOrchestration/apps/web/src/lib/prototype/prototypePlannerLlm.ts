import type { PrototypeWorkUnitComplexity, PrototypeWorkUnitRiskLevel } from "@/lib/prototype/prototypeRunTypes";

export type PrototypePlannerLlmAuth = Readonly<{
  apiKey: string;
  model: string;
}>;

export type PrototypePlannerLlmInput = Readonly<{
  projectName: string;
  projectDescription: string;
  ideationSummary: string;
  actorFlowSummary: string;
  featureDraftTitles: readonly string[];
  selectedTemplate: string;
  promptSnapshot: string;
  repositoryStructureHint: string;
  userFeedback: string;
  previousWorkUnitsSummary: string;
}>;

export type PrototypePlannerLlmDraftUnit = Readonly<{
  order: number;
  title: string;
  description: string;
  targetArea: string;
  implementationScope: string;
  dependencies: readonly string[];
  acceptanceCriteria: readonly string[];
  riskLevel: PrototypeWorkUnitRiskLevel;
  estimatedComplexity: PrototypeWorkUnitComplexity;
}>;

function parseJsonObject(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("PROTOTYPE_PLANNER_JSON_PARSE_FAILED");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("PROTOTYPE_PLANNER_JSON_INVALID_ROOT");
  return parsed as Record<string, unknown>;
}

function clampRisk(x: string): PrototypeWorkUnitRiskLevel {
  const u = x.trim().toLowerCase();
  if (u === "low" || u === "high" || u === "medium") return u;
  return "medium";
}

function clampComplexity(x: string): PrototypeWorkUnitComplexity {
  const u = x.trim().toLowerCase();
  if (u === "low" || u === "high" || u === "medium") return u;
  return "medium";
}

function normalizeDraftUnits(root: Record<string, unknown>): PrototypePlannerLlmDraftUnit[] {
  const raw = root.workUnits;
  if (!Array.isArray(raw)) throw new Error("PROTOTYPE_PLANNER_MISSING_WORK_UNITS");
  const out: PrototypePlannerLlmDraftUnit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const order = Number(o.order);
    const title = String(o.title ?? "").trim();
    if (!Number.isFinite(order) || order <= 0 || !title) continue;
    const description = String(o.description ?? "").trim() || title;
    const targetArea = String(o.targetArea ?? "").trim();
    const implementationScope = String(o.implementationScope ?? "").trim();
    const deps = Array.isArray(o.dependencies)
      ? (o.dependencies as unknown[]).map((d) => String(d ?? "").trim()).filter(Boolean)
      : [];
    const ac = Array.isArray(o.acceptanceCriteria)
      ? (o.acceptanceCriteria as unknown[]).map((d) => String(d ?? "").trim()).filter(Boolean)
      : [];
    out.push({
      order,
      title,
      description,
      targetArea,
      implementationScope,
      dependencies: deps,
      acceptanceCriteria: ac.length ? ac : [`${title} 구현 및 기본 동작 확인`],
      riskLevel: clampRisk(String(o.riskLevel ?? "")),
      estimatedComplexity: clampComplexity(String(o.estimatedComplexity ?? "")),
    });
  }
  out.sort((a, b) => a.order - b.order);
  if (out.length < 3 || out.length > 7) throw new Error("PROTOTYPE_PLANNER_WORK_UNIT_COUNT_INVALID");
  const orders = new Set(out.map((u) => u.order));
  if (orders.size !== out.length) throw new Error("PROTOTYPE_PLANNER_DUPLICATE_ORDER");
  return out;
}

/**
 * OpenAI JSON 모드로 구현 지향 WorkUnit 초안을 생성합니다.
 * API 키는 호출부(`resolvePrototypePlannerOpenAiCredential`)에서만 결정합니다.
 */
export async function generatePrototypeWorkUnitsWithOpenAI(
  input: PrototypePlannerLlmInput,
  auth: PrototypePlannerLlmAuth,
): Promise<{ ok: true; units: PrototypePlannerLlmDraftUnit[] } | { ok: false; error: string }> {
  const apiKey = auth.apiKey.trim();
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY_MISSING" };

  const model = auth.model.trim() || "gpt-4o-mini";

  const userBlock = [
    `프로젝트명: ${input.projectName}`,
    `선택 템플릿: ${input.selectedTemplate}`,
    "",
    "=== 아이디어·요약 ===",
    input.ideationSummary || "(없음)",
    "",
    "=== 프로젝트 설명 ===",
    input.projectDescription.slice(0, 12_000),
    "",
    "=== 액터·서비스 흐름 ===",
    input.actorFlowSummary.slice(0, 12_000),
    "",
    "=== 기능 정리(제목) ===",
    input.featureDraftTitles.join("\n") || "(없음)",
    "",
    "=== 저장소/스택 힌트 ===",
    input.repositoryStructureHint || "(미지정)",
    "",
    "=== Cursor 전달용 프롬프트 스냅샷(발췌) ===",
    input.promptSnapshot.slice(0, 16_000),
    "",
    "=== 이전 WorkUnit 요약(재생성 시) ===",
    input.previousWorkUnitsSummary || "(없음)",
    "",
    "=== 사용자 피드백(재생성 시) ===",
    input.userFeedback || "(없음)",
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${String(apiKey)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior frontend engineer planning Cursor execution batches for a prototype repo.
Output ONLY valid JSON with shape:
{"workUnits":[{"order":1,"title":"...","description":"...","targetArea":"path or module","implementationScope":"concrete files/components","dependencies":["optional order refs as strings"],"acceptanceCriteria":["..."],"riskLevel":"low|medium|high","estimatedComplexity":"low|medium|high"}]}

Rules:
- Produce 3 to 7 workUnits.
- Titles and descriptions MUST be implementation-oriented (components, routes, modules), NOT vague business milestones.
- Prefer boundaries: layout/shell, feature slices, data mocks, polish/docs.
- Korean for title, description, targetArea, implementationScope, acceptanceCriteria strings.
- dependencies: refer to prior orders like "1" or "2" when needed.
- Optimize for efficient Cursor agent runs (clear scope per unit).
- No markdown fences or commentary outside JSON.`,
        },
        { role: "user", content: userBlock },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, error: `OPENAI_HTTP_${res.status}:${errText.slice(0, 240)}` };
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "OPENAI_EMPTY_RESPONSE" };

  try {
    const root = parseJsonObject(text);
    const units = normalizeDraftUnits(root);
    return { ok: true, units };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PROTOTYPE_PLANNER_VALIDATE_FAILED";
    return { ok: false, error: msg };
  }
}
