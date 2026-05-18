/**
 * 레거시: 확정 Project Spec을 R->D->F->T 계층으로 분해해 생성한다 (OpenAI 다회 호출).
 * 기본 Task 생성 경로는 `singlePassGenerateTaskDraftsWithOpenAI` + `singlePassSyncTaskDraftsForProjectSpecVersion`.
 */

import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import type { TaskNodeType } from "@/lib/project-spec/taskDraftHierarchy";
import {
  EXECUTION_TASK_KINDS,
  ESTIMATED_SIZES,
  TASK_PRIORITIES,
  type GeneratedExecutionTask,
} from "@/lib/project-spec/generatedExecutionTask";
import { buildFallbackExecutionTasks, validateGeneratedExecutionTasks } from "@/lib/project-spec/validateGeneratedExecutionTasks";
import {
  type NfrCategory,
  type StoredRequirementType,
  withRequirementMeta,
} from "@/lib/project-spec/requirementDraftMeta";
import {
  DEFAULT_TASK_DRAFT_GENERATION_REQUIREMENTS_PROMPT_TEMPLATE,
  applyTaskDraftGenerationPromptTemplate,
} from "@/lib/project-spec/taskDraftGenerationPromptTemplate";

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
  executionKind?: "api" | "logic" | "ui" | "data" | "infra" | "test";
  /** Feature 내 로컬 ID → DB 저장 시 형제 Task 간 dependsOn 해석용 */
  localTaskId?: string;
  dependsOnLocalIds?: string[];
  /** requirement 노드만 */
  requirementType?: StoredRequirementType;
  nfrCategory?: NfrCategory;
};

export type TaskDraftOpenAiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const MAX_SPEC_CHARS = 48_000;

function clipSpec(md: string): string {
  return md.length > MAX_SPEC_CHARS ? `${md.slice(0, MAX_SPEC_CHARS)}\n\n[이하 생략됨 — 앞부분만 전달]` : md;
}

function buildRequirementsPrompt(input: {
  projectName: string;
  projectDescription: string | null;
  projectType: string;
  specMarkdown: string;
}, taskPromptTemplate?: string | null): string {
  const template = String(taskPromptTemplate ?? "").trim() || DEFAULT_TASK_DRAFT_GENERATION_REQUIREMENTS_PROMPT_TEMPLATE;
  return applyTaskDraftGenerationPromptTemplate(template, {
    projectName: input.projectName,
    projectType: input.projectType,
    projectDescription: input.projectDescription?.trim() || "(없음)",
    specMarkdown: clipSpec(input.specMarkdown),
  });
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
  return `STRICT EXECUTION MODE — 이 Feature만 대상으로 **자동 실행(Cursor+Git) 가능한** Task 파이프라인을 JSON으로 만든다.

[목표]
1) 구현 1사이클·1논리 커밋 단위로 끝나는 과제만
2) 입력/출력 명확, 단독 검증 가능
3) 의존성 DAG 정확 (순환 없음, 전 노드 도달 가능, 루트 1개 이상)

[Feature]
- 제목: ${feature.title}
- 우선순위 힌트: ${feature.priority}
- 설명:
${feature.description.slice(0, 6000)}

[출력 JSON — 키 이름 정확히]
{
  "tasks": [
    {
      "id": "T-1",
      "title": "구체적 구현 단위 (한 가지 책임만)",
      "description": "어느 모듈/레이어에서 무엇을 하는지",
      "input": "선행 산출물·환경·데이터",
      "output": "커밋 단위 산출물",
      "acceptanceCriteria": ["측정·검증 가능 3~5문장"],
      "executionKind": "api|logic|ui|data|test",
      "dependencies": ["선행 Task의 id. 루트는 []"],
      "estimatedSize": "S|M|L",
      "priority": "P0|P1|P2"
    }
  ],
  "dag": []
}

dag는 tasks와 동일 id·dependencies를 요약한 배열이어도 되고, 빈 배열이어도 된다. **의존성의 진실은 tasks[].dependencies** 이다.

[레이어 분해 — Feature당 **4~8개** Task 권장]
- **data**: DB 스키마/마이그레이션, 공유 DTO·타입
- **logic**: 유효성·도메인 서비스 (DTO/스키마 정의 이후 가능하면 선행 반영)
- **api**: HTTP/컨트롤러/라우트 (서비스·계약 준비 후)
- **ui**: 필요할 때만 (API 또는 핵심 로직 이후)
- **test**: 검증 대상 API·로직 **이후**에 의존

[DAG 원칙]
- Schema/DTO 병렬 루트 허용 → 이후 수렴(예: Service가 schema+dto/validation에 의존).
- 검증(validation)은 해당 DTO/필드 정의 **이후**.
- API는 서비스·계약 **이후**.
- 테스트는 테스트 대상 구현 **이후**.
- 순환 금지. 고립 노드·분리 컴포넌트 금지.

[나쁜 예 — 절대 금지]
- "사용자 기능 전부", "시스템 구축", "보안 적용(비기능만)" 같이 거대·모호·NFR 전용 Task

[호환 필드]
- id 대신 localId, dependencies 대신 dependsOn, executionKind 대신 type 사용 가능하나, 한 객체 안에서 일관되게.

[출력 전 자가검증]
순환 없음, 기능 구현 Task만, 과제가 과대하지 않음.

JSON만 출력.`;
}

/** 모델이 NFR성 실행 Task를 섞었을 때 제거 (최소 Task 수 미만이 되면 원본 유지) */
function filterExecutionTasksExcludingNonFunctional(tasks: GeneratedExecutionTask[]): GeneratedExecutionTask[] {
  const blob = (t: GeneratedExecutionTask) => `${t.title}\n${t.description}\n${t.input}\n${t.output}`.toLowerCase();
  const nfrLike =
    /\b(nfr|non[-\s]?functional)\b|비기능\s*요구|비기능\s*전용|성능\s*튜닝\s*전용|보안\s*감사\s*만|로깅\s*인프라\s*만|모니터링\s*대시보드\s*만|sla\s*달성\s*만|rto\b|rpo\b|가용성\s*\d|스케일(아웃|링)\s*만|compliance[-\s]only/i;
  const filtered = tasks.filter((t) => !nfrLike.test(blob(t)));
  return filtered.length >= 4 ? filtered : tasks;
}

function parseExecutionTasksFromJsonRoot(root: Record<string, unknown>): GeneratedExecutionTask[] {
  const tasksUnknown = root.tasks;
  if (!Array.isArray(tasksUnknown) || tasksUnknown.length === 0) {
    throw new Error("EMPTY_EXECUTION_TASKS");
  }
  return parseExecutionTasksFromJson(tasksUnknown);
}

function parseExecutionTasksFromJson(tasksUnknown: unknown): GeneratedExecutionTask[] {
  if (!Array.isArray(tasksUnknown) || tasksUnknown.length === 0) {
    throw new Error("EMPTY_EXECUTION_TASKS");
  }
  const out: GeneratedExecutionTask[] = [];
  for (const item of tasksUnknown) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const localId = String(o.localId ?? o.id ?? "").trim();
    const title = String(o.title ?? "").trim();
    if (!localId || !title) continue;
    const dependsRaw = Array.isArray(o.dependsOn)
      ? o.dependsOn
      : Array.isArray(o.dependencies)
        ? o.dependencies
        : [];
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
    let kindRaw = String(o.type ?? o.taskKind ?? o.executionKind ?? "logic")
      .toLowerCase()
      .trim();
    if (kindRaw === "infra") {
      kindRaw = "data";
    }
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
    console.info("[task-drafts] openai execution tasks attempt start", {
      featureTitle: feature.title,
      attempt: attempt + 1,
      model,
    });
    const res = await completeJson({
      apiKey,
      model,
      userMessage: buildExecutionTasksForSingleFeaturePrompt(feature),
    });
    lastUsage = res.usage;
    console.info("[task-drafts] openai execution tasks attempt done", {
      featureTitle: feature.title,
      attempt: attempt + 1,
      usage: res.usage,
      textLen: res.text.length,
    });
    let parsed: GeneratedExecutionTask[];
    try {
      const root = parseJson(res.text);
      parsed = parseExecutionTasksFromJsonRoot(root);
    } catch {
      continue;
    }
    const cleaned = filterExecutionTasksExcludingNonFunctional(parsed);
    const v = validateGeneratedExecutionTasks(cleaned);
    if (v.ok) {
      console.info("[task-drafts] openai execution tasks validated", {
        featureTitle: feature.title,
        attempt: attempt + 1,
        taskCount: cleaned.length,
      });
      return { tasks: cleaned, usage: res.usage };
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

type ParsedRequirementRow = {
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  requirementType: StoredRequirementType;
  nfrCategory: NfrCategory | null;
  /** FR 추출 단계에서만 채움 → 설계 프롬프트에 주입 */
  functionalHints?: {
    input?: string;
    output?: string;
    acceptanceCriteria?: string[];
    executionKind?: string;
  };
};

const NFR_CATEGORIES: readonly NfrCategory[] = [
  "performance",
  "security",
  "quality",
  "operational",
  "policy",
] as const;

function normalizeNfrCategoryLabel(raw: string): NfrCategory {
  const c = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const aliases: Record<string, NfrCategory> = {
    performance: "performance",
    security: "security",
    quality: "quality",
    operational: "operational",
    policy: "policy",
    availability: "operational",
    scalability: "operational",
    logging: "operational",
    monitoring: "operational",
  };
  if (aliases[c]) {
    return aliases[c];
  }
  return NFR_CATEGORIES.includes(c as NfrCategory) ? (c as NfrCategory) : "operational";
}

function parseFunctionalRequirementFromShape(o: Record<string, unknown>): ParsedRequirementRow | null {
  const title = String(o.title ?? "").trim();
  if (!title) {
    return null;
  }
  const desc = String(o.description ?? "").trim();
  const input = String(o.input ?? "").trim();
  const output = String(o.output ?? "").trim();
  const ac = Array.isArray(o.acceptanceCriteria)
    ? o.acceptanceCriteria.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const executionKind = String(o.executionKind ?? "").trim();
  const rt = String(o.requirementType ?? o.type ?? "FUNCTIONAL")
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (
    rt === "NON_FUNCTIONAL" ||
    rt === "NONFUNCTIONAL" ||
    rt === "NFR" ||
    rt === "NON-FUNCTIONAL"
  ) {
    return null;
  }
  return {
    title: title.slice(0, 500),
    description: desc.slice(0, 8000),
    priority: normalizePriority(o.priority),
    requirementType: "FUNCTIONAL",
    nfrCategory: null,
    functionalHints: {
      ...(input ? { input: input.slice(0, 4000) } : {}),
      ...(output ? { output: output.slice(0, 4000) } : {}),
      ...(ac.length ? { acceptanceCriteria: ac.slice(0, 12) } : {}),
      ...(executionKind ? { executionKind: executionKind.slice(0, 64) } : {}),
    },
  };
}

function parseNonFunctionalConstraintFromShape(o: Record<string, unknown>): ParsedRequirementRow | null {
  const title = String(o.title ?? "").trim();
  if (!title) {
    return null;
  }
  const cat = normalizeNfrCategoryLabel(String(o.nfrCategory ?? o.category ?? "operational"));
  return {
    title: title.slice(0, 500),
    description: String(o.description ?? "").trim().slice(0, 8000),
    priority: normalizePriority(o.priority),
    requirementType: "NON_FUNCTIONAL",
    nfrCategory: cat,
  };
}

function requirementDescriptionForPipeline(r: ParsedRequirementRow): string {
  if (r.requirementType !== "FUNCTIONAL") {
    return r.description;
  }
  const h = r.functionalHints;
  if (!h) {
    return r.description;
  }
  const parts = [r.description.trim()];
  if (h.input) {
    parts.push(`입력(계약): ${h.input}`);
  }
  if (h.output) {
    parts.push(`출력(계약): ${h.output}`);
  }
  if (h.acceptanceCriteria?.length) {
    parts.push(`수용 기준(요구에서): ${h.acceptanceCriteria.join(" | ")}`);
  }
  if (h.executionKind) {
    parts.push(`실행 종류 힌트: ${h.executionKind}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function parseAllRequirementsFromOpenAiRoot(reqJson: Record<string, unknown>): ParsedRequirementRow[] {
  const legacy = reqJson.requirements;
  if (Array.isArray(legacy)) {
    const out: ParsedRequirementRow[] = [];
    for (const item of legacy) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = parseRequirementFromOpenAiRow(item as Record<string, unknown>);
      if (row) {
        out.push(row);
      }
    }
    return out;
  }

  const out: ParsedRequirementRow[] = [];
  const frFrom: unknown[] = [];
  if (Array.isArray(reqJson.functionalRequirements)) {
    frFrom.push(...reqJson.functionalRequirements);
  }
  if (Array.isArray(reqJson.tasks)) {
    frFrom.push(...reqJson.tasks);
  }
  for (const item of frFrom) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = parseFunctionalRequirementFromShape(item as Record<string, unknown>);
    if (row) {
      out.push(row);
    }
  }
  const nfrArr = reqJson.nonFunctionalConstraints;
  if (Array.isArray(nfrArr)) {
    for (const item of nfrArr) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = parseNonFunctionalConstraintFromShape(item as Record<string, unknown>);
      if (row) {
        out.push(row);
      }
    }
  }
  return out;
}

function parseRequirementFromOpenAiRow(o: Record<string, unknown>): ParsedRequirementRow | null {
  const title = String(o.title ?? "").trim();
  if (!title) return null;
  const rtRaw = String(o.requirementType ?? o.type ?? "FUNCTIONAL")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .trim();
  let requirementType: StoredRequirementType = "FUNCTIONAL";
  if (
    rtRaw === "NON_FUNCTIONAL" ||
    rtRaw === "NONFUNCTIONAL" ||
    rtRaw === "NFR" ||
    rtRaw === "NON-FUNCTIONAL"
  ) {
    requirementType = "NON_FUNCTIONAL";
  }
  const catRaw = String(o.nfrCategory ?? o.nonFunctionalCategory ?? "").toLowerCase().trim();
  let nfrCategory: NfrCategory | null = null;
  if (requirementType === "NON_FUNCTIONAL") {
    nfrCategory = normalizeNfrCategoryLabel(catRaw || "operational");
  }
  return {
    title: title.slice(0, 500),
    description: String(o.description ?? "").trim().slice(0, 8000),
    priority: normalizePriority(o.priority),
    requirementType,
    nfrCategory,
  };
}

function parsedRowToHierarchyItem(r: ParsedRequirementRow): TaskDraftAiItem {
  const description =
    r.requirementType === "NON_FUNCTIONAL"
      ? withRequirementMeta(r.description, {
          requirementType: "NON_FUNCTIONAL",
          nfrCategory: r.nfrCategory,
        })
      : requirementDescriptionForPipeline(r);
  return {
    type: "requirement",
    title: r.title,
    description,
    priority: r.priority,
    parentTitle: null,
    acceptanceCriteria: [],
    requirementType: r.requirementType,
    nfrCategory: r.nfrCategory ?? undefined,
  };
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
  const res = await postOpenAiChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      {
        role: "system",
        content:
          "You are a senior product/engineering lead. Output only valid JSON matching the user's schema.",
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

/** 레거시 다단계 파이프라인 (요구→설계→기능→실행). 기본 생성 경로에서는 사용하지 않는다. */
export async function legacyPipelineGenerateTaskDraftsWithOpenAI(input: {
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
  /** project.taskPrompt override (요구사항 추출 단계 userMessage template) */
  taskPromptTemplate?: string | null;
  /** API 호환용. 설계→기능→실행 파이프라인은 항상 기능 요구(FR)만 사용 (NFR는 requirement 노드·nonFunctionalConstraints로만 유지). */
  includeNonFunctionalInExecutionPipeline?: boolean;
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
    trimmed && trimmed.length > 0 ? trimmed : resolveOpenAiModelFromEnv();

  console.info("[task-drafts] openai requirements extraction start", { model });
  const reqRes = await completeJson({
    apiKey,
    model,
    userMessage: buildRequirementsPrompt(
      {
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        projectType: input.projectType,
        specMarkdown: input.specMarkdown,
      },
      input.taskPromptTemplate
    ),
  });
  console.info("[task-drafts] openai requirements extraction done", {
    usage: reqRes.usage,
    textLen: reqRes.text.length,
  });
  void input.includeNonFunctionalInExecutionPipeline;

  const reqJson = parseJson(reqRes.text);
  const parsedRequirements = parseAllRequirementsFromOpenAiRoot(reqJson);
  if (parsedRequirements.length === 0) {
    throw new Error("OPENAI_TASK_DRAFT_EMPTY_TASKS");
  }

  const functionalReqs = parsedRequirements.filter((r) => r.requirementType === "FUNCTIONAL");
  const reqsForPipeline = functionalReqs;
  if (reqsForPipeline.length === 0) {
    throw new Error("OPENAI_TASK_DRAFT_NO_FUNCTIONAL_REQUIREMENTS");
  }

  const hierarchyRequirementItems = parsedRequirements.map(parsedRowToHierarchyItem);

  console.info("[task-drafts] openai design decomposition start", { reqCount: reqsForPipeline.length, model });
  const designRes = await completeJson({
    apiKey,
    model,
    userMessage: buildDesignPrompt(
      reqsForPipeline.map((r) => ({
        title: r.title,
        description: requirementDescriptionForPipeline(r),
      }))
    ),
  });
  console.info("[task-drafts] openai design decomposition done", { usage: designRes.usage, textLen: designRes.text.length });
  const designJson = parseJson(designRes.text);
  const reqTitleSet = new Set(reqsForPipeline.map((r) => r.title));
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

  console.info("[task-drafts] openai feature decomposition start", { designTargets: designTargets.length, model });
  const featureRes = await completeJson({
    apiKey,
    model,
    userMessage: buildFeaturePrompt(designTargets),
  });
  console.info("[task-drafts] openai feature decomposition done", { usage: featureRes.usage, textLen: featureRes.text.length });
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
  for (let featureIndex = 0; featureIndex < features.length; featureIndex++) {
    const f = features[featureIndex];
    console.info("[task-drafts] openai execution tasks start", {
      featureIndex: featureIndex + 1,
      featureCount: features.length,
      featureTitle: f.title,
      model,
    });
    const { tasks: execTasks, usage: fu } = await generateValidatedExecutionTasksForFeature({
      apiKey,
      model,
      feature: {
        title: f.title,
        description: f.description,
        priority: f.priority,
      },
    });
    console.info("[task-drafts] openai execution tasks done", {
      featureIndex: featureIndex + 1,
      generatedTaskDrafts: execTasks.length,
      usage: fu,
    });
    executionTaskItems.push(...executionTasksToAiItems(f.title, execTasks));
    if (fu) {
      featureGenPrompt += fu.promptTokens;
      featureGenCompletion += fu.completionTokens;
      featureGenTotal += fu.totalTokens;
    }
  }

  const all = [...hierarchyRequirementItems, ...designTargets, ...features, ...executionTaskItems];
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
