/**
 * Governance policy registry — lookup by check id (no runtime evaluation).
 */

import { DEFAULT_GOVERNANCE_POLICIES } from "@/lib/agents/defaultGovernancePolicies";
import type { GovernancePolicyDescriptor } from "@/lib/agents/governancePrecheckDryRunTypes";

const byId = new Map<string, GovernancePolicyDescriptor>(
  DEFAULT_GOVERNANCE_POLICIES.map((p) => [p.id, p]),
);

const byCheck = new Map<string, GovernancePolicyDescriptor[]>();
for (const policy of DEFAULT_GOVERNANCE_POLICIES) {
  for (const check of policy.appliesToChecks) {
    const list = byCheck.get(check) ?? [];
    list.push(policy);
    byCheck.set(check, list);
  }
}

export function listGovernancePolicies(): readonly GovernancePolicyDescriptor[] {
  return [...byId.values()];
}

export function getGovernancePolicyById(policyId: string): GovernancePolicyDescriptor | undefined {
  return byId.get(policyId);
}

export function getGovernancePoliciesForCheck(check: string): readonly GovernancePolicyDescriptor[] {
  const key = String(check ?? "").trim();
  if (!key) return [];
  return byCheck.get(key) ?? [];
}

export function getGovernancePoliciesForChecks(
  checks: readonly string[],
): readonly GovernancePolicyDescriptor[] {
  const seen = new Set<string>();
  const out: GovernancePolicyDescriptor[] = [];
  for (const check of checks) {
    for (const policy of getGovernancePoliciesForCheck(check)) {
      if (seen.has(policy.id)) continue;
      seen.add(policy.id);
      out.push(policy);
    }
  }
  return out;
}
