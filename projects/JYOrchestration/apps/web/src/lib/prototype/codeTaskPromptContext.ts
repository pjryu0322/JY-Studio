export const CODE_TASK_PROMPT_CONTEXT_VERSION = "code_task_prompt_context_v1" as const;
export const CODE_TASK_PROMPT_CONTEXT_MAP_VERSION = "code_task_prompt_context_map_v1" as const;

export type CodeTaskPromptContextSource = "planning_artifacts" | "heuristic_fallback" | "llm_refined";

export type CodeTaskPromptContextV1 = Readonly<{
  readonly version: typeof CODE_TASK_PROMPT_CONTEXT_VERSION;
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly source: CodeTaskPromptContextSource;
  readonly planningContext: Readonly<{
    readonly serviceGoal?: string;
    readonly targetUsers: readonly string[];
    readonly problemToSolve?: string;
    readonly businessGoal?: string;
  }>;
  readonly flowContext: Readonly<{
    readonly relatedActors: readonly string[];
    readonly relatedUserFlows: readonly string[];
    readonly relatedServiceSteps: readonly string[];
  }>;
  readonly featureContext: Readonly<{
    readonly relatedFeatures: readonly string[];
    readonly relatedScreens: readonly string[];
    readonly relatedStates: readonly string[];
    readonly inputs: readonly string[];
    readonly outputs: readonly string[];
  }>;
  readonly implementationContext: Readonly<{
    readonly intent: string;
    readonly requirements: readonly string[];
    readonly constraints: readonly string[];
    readonly expectedBehavior: readonly string[];
    readonly edgeCases: readonly string[];
  }>;
  readonly verificationContext: Readonly<{
    readonly acceptanceCriteria: readonly string[];
    readonly manualChecks: readonly string[];
    readonly regressionChecks: readonly string[];
  }>;
  readonly quality: Readonly<{
    readonly ready: boolean;
    readonly missing: readonly string[];
    readonly warnings: readonly string[];
  }>;
}>;

export type CodeTaskPromptContextMapV1 = Readonly<{
  readonly version: typeof CODE_TASK_PROMPT_CONTEXT_MAP_VERSION;
  readonly projectId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly contexts: Readonly<Record<string, CodeTaskPromptContextV1>>;
}>;

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
}

export function parseCodeTaskPromptContextV1(raw: unknown): CodeTaskPromptContextV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== CODE_TASK_PROMPT_CONTEXT_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const codeTaskId = String(o.codeTaskId ?? "").trim();
  const parentTaskId = String(o.parentTaskId ?? "").trim();
  if (!projectId || !codeTaskId || !parentTaskId) return null;
  const sourceRaw = String(o.source ?? "heuristic_fallback");
  const source: CodeTaskPromptContextSource =
    sourceRaw === "planning_artifacts" || sourceRaw === "llm_refined"
      ? sourceRaw
      : "heuristic_fallback";
  const pc = o.planningContext;
  const fc = o.flowContext;
  const feat = o.featureContext;
  const impl = o.implementationContext;
  const ver = o.verificationContext;
  const q = o.quality;
  return {
    version: CODE_TASK_PROMPT_CONTEXT_VERSION,
    projectId,
    codeTaskId,
    parentTaskId,
    createdAt: String(o.createdAt ?? "").trim() || new Date().toISOString(),
    updatedAt: String(o.updatedAt ?? "").trim() || new Date().toISOString(),
    source,
    planningContext: {
      serviceGoal: pc && typeof pc === "object" ? String((pc as Record<string, unknown>).serviceGoal ?? "").trim() || undefined : undefined,
      targetUsers:
        pc && typeof pc === "object" ? parseStringArray((pc as Record<string, unknown>).targetUsers) : [],
      problemToSolve:
        pc && typeof pc === "object"
          ? String((pc as Record<string, unknown>).problemToSolve ?? "").trim() || undefined
          : undefined,
      businessGoal:
        pc && typeof pc === "object"
          ? String((pc as Record<string, unknown>).businessGoal ?? "").trim() || undefined
          : undefined,
    },
    flowContext: {
      relatedActors: fc && typeof fc === "object" ? parseStringArray((fc as Record<string, unknown>).relatedActors) : [],
      relatedUserFlows:
        fc && typeof fc === "object" ? parseStringArray((fc as Record<string, unknown>).relatedUserFlows) : [],
      relatedServiceSteps:
        fc && typeof fc === "object" ? parseStringArray((fc as Record<string, unknown>).relatedServiceSteps) : [],
    },
    featureContext: {
      relatedFeatures:
        feat && typeof feat === "object" ? parseStringArray((feat as Record<string, unknown>).relatedFeatures) : [],
      relatedScreens:
        feat && typeof feat === "object" ? parseStringArray((feat as Record<string, unknown>).relatedScreens) : [],
      relatedStates:
        feat && typeof feat === "object" ? parseStringArray((feat as Record<string, unknown>).relatedStates) : [],
      inputs: feat && typeof feat === "object" ? parseStringArray((feat as Record<string, unknown>).inputs) : [],
      outputs: feat && typeof feat === "object" ? parseStringArray((feat as Record<string, unknown>).outputs) : [],
    },
    implementationContext: {
      intent: impl && typeof impl === "object" ? String((impl as Record<string, unknown>).intent ?? "").trim() : "",
      requirements:
        impl && typeof impl === "object" ? parseStringArray((impl as Record<string, unknown>).requirements) : [],
      constraints:
        impl && typeof impl === "object" ? parseStringArray((impl as Record<string, unknown>).constraints) : [],
      expectedBehavior:
        impl && typeof impl === "object" ? parseStringArray((impl as Record<string, unknown>).expectedBehavior) : [],
      edgeCases: impl && typeof impl === "object" ? parseStringArray((impl as Record<string, unknown>).edgeCases) : [],
    },
    verificationContext: {
      acceptanceCriteria:
        ver && typeof ver === "object" ? parseStringArray((ver as Record<string, unknown>).acceptanceCriteria) : [],
      manualChecks: ver && typeof ver === "object" ? parseStringArray((ver as Record<string, unknown>).manualChecks) : [],
      regressionChecks:
        ver && typeof ver === "object" ? parseStringArray((ver as Record<string, unknown>).regressionChecks) : [],
    },
    quality: {
      ready: q && typeof q === "object" ? Boolean((q as Record<string, unknown>).ready) : false,
      missing: q && typeof q === "object" ? parseStringArray((q as Record<string, unknown>).missing) : [],
      warnings: q && typeof q === "object" ? parseStringArray((q as Record<string, unknown>).warnings) : [],
    },
  };
}

export function parseCodeTaskPromptContextMapV1(raw: unknown): CodeTaskPromptContextMapV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== CODE_TASK_PROMPT_CONTEXT_MAP_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const contextsRaw = o.contexts;
  const contexts: Record<string, CodeTaskPromptContextV1> = {};
  if (contextsRaw && typeof contextsRaw === "object") {
    for (const [key, value] of Object.entries(contextsRaw)) {
      const parsed = parseCodeTaskPromptContextV1(value);
      if (parsed && parsed.codeTaskId === key.trim()) {
        contexts[key.trim()] = parsed;
      }
    }
  }
  return {
    version: CODE_TASK_PROMPT_CONTEXT_MAP_VERSION,
    projectId,
    createdAt: String(o.createdAt ?? "").trim() || new Date().toISOString(),
    updatedAt: String(o.updatedAt ?? "").trim() || new Date().toISOString(),
    contexts,
  };
}

export function getCodeTaskPromptContextFromMap(
  map: CodeTaskPromptContextMapV1 | null | undefined,
  codeTaskId: string,
): CodeTaskPromptContextV1 | null {
  const id = codeTaskId.trim();
  if (!id || !map?.contexts) return null;
  return map.contexts[id] ?? null;
}
