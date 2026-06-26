import { createHash } from "crypto";

export type OpaqueUserMemoryActionPrefix = "mem" | "src";

export function opaqueUserMemoryActionId(prefix: OpaqueUserMemoryActionPrefix, scopeKey: string): string {
  const normalized = scopeKey.trim();
  if (!normalized) return "";
  const hash = createHash("sha256").update(`${prefix}:${normalized}`).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

export function opaqueMemoryItemActionId(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly rawItemId: string;
}): string {
  const raw = input.rawItemId.trim();
  if (!raw) return "";
  return opaqueUserMemoryActionId(
    "mem",
    `${input.userId.trim()}|${input.targetProjectId.trim()}|${raw}`,
  );
}

export function opaqueSourceProjectActionId(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly rawSourceProjectId: string;
}): string {
  const raw = input.rawSourceProjectId.trim();
  if (!raw) return "";
  return opaqueUserMemoryActionId(
    "src",
    `${input.userId.trim()}|${input.targetProjectId.trim()}|${raw}`,
  );
}
