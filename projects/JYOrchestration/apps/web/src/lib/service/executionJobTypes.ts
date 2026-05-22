/**
 * Execution job type taxonomy and internal non-executable types.
 */

/** Holder jobs for runtime timeline persistence — never claimed by workers. */
export const INTERNAL_NON_EXECUTABLE_JOB_TYPES = ["runtime-timeline"] as const;

export type InternalNonExecutableJobType = (typeof INTERNAL_NON_EXECUTABLE_JOB_TYPES)[number];

export function isExecutableQueueJobType(type: string): boolean {
  return !(INTERNAL_NON_EXECUTABLE_JOB_TYPES as readonly string[]).includes(type);
}
