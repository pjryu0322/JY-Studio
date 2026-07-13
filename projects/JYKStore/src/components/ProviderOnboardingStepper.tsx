import type { ProviderOnboardingStep } from "@/lib/provider-onboarding-steps";
import { ProviderPackProgressStepper } from "@/components/ProviderPackProgressStepper";

/** @deprecated Prefer ProviderPackProgressStepper on Pack Detail. */
export function ProviderOnboardingStepper({
  steps,
}: {
  readonly steps: readonly ProviderOnboardingStep[];
}) {
  return <ProviderPackProgressStepper steps={steps} />;
}
