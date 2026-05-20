/**
 * Multi-agent authority — role-scoped allowed actions (no unauthorized mutation).
 */

import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export type AgentRole =
  | "orchestration-planner"
  | "orchestration-architect"
  | "orchestration-developer"
  | "system";

const ALLOWED_BY_ROLE: Readonly<Record<AgentRole, readonly QuickActionId[]>> = {
  "orchestration-planner": [
    "REVIEW_FLOW",
    "EDIT_FEATURES",
    "START_FEATURE_DETAIL",
    "DOCUMENT_FLOW",
    "NEXT_STAGE",
    "EDIT_STEPS",
    "ADD_ACTOR",
  ],
  "orchestration-architect": ["DEFINE_SCREEN", "DEFINE_API", "EDIT_FEATURES", "OPEN_CANVAS"],
  "orchestration-developer": [
    "GENERATE_DOCUMENT",
    "EXPORT_MARKDOWN",
    "EXPORT_PDF",
    "OPEN_ARTIFACT_HUB",
    "PARTIAL_EDIT",
    "DIRECT_INPUT",
  ],
  system: [],
};

export function allowedActionsForRole(role: string | undefined): readonly QuickActionId[] {
  const key = (role ?? "system") as AgentRole;
  return ALLOWED_BY_ROLE[key] ?? ALLOWED_BY_ROLE.system;
}

export function isActionAuthorizedForRole(input: {
  readonly role: string | undefined;
  readonly actionId: QuickActionId | null;
  /** System dispatch path bypasses role scope. */
  readonly actorId?: string;
}): boolean {
  if (!input.actionId) return true;
  if (input.actorId === "system" || input.role === "system") return true;
  const allowed = new Set(allowedActionsForRole(input.role));
  if (!allowed.size) return true;
  return allowed.has(input.actionId);
}

export function defaultAgentRoleForAction(actionId: QuickActionId | null): AgentRole {
  if (!actionId) return "orchestration-planner";
  if (["DEFINE_SCREEN", "DEFINE_API", "OPEN_CANVAS"].includes(actionId)) return "orchestration-architect";
  if (["GENERATE_DOCUMENT", "EXPORT_MARKDOWN", "EXPORT_PDF", "OPEN_ARTIFACT_HUB"].includes(actionId)) {
    return "orchestration-developer";
  }
  return "orchestration-planner";
}
