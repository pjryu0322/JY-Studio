export const IMPLEMENTATION_TOAST_DEDUPE_MS = 60_000;

export function buildImplementationToastDedupeKey(input: {
  readonly taskId?: string | null;
  readonly status?: string | null;
  readonly message: string;
}): string {
  return [
    String(input.taskId ?? "").trim(),
    String(input.status ?? "").trim(),
    input.message.trim(),
  ].join("|");
}

export function shouldSuppressDuplicateImplementationToast(input: {
  readonly key: string;
  readonly lastKeyRef: { current: string | null };
  readonly lastAtRef: { current: number };
  readonly nowMs?: number;
  readonly windowMs?: number;
}): boolean {
  const now = input.nowMs ?? Date.now();
  const windowMs = input.windowMs ?? IMPLEMENTATION_TOAST_DEDUPE_MS;
  if (input.lastKeyRef.current !== input.key) return false;
  return now - input.lastAtRef.current < windowMs;
}

export function recordImplementationToastDedupe(input: {
  readonly key: string;
  readonly lastKeyRef: { current: string | null };
  readonly lastAtRef: { current: number };
  readonly nowMs?: number;
}): void {
  input.lastKeyRef.current = input.key;
  input.lastAtRef.current = input.nowMs ?? Date.now();
}
