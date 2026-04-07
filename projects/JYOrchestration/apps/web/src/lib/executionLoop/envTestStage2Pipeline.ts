/**
 * Stage2(ENV_TEST_STAGE2) 전용 파이프라인 — REAL entry file.
 *
 * The actual orchestration lives in `executionLoop/stage2/*`.
 * This module is the public entry point and is allowed to add Stage2-only glue.
 *
 * STAGE1 PROTECTION: Stage1(`ENV_TEST`) must only import `envTestStage1Pipeline`.
 */
import type { EnvTestReflectionNotConfirmedBypassResult } from "./stage2/stage2BranchReflection";
import type { EnvTestGithubFinalizeReturn } from "./envTestGithubFinalize";

export {
  runEnvTestAfterGithubPushConfirmed,
} from "./stage2/stage2PrFlow";

export {
  runEnvTestReflectionConfirmedPipeline,
  runEnvTestReflectionNotConfirmedGithubBypass,
} from "./stage2/stage2BranchReflection";

export type { EnvTestReflectionNotConfirmedBypassResult };

/**
 * Optional Stage2 orchestrator (single entry) to reduce Stage2 call-site branching.
 * Callers may still call the specific pipeline functions directly.
 */
export async function runStage2EnvTestPipeline(input:
  | ({ kind: "reflection_confirmed" } & Parameters<typeof import("./stage2/stage2BranchReflection").runEnvTestReflectionConfirmedPipeline>[0])
  | ({ kind: "reflection_bypass" } & Parameters<typeof import("./stage2/stage2BranchReflection").runEnvTestReflectionNotConfirmedGithubBypass>[0])
): Promise<EnvTestGithubFinalizeReturn | EnvTestReflectionNotConfirmedBypassResult> {
  if (input.kind === "reflection_confirmed") {
    const { kind: _k, ...rest } = input as any;
    return await import("./stage2/stage2BranchReflection").then((m) => m.runEnvTestReflectionConfirmedPipeline(rest));
  }
  const { kind: _k, ...rest } = input as any;
  return await import("./stage2/stage2BranchReflection").then((m) => m.runEnvTestReflectionNotConfirmedGithubBypass(rest));
}
