/**
 * Default knowledge pack metadata candidates derived from role bindings (read-only; no registry store).
 */

import { DEFAULT_ROLE_KNOWLEDGE_BINDINGS, listDefaultKnowledgePackIds } from "@/lib/agents/defaultRoleKnowledgeBindings";
import type { RoleKnowledgePackKind } from "@/lib/agents/roleKnowledgeBindingTypes";
import type {
  KnowledgePackMetadataCandidate,
  KnowledgePackMetadataCategory,
  KnowledgePackMetadataSourceType,
} from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

const PACK_VERSION = "v0.1.0";

const KIND_CATEGORY: Record<RoleKnowledgePackKind, KnowledgePackMetadataCategory> = {
  development_standard: "development",
  security_standard: "security",
  review_standard: "review",
  architecture_standard: "platform",
  planning_standard: "platform",
  project_context: "project",
  connector_policy: "platform",
  cursor_execution_policy: "platform",
  governance_policy: "platform",
};

const KIND_SOURCE: Record<RoleKnowledgePackKind, KnowledgePackMetadataSourceType> = {
  development_standard: "standard",
  security_standard: "standard",
  review_standard: "standard",
  architecture_standard: "standard",
  planning_standard: "guide",
  project_context: "document",
  connector_policy: "policy",
  cursor_execution_policy: "policy",
  governance_policy: "policy",
};

const KIND_TITLE: Record<RoleKnowledgePackKind, string> = {
  development_standard: "Development Standard",
  security_standard: "Security Standard",
  review_standard: "Review Standard",
  architecture_standard: "Architecture Standard",
  planning_standard: "Planning Standard",
  project_context: "Project Context",
  connector_policy: "Connector Policy",
  cursor_execution_policy: "Cursor Execution Policy",
  governance_policy: "Governance Policy",
};

function kindForPackId(packId: string): RoleKnowledgePackKind | undefined {
  for (const bindings of Object.values(DEFAULT_ROLE_KNOWLEDGE_BINDINGS)) {
    const match = bindings.find((b) => b.knowledgePackId === packId);
    if (match) {
      return match.knowledgePackKind;
    }
  }
  return undefined;
}

function rolesForPackId(packId: string): { readonly required: string[]; readonly optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];
  for (const [agentType, bindings] of Object.entries(DEFAULT_ROLE_KNOWLEDGE_BINDINGS)) {
    for (const binding of bindings) {
      if (binding.knowledgePackId !== packId) {
        continue;
      }
      if (binding.required) {
        required.push(agentType);
      } else {
        optional.push(agentType);
      }
    }
  }
  return {
    required: [...new Set(required)].sort((a, b) => a.localeCompare(b)),
    optional: [...new Set(optional)].sort((a, b) => a.localeCompare(b)),
  };
}

/** Build deterministic default metadata candidates from the role binding registry. */
export function buildDefaultKnowledgePackMetadataCandidates(): readonly KnowledgePackMetadataCandidate[] {
  return listDefaultKnowledgePackIds()
    .map((knowledgePackId) => {
      const kind = kindForPackId(knowledgePackId);
      const roles = rolesForPackId(knowledgePackId);
      const intendedAgentTypes = [...new Set([...roles.required, ...roles.optional])].sort((a, b) =>
        a.localeCompare(b),
      );
      const category = kind ? KIND_CATEGORY[kind] : "platform";
      const sourceType = kind ? KIND_SOURCE[kind] : "unknown";
      const title = kind ? KIND_TITLE[kind] : knowledgePackId;

      return {
        knowledgePackId,
        title,
        version: PACK_VERSION,
        category,
        intendedAgentTypes,
        sourceType,
        status: "candidate" as const,
        summary: `${title} metadata candidate for role knowledge foundation`,
        requiredForRoles: roles.required,
        optionalForRoles: roles.optional,
      };
    })
    .sort((a, b) => a.knowledgePackId.localeCompare(b.knowledgePackId));
}
