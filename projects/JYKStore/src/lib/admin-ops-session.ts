import { ADMIN_OPS_TOKEN_HEADER } from "@/lib/admin-auth";

export const ADMIN_SESSION_STORAGE_KEY = "jykstore_admin_ops_session";

export type AdminSessionRecord = {
  verifiedAt: string;
  /** Session-only; never written to localStorage. */
  token?: string;
};

export type StringStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function loadAdminSession(storage: StringStorage): AdminSessionRecord | null {
  const raw = storage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminSessionRecord;
    if (!parsed.verifiedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAdminSession(storage: StringStorage, input: { token?: string }) {
  const record: AdminSessionRecord = {
    verifiedAt: new Date().toISOString(),
    ...(input.token?.trim() ? { token: input.token.trim() } : {}),
  };
  storage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearAdminSession(storage: StringStorage) {
  storage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

export function isAdminSessionVerified(storage: StringStorage): boolean {
  return loadAdminSession(storage) !== null;
}

export async function verifyAdminOpsToken(token: string | undefined): Promise<boolean> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const trimmed = token?.trim();
  if (trimmed) {
    headers[ADMIN_OPS_TOKEN_HEADER] = trimmed;
  }
  const response = await fetch("/api/v1/admin/ops/verify", {
    method: "POST",
    headers,
  });
  return response.ok;
}

export async function confirmAdminSession(storage: StringStorage): Promise<boolean> {
  const session = loadAdminSession(storage);
  if (!session) return false;
  const ok = await verifyAdminOpsToken(session.token);
  if (!ok) {
    clearAdminSession(storage);
  }
  return ok;
}
