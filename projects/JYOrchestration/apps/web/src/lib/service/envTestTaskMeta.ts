/**
 * Optional metadata for environment connection-test tasks, embedded in Task.description
 * (first line prefix). Keeps DB schema unchanged.
 */

export type EnvConnectionTestMergeMode = "skip" | "auto";

const META_PREFIX = "__JY_CONN_META__";

export function parseEnvTestMergeModeFromTaskDescription(description: string | null | undefined): EnvConnectionTestMergeMode {
  const first = String(description ?? "").split("\n")[0]?.trim() ?? "";
  if (!first.startsWith(META_PREFIX)) return "auto";
  try {
    const payload = JSON.parse(first.slice(META_PREFIX.length)) as { mergeMode?: string };
    if (payload.mergeMode === "skip") return "skip";
  } catch {
    /* ignore */
  }
  return "auto";
}

export function buildEnvTestTaskDescriptionWithMergeMode(
  baseDescription: string,
  mergeMode: EnvConnectionTestMergeMode
): string {
  const base = String(baseDescription ?? "").trim();
  if (mergeMode !== "skip") return base;
  return `${META_PREFIX}${JSON.stringify({ mergeMode: "skip" })}\n${base}`;
}
