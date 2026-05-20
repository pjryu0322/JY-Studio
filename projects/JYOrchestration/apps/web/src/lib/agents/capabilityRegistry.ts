import type { CapabilityDefinition } from "@/lib/agents/capabilityDefinitionTypes";
import { DEFAULT_CAPABILITIES } from "@/lib/agents/defaultCapabilities";

const byId = new Map<string, CapabilityDefinition>(
  DEFAULT_CAPABILITIES.map((c) => [c.id, c]),
);

export function listCapabilities(enabledOnly = true): readonly CapabilityDefinition[] {
  const all = [...byId.values()];
  return enabledOnly ? all.filter((c) => c.enabled) : all;
}

export function getCapabilityById(id: string): CapabilityDefinition | undefined {
  return byId.get(id);
}

export function hasCapability(id: string): boolean {
  return byId.has(id);
}
