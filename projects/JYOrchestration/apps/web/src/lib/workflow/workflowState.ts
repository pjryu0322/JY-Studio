export type WorkflowRouteState<T> =
  | { kind: "not_found"; id: string }
  | { kind: "found"; id: string; data: T };

export function routeState<T>(id: string, data: T | null): WorkflowRouteState<T> {
  return data ? { kind: "found", id, data } : { kind: "not_found", id };
}

export type WorkflowContentState<T> =
  | { kind: "empty"; reason: string }
  | { kind: "ready"; data: T };

export function contentState<T>(data: T | null | undefined, emptyReason: string): WorkflowContentState<T> {
  if (data == null) return { kind: "empty", reason: emptyReason };
  return { kind: "ready", data };
}

export function listState<T>(items: T[], emptyReason: string): WorkflowContentState<T[]> {
  if (!Array.isArray(items) || items.length === 0) return { kind: "empty", reason: emptyReason };
  return { kind: "ready", data: items };
}

