export type CodeAgentProvider = "cursor" | "codex" | "copilot" | "tabby" | "custom";

export const CODE_AGENT_PROVIDERS: readonly CodeAgentProvider[] = [
  "cursor",
  "codex",
  "copilot",
  "tabby",
  "custom",
];

export const DEFAULT_CODE_AGENT_PROVIDER: CodeAgentProvider = "cursor";

const PROVIDER_LABELS: Record<CodeAgentProvider, string> = {
  cursor: "Cursor",
  codex: "Codex",
  copilot: "Copilot Agent",
  tabby: "Tabby",
  custom: "Code Agent",
};

export function codeAgentProviderLabel(provider: CodeAgentProvider): string {
  return PROVIDER_LABELS[provider] ?? "Code Agent";
}

export function parseCodeAgentProvider(raw: unknown): CodeAgentProvider {
  const v = String(raw ?? "").trim().toLowerCase();
  if ((CODE_AGENT_PROVIDERS as readonly string[]).includes(v)) return v as CodeAgentProvider;
  return DEFAULT_CODE_AGENT_PROVIDER;
}

export function inferCodeAgentProviderFromBranch(branchName: string): CodeAgentProvider {
  const m = String(branchName ?? "").trim().match(/^wip\/([^/]+)\//);
  if (m?.[1]) return parseCodeAgentProvider(m[1]);
  return DEFAULT_CODE_AGENT_PROVIDER;
}

export function buildProviderWipBranchName(
  provider: CodeAgentProvider,
  projectId: string,
  primaryTaskId: string,
): string {
  const slug = (primaryTaskId || projectId)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `wip/${provider}/${slug || "task"}`;
}

function stripLeadingTaskIdFromTitle(taskTitle: string, taskId?: string): string {
  const title = taskTitle.trim() || "implementation task";
  const id = taskId?.trim();
  if (!id) return title;
  const bracketed = `[${id}]`;
  if (title.startsWith(bracketed)) {
    return title.slice(bracketed.length).trim() || title;
  }
  return title;
}

export function buildProviderWipCommitMessage(
  provider: CodeAgentProvider,
  taskTitle: string,
  refactor = false,
  taskId?: string,
): string {
  const title = stripLeadingTaskIdFromTitle(taskTitle, taskId);
  const taskPrefix = taskId?.trim() ? `[${taskId.trim()}] ` : "";
  const body = `${taskPrefix}${title}`;
  return refactor ? `wip(${provider}): refactor ${body}` : `wip(${provider}): ${body}`;
}

export function codeAgentIsNotSingleChatMember(): boolean {
  return true;
}
