import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

export const USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION =
  "user_project_knowledge_memory_control_v1" as const;

export type UserProjectKnowledgeMemoryControlV1 = Readonly<{
  readonly version: typeof USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION;
  readonly enabled: boolean;
  readonly excludedSourceProjectIds: readonly string[];
  readonly ignoredMemoryItemIds: readonly string[];
  readonly pinnedMemoryItemIds: readonly string[];
  readonly agentEnabled?: Readonly<Partial<Record<ProjectKnowledgeAgent, boolean>>>;
  readonly updatedAt?: string;
}>;

export const DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1: UserProjectKnowledgeMemoryControlV1 =
  {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION,
    enabled: true,
    excludedSourceProjectIds: [],
    ignoredMemoryItemIds: [],
    pinnedMemoryItemIds: [],
  };

function dedupeTrimmedIds(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values ?? []) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function parseAgentEnabled(raw: unknown): Partial<Record<ProjectKnowledgeAgent, boolean>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<ProjectKnowledgeAgent, boolean>> = {};
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    if (!(agent in o)) continue;
    const v = o[agent];
    if (typeof v === "boolean") out[agent] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseUserProjectKnowledgeMemoryControlV1(
  raw: unknown,
): UserProjectKnowledgeMemoryControlV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION) return null;
  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION,
    enabled: typeof o.enabled === "boolean" ? o.enabled : true,
    excludedSourceProjectIds: dedupeTrimmedIds(
      Array.isArray(o.excludedSourceProjectIds)
        ? o.excludedSourceProjectIds.map((x) => String(x))
        : [],
    ),
    ignoredMemoryItemIds: dedupeTrimmedIds(
      Array.isArray(o.ignoredMemoryItemIds) ? o.ignoredMemoryItemIds.map((x) => String(x)) : [],
    ),
    pinnedMemoryItemIds: dedupeTrimmedIds(
      Array.isArray(o.pinnedMemoryItemIds) ? o.pinnedMemoryItemIds.map((x) => String(x)) : [],
    ),
    agentEnabled: parseAgentEnabled(o.agentEnabled),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt.trim() || undefined : undefined,
  };
}

export function normalizeUserProjectKnowledgeMemoryControlV1(
  raw: unknown,
): UserProjectKnowledgeMemoryControlV1 {
  const parsed = parseUserProjectKnowledgeMemoryControlV1(raw);
  if (!parsed) return { ...DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_V1 };
  return parsed;
}

export function patchUserProjectKnowledgeMemoryControlV1(
  current: unknown,
  patch: Partial<UserProjectKnowledgeMemoryControlV1>,
  nowIso?: string,
): UserProjectKnowledgeMemoryControlV1 {
  const base = normalizeUserProjectKnowledgeMemoryControlV1(current);
  const now = nowIso ?? new Date().toISOString();
  return {
    version: USER_PROJECT_KNOWLEDGE_MEMORY_CONTROL_VERSION,
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : base.enabled,
    excludedSourceProjectIds:
      patch.excludedSourceProjectIds !== undefined
        ? dedupeTrimmedIds([...patch.excludedSourceProjectIds])
        : base.excludedSourceProjectIds,
    ignoredMemoryItemIds:
      patch.ignoredMemoryItemIds !== undefined
        ? dedupeTrimmedIds([...patch.ignoredMemoryItemIds])
        : base.ignoredMemoryItemIds,
    pinnedMemoryItemIds:
      patch.pinnedMemoryItemIds !== undefined
        ? dedupeTrimmedIds([...patch.pinnedMemoryItemIds])
        : base.pinnedMemoryItemIds,
    agentEnabled:
      patch.agentEnabled !== undefined
        ? { ...base.agentEnabled, ...(parseAgentEnabled(patch.agentEnabled) ?? {}) }
        : base.agentEnabled,
    updatedAt: now,
  };
}

export function isAgentMemoryEnabledInControl(
  control: UserProjectKnowledgeMemoryControlV1,
  agent: ProjectKnowledgeAgent,
): boolean {
  if (!control.enabled) return false;
  const flag = control.agentEnabled?.[agent];
  if (flag === false) return false;
  return true;
}
