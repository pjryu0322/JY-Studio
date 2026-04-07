/**
 * Stage2-only helpers surface.
 *
 * Rule: Stage1 helpers MUST NOT import this module.
 * This file intentionally re-exports Stage2 internals and canonical progress phases.
 */
export * from "@/lib/executionLoop/stage2/stage2Internal";
export * from "@/lib/executionLoop/stage2/stage2CanonicalProgressPhases";