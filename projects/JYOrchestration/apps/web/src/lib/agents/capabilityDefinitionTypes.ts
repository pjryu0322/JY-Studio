/**
 * Capability Registry — capability-centric model (not agent-owned).
 */

import type { AgentType } from "@/lib/agents/agentDefinitionTypes";
import type { ConnectorId } from "@/lib/agents/agentDefinitionTypes";

export type CapabilityCategory =
  | "planning"
  | "analysis"
  | "architecture"
  | "design"
  | "development"
  | "review"
  | "security"
  | "scm"
  | "governance"
  | "timeline"
  | "projection"
  | "knowledge"
  | "connector";

export interface CapabilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: CapabilityCategory;
  readonly description: string;
  readonly requiredInputs?: readonly string[];
  readonly producedOutputs?: readonly string[];
  readonly allowedAgentTypes?: readonly AgentType[];
  readonly requiredConnectors?: readonly ConnectorId[];
  readonly governanceChecks?: readonly string[];
  readonly enabled: boolean;
}
