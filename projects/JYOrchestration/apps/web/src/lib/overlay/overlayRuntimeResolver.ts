import type { AiIdentityContract, OverlayAiCapabilityId, OverlayAiPerspectiveId, OverlayKnowledgeScopeId } from "@/lib/overlay/aiIdentityContract";
import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";

type ContractRow = Readonly<{
  roleKey: string;
  perspective: OverlayAiPerspectiveId;
  provider: AiIdentityContract["provider"];
  capabilities: readonly OverlayAiCapabilityId[];
  knowledgeScopes: readonly OverlayKnowledgeScopeId[];
}>;

const ROWS: readonly ContractRow[] = [
  {
    roleKey: "planner",
    perspective: "planning",
    provider: "openai",
    capabilities: ["llm_chat", "slot_orchestration"],
    knowledgeScopes: ["platform_catalog"],
  },
  {
    roleKey: "service-designer",
    perspective: "analysis",
    provider: "openai",
    capabilities: ["llm_chat", "slot_orchestration"],
    knowledgeScopes: ["project_pack", "runtime_recommendation"],
  },
  {
    roleKey: "domain-expert",
    perspective: "analysis",
    provider: "openai",
    capabilities: ["llm_chat", "knowledge_retrieval"],
    knowledgeScopes: ["runtime_recommendation", "project_pack"],
  },
  {
    roleKey: "solution-architect",
    perspective: "architecture",
    provider: "openai",
    capabilities: ["llm_chat", "llm_json_object"],
    knowledgeScopes: ["project_pack", "platform_catalog"],
  },
  {
    roleKey: "ui-designer",
    perspective: "design",
    provider: "openai",
    capabilities: ["llm_chat", "knowledge_retrieval"],
    knowledgeScopes: ["runtime_recommendation", "platform_catalog"],
  },
  {
    roleKey: "security-reviewer",
    perspective: "security",
    provider: "openai",
    capabilities: ["llm_chat", "llm_json_object"],
    knowledgeScopes: ["platform_catalog", "project_pack"],
  },
  {
    roleKey: "task-reviewer",
    perspective: "review",
    provider: "openai",
    capabilities: ["llm_chat", "llm_json_object"],
    knowledgeScopes: ["project_pack"],
  },
  {
    roleKey: "prototype_build",
    perspective: "implementation",
    provider: "cursor",
    capabilities: ["code_agent_cursor", "llm_chat"],
    knowledgeScopes: ["project_pack", "runtime_recommendation"],
  },
  {
    roleKey: "quality-reviewer",
    perspective: "review",
    provider: "openai",
    capabilities: ["llm_chat", "llm_json_object"],
    knowledgeScopes: ["project_pack"],
  },
  {
    roleKey: "spec-reviewer",
    perspective: "planning",
    provider: "openai",
    capabilities: ["llm_chat", "llm_json_object"],
    knowledgeScopes: ["project_pack", "platform_catalog"],
  },
  {
    roleKey: "scm-manager",
    perspective: "governance",
    provider: "openai",
    capabilities: ["llm_chat"],
    knowledgeScopes: ["platform_catalog"],
  },
  {
    roleKey: "reviewer",
    perspective: "review",
    provider: "openai",
    capabilities: ["llm_chat", "llm_json_object"],
    knowledgeScopes: ["project_pack"],
  },
] as const;

const ROW_BY_KEY = new Map<string, ContractRow>(ROWS.map((r) => [r.roleKey, r]));

/** SingleChat owner / planner-route 외부 역할 → 계약 roleKey */
const INTERNAL_OWNER_TO_ROLE_KEY: Readonly<Record<string, string>> = {
  planner: "planner",
  analyst: "service-designer",
  architect: "solution-architect",
  designer: "ui-designer",
  security: "security-reviewer",
  reviewer: "task-reviewer",
};

function normalizeRoleKey(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!s) return null;
  return s;
}

function resolveContractKey(raw: string | null | undefined): string | null {
  const n = normalizeRoleKey(raw);
  if (!n) return null;
  if (ROW_BY_KEY.has(n)) return n;
  if (n === "prototype-build") return "prototype_build";
  const mapped = INTERNAL_OWNER_TO_ROLE_KEY[n];
  if (mapped && ROW_BY_KEY.has(mapped)) return mapped;
  return null;
}

export function resolveAiIdentityContract(roleKey: string | null | undefined): AiIdentityContract | null {
  const key = resolveContractKey(roleKey);
  if (!key) return null;
  const row = ROW_BY_KEY.get(key);
  if (!row) return null;
  return {
    roleKey: row.roleKey,
    perspective: row.perspective,
    capabilities: [...row.capabilities],
    provider: row.provider,
    memoryScopes: resolveDefaultMemoryScopesForRole(row.roleKey),
    knowledgeScopes: [...row.knowledgeScopes],
  };
}

export function canUseCursorByIdentity(identity: AiIdentityContract | null): boolean {
  if (!identity) return false;
  return identity.capabilities.includes("code_agent_cursor") || identity.provider === "cursor";
}

export function resolveDefaultMemoryScopesForRole(roleKey: string | null | undefined): readonly MemoryScope[] {
  const key = resolveContractKey(roleKey) ?? normalizeRoleKey(roleKey);
  if (!key) return ["project", "session"];
  if (key === "prototype_build") return ["project", "working", "session"];
  return ["project", "session"];
}

export function resolveDefaultKnowledgeScopesForRole(roleKey: string | null | undefined): readonly OverlayKnowledgeScopeId[] {
  const key = resolveContractKey(roleKey);
  if (!key) return ["runtime_recommendation"];
  return [...(ROW_BY_KEY.get(key)?.knowledgeScopes ?? ["runtime_recommendation"])];
}
