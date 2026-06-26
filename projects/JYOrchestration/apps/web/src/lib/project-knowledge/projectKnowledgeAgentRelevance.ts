export const PROJECT_KNOWLEDGE_AGENTS = [
  "planner",
  "analyst",
  "developer",
  "reviewer",
  "security",
] as const;

export type ProjectKnowledgeAgent = (typeof PROJECT_KNOWLEDGE_AGENTS)[number];

export const AGENT_KNOWLEDGE_USE_AS = [
  "context",
  "question_hint",
  "mvp_scope",
  "flow_hint",
  "implementation_hint",
  "checklist",
  "risk",
  "constraint",
] as const;

export type AgentKnowledgeUseAs = (typeof AGENT_KNOWLEDGE_USE_AS)[number];

export type AgentKnowledgeUse = Readonly<{
  readonly relevance: number;
  readonly useAs: AgentKnowledgeUseAs;
  readonly reason: string;
  readonly promptSummary: string;
}>;

export type AgentRelevance = Partial<Record<ProjectKnowledgeAgent, AgentKnowledgeUse>>;

const AGENT_SET = new Set<string>(PROJECT_KNOWLEDGE_AGENTS);
const USE_AS_SET = new Set<string>(AGENT_KNOWLEDGE_USE_AS);

const PROMPT_SUMMARY_MAX_LEN = 480;

const SENSITIVE_PROMPT_PATTERNS: readonly RegExp[] = [
  /\bsk-[a-zA-Z0-9]{8,}\b/,
  /\bBearer\s+[a-zA-Z0-9._-]+\b/i,
  /\b(api[_-]?key|secret|token|password)\s*[:=]/i,
  /\bprovider[_-]?key\b/i,
  /-----BEGIN [A-Z ]+-----/,
];

function readMetaRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

export function clampRelevance(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function isProjectKnowledgeAgent(value: unknown): value is ProjectKnowledgeAgent {
  return typeof value === "string" && AGENT_SET.has(value);
}

function parseUseAs(raw: unknown): AgentKnowledgeUseAs {
  const v = String(raw ?? "").trim();
  if (USE_AS_SET.has(v)) return v as AgentKnowledgeUseAs;
  return "context";
}

export function sanitizeAgentPromptSummary(summary: unknown): string {
  const text = String(summary ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  for (const pattern of SENSITIVE_PROMPT_PATTERNS) {
    if (pattern.test(text)) return "";
  }
  if (text.length > PROMPT_SUMMARY_MAX_LEN) {
    return `${text.slice(0, PROMPT_SUMMARY_MAX_LEN - 1)}…`;
  }
  return text;
}

function normalizeAgentKnowledgeUse(raw: unknown): AgentKnowledgeUse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const promptSummary = sanitizeAgentPromptSummary(o.promptSummary);
  const reason = String(o.reason ?? "").trim().slice(0, 240);
  if (!promptSummary && !reason) return null;
  return {
    relevance: clampRelevance(o.relevance),
    useAs: parseUseAs(o.useAs),
    reason,
    promptSummary: promptSummary || reason,
  };
}

/** Normalizes unknown input to a safe AgentRelevance map (empty when invalid). */
export function normalizeAgentRelevance(input: unknown): AgentRelevance {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const root = input as Record<string, unknown>;
  const out: Partial<Record<ProjectKnowledgeAgent, AgentKnowledgeUse>> = {};
  for (const [key, value] of Object.entries(root)) {
    if (!isProjectKnowledgeAgent(key)) continue;
    const use = normalizeAgentKnowledgeUse(value);
    if (!use) continue;
    out[key] = use;
  }
  return out;
}

export function parseAgentRelevanceFromGraphNodeMetadata(metadata: unknown): AgentRelevance {
  const root = readMetaRecord(metadata);
  if (!root) return {};
  return normalizeAgentRelevance(root.agentRelevance);
}

export function serializeAgentRelevanceForMetadata(agentRelevance: AgentRelevance): Record<string, unknown> {
  const normalized = normalizeAgentRelevance(agentRelevance);
  const out: Record<string, unknown> = {};
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    const use = normalized[agent];
    if (!use) continue;
    out[agent] = {
      relevance: use.relevance,
      useAs: use.useAs,
      reason: use.reason,
      promptSummary: use.promptSummary,
    };
  }
  return out;
}

export function mergeAgentRelevanceIntoGraphNodeMetadata(
  metadata: Record<string, unknown>,
  agentRelevance: AgentRelevance,
): Record<string, unknown> {
  const serialized = serializeAgentRelevanceForMetadata(agentRelevance);
  if (Object.keys(serialized).length === 0) {
    const { agentRelevance: _removed, ...rest } = metadata;
    return rest;
  }
  return { ...metadata, agentRelevance: serialized };
}

export type AgentRelevanceNodeLike = Readonly<{
  readonly metadata?: unknown;
  readonly agentRelevance?: AgentRelevance | unknown;
}>;

export function resolveAgentRelevanceFromNode(node: AgentRelevanceNodeLike | null | undefined): AgentRelevance {
  if (!node) return {};
  if (node.agentRelevance != null) {
    return normalizeAgentRelevance(node.agentRelevance);
  }
  return parseAgentRelevanceFromGraphNodeMetadata(node.metadata);
}

export function getAgentRelevance(
  node: AgentRelevanceNodeLike | null | undefined,
  agent: ProjectKnowledgeAgent,
): AgentKnowledgeUse | null {
  const map = resolveAgentRelevanceFromNode(node);
  return map[agent] ?? null;
}

export function hasAgentRelevance(
  node: AgentRelevanceNodeLike | null | undefined,
  agent: ProjectKnowledgeAgent,
  minRelevance = 0,
): boolean {
  const use = getAgentRelevance(node, agent);
  if (!use) return false;
  return use.relevance >= clampRelevance(minRelevance);
}

export function getAgentPromptSummary(
  node: AgentRelevanceNodeLike | null | undefined,
  agent: ProjectKnowledgeAgent,
): string {
  const use = getAgentRelevance(node, agent);
  if (!use) return "";
  const summary = sanitizeAgentPromptSummary(use.promptSummary);
  if (summary) return summary;
  return sanitizeAgentPromptSummary(use.reason);
}

export function emptyAgentRelevance(): AgentRelevance {
  return {};
}
