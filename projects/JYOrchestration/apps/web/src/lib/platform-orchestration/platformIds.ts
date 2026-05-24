import { randomUUID } from "node:crypto";

/** Stable id prefix for platform orchestration entities (tests may stub). */
export function newPlatformOrchestrationId(prefix: string): string {
  const slug = randomUUID().replace(/-/g, "").slice(0, 20);
  return `${prefix}_${slug}`;
}

export function platformOrchestrationNowIso(): string {
  return new Date().toISOString();
}
