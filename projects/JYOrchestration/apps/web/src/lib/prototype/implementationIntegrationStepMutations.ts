import type { ImplementationIntegrationStepKindV1, ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";

export function mapIntegrationStepByKind(
  steps: readonly ImplementationIntegrationStepV1[],
  kind: ImplementationIntegrationStepKindV1,
  mapper: (step: ImplementationIntegrationStepV1) => ImplementationIntegrationStepV1,
): ImplementationIntegrationStepV1[] {
  return steps.map((step) => (step.kind === kind ? mapper(step) : step));
}

export function findIntegrationStep(
  steps: readonly ImplementationIntegrationStepV1[],
  kind: ImplementationIntegrationStepKindV1,
): ImplementationIntegrationStepV1 | null {
  return steps.find((s) => s.kind === kind) ?? null;
}

export function isIntegrationStepCompleted(
  steps: readonly ImplementationIntegrationStepV1[],
  kind: ImplementationIntegrationStepKindV1,
): boolean {
  return findIntegrationStep(steps, kind)?.status === "completed";
}
