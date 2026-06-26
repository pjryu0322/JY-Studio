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

/** Minimum relevance for Graph projection visibility hints. */
export const DEFAULT_AGENT_RELEVANCE_THRESHOLD = 0.2;
/** Minimum relevance for prompt / memory injection candidates. */
export const DEFAULT_AGENT_PROMPT_RELEVANCE_THRESHOLD = 0.5;

const AGENT_SET = new Set<string>(PROJECT_KNOWLEDGE_AGENTS);
const USE_AS_SET = new Set<string>(AGENT_KNOWLEDGE_USE_AS);

const DEFAULT_AGENT_TEXT_MAX_LEN = 480;
const DEFAULT_AGENT_REASON_MAX_LEN = 240;

const SENSITIVE_AGENT_TEXT_PATTERNS: readonly RegExp[] = [
  /\bsk-[a-zA-Z0-9]{8,}\b/,
  /\bsk-proj-[a-zA-Z0-9_-]{8,}\b/i,
  /\bghp_[a-zA-Z0-9]{20,}\b/,
  /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/i,
  /\bxox[baprs]-[a-zA-Z0-9-]{10,}\b/i,
  /\bBearer\s+[a-zA-Z0-9._-]+\b/i,
  /\bAuthorization:\s*Bearer\s+/i,
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

export function sanitizeAgentKnowledgeText(value: unknown, maxLen = DEFAULT_AGENT_TEXT_MAX_LEN): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  for (const pattern of SENSITIVE_AGENT_TEXT_PATTERNS) {
    if (pattern.test(text)) return "";
  }
  if (text.length > maxLen) {
    return `${text.slice(0, maxLen - 1)}…`;
  }
  return text;
}

/** @deprecated Use sanitizeAgentKnowledgeText — kept for existing imports. */
export function sanitizeAgentPromptSummary(summary: unknown): string {
  return sanitizeAgentKnowledgeText(summary, DEFAULT_AGENT_TEXT_MAX_LEN);
}

function normalizeAgentKnowledgeUse(raw: unknown): AgentKnowledgeUse | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const reason = sanitizeAgentKnowledgeText(o.reason, DEFAULT_AGENT_REASON_MAX_LEN);
  const promptSummaryRaw = sanitizeAgentKnowledgeText(o.promptSummary, DEFAULT_AGENT_TEXT_MAX_LEN);
  const promptSummary = promptSummaryRaw || reason;
  if (!promptSummary) return null;
  return {
    relevance: clampRelevance(o.relevance),
    useAs: parseUseAs(o.useAs),
    reason,
    promptSummary,
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
    const fromTop = normalizeAgentRelevance(node.agentRelevance);
    if (Object.keys(fromTop).length > 0) return fromTop;
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
  minRelevance = DEFAULT_AGENT_RELEVANCE_THRESHOLD,
): boolean {
  const use = getAgentRelevance(node, agent);
  if (!use) return false;
  const threshold = clampRelevance(minRelevance);
  if (threshold <= 0) return use.relevance > 0;
  return use.relevance >= threshold;
}

export function isAgentPromptRelevant(
  node: AgentRelevanceNodeLike | null | undefined,
  agent: ProjectKnowledgeAgent,
  minRelevance = DEFAULT_AGENT_PROMPT_RELEVANCE_THRESHOLD,
): boolean {
  if (!hasAgentRelevance(node, agent, minRelevance)) return false;
  const use = getAgentRelevance(node, agent);
  if (!use) return false;
  const text = sanitizeAgentKnowledgeText(use.promptSummary) || sanitizeAgentKnowledgeText(use.reason);
  return text.length > 0;
}

export function getAgentPromptSummary(
  node: AgentRelevanceNodeLike | null | undefined,
  agent: ProjectKnowledgeAgent,
): string {
  const use = getAgentRelevance(node, agent);
  if (!use) return "";
  const summary = sanitizeAgentKnowledgeText(use.promptSummary);
  if (summary) return summary;
  return sanitizeAgentKnowledgeText(use.reason);
}

export function emptyAgentRelevance(): AgentRelevance {
  return {};
}
