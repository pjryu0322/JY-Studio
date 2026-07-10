import { ROUTES } from "@/lib/routes";

export type AccountRole = "USER" | "PROVIDER" | "ADMIN";

/** Roles a user may choose at store account creation. */
export type SelectableAccountRole = "USER" | "PROVIDER" | "ADMIN";

export const ACCOUNT_ROLES = ["USER", "PROVIDER", "ADMIN"] as const;
export const SELECTABLE_ACCOUNT_ROLES = ["USER", "PROVIDER", "ADMIN"] as const;

export function parseAccountRole(value: string | null | undefined): AccountRole {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "PROVIDER") return "PROVIDER";
  return "USER";
}

export function parseSelectableAccountRole(value: string | null | undefined): SelectableAccountRole {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "ADMIN") return "ADMIN";
  if (normalized === "PROVIDER") return "PROVIDER";
  return "USER";
}

/** Default landing path after login / account creation by role. */
export function postAuthLandingPath(role: AccountRole): string {
  switch (parseAccountRole(role)) {
    case "ADMIN":
      return ROUTES.adminReviews;
    case "PROVIDER":
      return ROUTES.provider;
    default:
      return ROUTES.home;
  }
}

export function isAdminAccountRole(role: string | null | undefined): boolean {
  return parseAccountRole(role) === "ADMIN";
}

/** Comma-separated emails in JYKSTORE_ADMIN_EMAILS that receive ADMIN on login. */
export function getAdminEmailAllowlist(): string[] {
  const raw = process.env.JYKSTORE_ADMIN_EMAILS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmailAllowlisted(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return getAdminEmailAllowlist().includes(normalized);
}

export function resolveSessionAccountRole(input: {
  storedRole?: string | null;
  hasProviderProfile?: boolean;
}): AccountRole {
  if (isAdminAccountRole(input.storedRole)) return "ADMIN";
  if (input.hasProviderProfile || parseAccountRole(input.storedRole) === "PROVIDER") {
    return "PROVIDER";
  }
  return "USER";
}
