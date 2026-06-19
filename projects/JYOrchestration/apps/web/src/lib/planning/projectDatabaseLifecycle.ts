export type ProjectDatabaseLifecycleStatus =
  | "NOT_REQUIRED"
  | "PLANNED"
  | "CREATING"
  | "CREATED"
  | "FAILED"
  | "DELETING"
  | "DELETED";

export function readProjectDatabaseLifecycleStatus(raw: unknown): ProjectDatabaseLifecycleStatus | null {
  const s = String(raw ?? "").trim();
  if (
    s === "NOT_REQUIRED" ||
    s === "PLANNED" ||
    s === "CREATING" ||
    s === "CREATED" ||
    s === "FAILED" ||
    s === "DELETING" ||
    s === "DELETED"
  ) {
    return s;
  }
  return null;
}
