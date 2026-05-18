/**
 * H20.5~H40 — read-only orchestration chain invariant 검증 helper(테스트·진단용, enforcement 없음).
 */

import { RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS } from "./runtimeForbiddenProofFlags";
import { RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED } from "./runtimeReadOnlyActualFlags";

const RUNTIME_ACTUAL_DISABLED_KEYS = Object.keys(
  RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED
) as (keyof typeof RUNTIME_READ_ONLY_ORCHESTRATION_ACTUAL_FLAGS_DISABLED)[];

export function assertRuntimeActualFlagsDisabled(
  value: Record<string, unknown>,
  options?: Readonly<{ allowMissing?: boolean }>
): readonly string[] {
  const allowMissing = options?.allowMissing ?? false;
  const violations: string[] = [];
  for (const key of RUNTIME_ACTUAL_DISABLED_KEYS) {
    if (!(key in value)) {
      if (!allowMissing) {
        violations.push(`${key} missing`);
      }
      continue;
    }
    if (value[key] !== false) {
      violations.push(`${key} must be false`);
    }
  }
  return violations;
}

export function prefixRuntimeInvariantViolations(
  reportPrefix: string,
  violations: readonly string[]
): readonly string[] {
  return violations.map((violation) => `${reportPrefix}.${violation}`);
}

export function assertRuntimeForbiddenFlagsTrue(
  value: Record<string, unknown>,
  options?: Readonly<{ allowMissing?: boolean }>
): readonly string[] {
  const allowMissing = options?.allowMissing ?? false;
  const violations: string[] = [];
  for (const key of RUNTIME_ORCHESTRATION_FORBIDDEN_PROOF_REQUIRED_KEYS) {
    if (!(key in value)) {
      if (!allowMissing) {
        violations.push(`${key} missing`);
      }
      continue;
    }
    if (value[key] !== true) {
      violations.push(`${key} must be true`);
    }
  }
  return violations;
}
