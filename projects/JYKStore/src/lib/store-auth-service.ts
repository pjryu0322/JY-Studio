import { prisma } from "@/lib/prisma";
import {
  isAdminEmailAllowlisted,
  parseAccountRole,
  parseSelectableAccountRole,
  type AccountRole,
  type SelectableAccountRole,
} from "@/lib/account-role";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StoreAuthMode = "login" | "register";

export type StoreLoginInput = {
  email: string;
  displayName: string;
  mode?: StoreAuthMode;
  /** Applied on register. */
  intendedRole?: SelectableAccountRole;
};

export type StoreLoginValidationError =
  | "EMAIL_REQUIRED"
  | "EMAIL_INVALID"
  | "DISPLAY_NAME_REQUIRED"
  | "USER_NOT_FOUND"
  | "USER_ALREADY_EXISTS";

export function validateStoreLoginInput(
  input: StoreLoginInput,
  options?: { requireDisplayName?: boolean },
): StoreLoginValidationError | null {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!email) return "EMAIL_REQUIRED";
  if (!EMAIL_PATTERN.test(email)) return "EMAIL_INVALID";
  if (options?.requireDisplayName !== false) {
    if (!displayName || displayName.length < 2 || displayName.length > 80) {
      return "DISPLAY_NAME_REQUIRED";
    }
  }
  return null;
}

function resolveStoredAccountRole(
  email: string,
  existingRole: string | null | undefined,
  intendedRole?: SelectableAccountRole,
): AccountRole {
  if (isAdminEmailAllowlisted(email) || parseAccountRole(existingRole) === "ADMIN") {
    return "ADMIN";
  }
  if (intendedRole) {
    return parseSelectableAccountRole(intendedRole);
  }
  return parseAccountRole(existingRole);
}

function toUserResult(user: {
  id: string;
  email: string | null;
  name: string | null;
  accountRole: string;
}, fallbackEmail: string, fallbackName: string) {
  return {
    user: {
      id: user.id,
      email: user.email ?? fallbackEmail,
      name: user.name ?? fallbackName,
      accountRole: parseAccountRole(user.accountRole),
    },
  };
}

/** Existing accounts only. */
export async function loginStoreUser(input: StoreLoginInput) {
  const validation = validateStoreLoginInput(input, { requireDisplayName: false });
  if (validation) {
    return { error: validation };
  }

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    return { error: "USER_NOT_FOUND" as const };
  }

  const accountRole = resolveStoredAccountRole(email, existing.accountRole);
  const name = displayName.length >= 2 ? displayName : existing.name?.trim() || email.split("@")[0] || "User";

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name,
      accountRole,
    },
  });

  return toUserResult(user, email, name);
}

/** New accounts only. */
export async function registerStoreUser(input: StoreLoginInput) {
  const validation = validateStoreLoginInput(input, { requireDisplayName: true });
  if (validation) {
    return { error: validation };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.displayName.trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "USER_ALREADY_EXISTS" as const };
  }

  const intendedRole = parseSelectableAccountRole(input.intendedRole);
  const accountRole = resolveStoredAccountRole(email, null, intendedRole);
  const user = await prisma.user.create({
    data: { email, name, accountRole },
  });

  return toUserResult(user, email, name);
}

/** @deprecated Prefer loginStoreUser / registerStoreUser. */
export async function loginOrCreateStoreUser(input: StoreLoginInput) {
  const mode = input.mode === "register" ? "register" : input.mode === "login" ? "login" : null;
  if (mode === "register") return registerStoreUser(input);
  if (mode === "login") return loginStoreUser(input);

  const validation = validateStoreLoginInput(input);
  if (validation) {
    return { error: validation };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.displayName.trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  const accountRole = resolveStoredAccountRole(email, existing?.accountRole);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, accountRole },
    update: { name, accountRole },
  });
  return toUserResult(user, email, name);
}

export async function getStoreUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountRole: parseAccountRole(user.accountRole),
  };
}

export async function grantAdminAccountRole(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { accountRole: "ADMIN" },
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    accountRole: parseAccountRole(user.accountRole),
  };
}
