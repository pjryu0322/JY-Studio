/** Browser-safe UUID for client + server (do not import node:crypto here). */
function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable id prefix for platform orchestration entities (tests may stub). */
export function newPlatformOrchestrationId(prefix: string): string {
  const slug = randomUuid().replace(/-/g, "").slice(0, 20);
  return `${prefix}_${slug}`;
}

export function platformOrchestrationNowIso(): string {
  return new Date().toISOString();
}
