import type { NextRequest } from "next/server";
import { MOCK_CURRENT_USER_ID } from "@/lib/rbac/constants";

const MOCK_USER_HEADER = "x-mock-user-id";

/**
 * Identifies the caller for RBAC. Header overrides default mock user (integration / manual tests).
 */
export function getCurrentUserIdFromRequest(request: Request | NextRequest): string {
  const raw = request.headers.get(MOCK_USER_HEADER)?.trim();
  if (raw) {
    return raw;
  }
  return MOCK_CURRENT_USER_ID;
}

/** Same as {@link getCurrentUserIdFromRequest} without a request (e.g. background jobs). */
export function getCurrentUserId(): string {
  return MOCK_CURRENT_USER_ID;
}

export function mockUserIdHeaderName(): typeof MOCK_USER_HEADER {
  return MOCK_USER_HEADER;
}

export function mockAuthHeaders(): Record<string, string> {
  return { [MOCK_USER_HEADER]: MOCK_CURRENT_USER_ID };
}
