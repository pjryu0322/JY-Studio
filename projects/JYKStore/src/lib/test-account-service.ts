import { parseAccountRole, type AccountRole } from "@/lib/account-role";
import { accountRoleDisplayLabel } from "@/lib/account-menu";
import { prisma } from "@/lib/prisma";

export const TEST_ACCOUNT_LIST_LIMIT = 100;

export type TestAccountDto = {
  id: string;
  displayName: string;
  email: string;
  accountRole: AccountRole;
  roleLabel: string;
};

const ROLE_ORDER: Record<AccountRole, number> = {
  ADMIN: 0,
  PROVIDER: 1,
  USER: 2,
};

export function resolveTestAccountDisplayName(input: {
  name?: string | null;
  email: string;
}): string {
  const fromName = input.name?.trim();
  if (fromName) return fromName;
  const local = input.email.split("@")[0]?.trim();
  if (local) return local;
  return "사용자";
}

export function sortTestAccounts<T extends { accountRole: AccountRole; displayName: string; email: string }>(
  accounts: T[],
): T[] {
  return [...accounts].sort((a, b) => {
    const roleDiff = ROLE_ORDER[a.accountRole] - ROLE_ORDER[b.accountRole];
    if (roleDiff !== 0) return roleDiff;
    const nameDiff = a.displayName.localeCompare(b.displayName, "ko");
    if (nameDiff !== 0) return nameDiff;
    return a.email.localeCompare(b.email, "en");
  });
}

export function toTestAccountDto(row: {
  id: string;
  email: string | null;
  name: string | null;
  accountRole: string;
}): TestAccountDto | null {
  const email = row.email?.trim().toLowerCase() ?? "";
  if (!email) return null;
  const accountRole = parseAccountRole(row.accountRole);
  return {
    id: row.id,
    email,
    displayName: resolveTestAccountDisplayName({ name: row.name, email }),
    accountRole,
    roleLabel: accountRoleDisplayLabel(accountRole),
  };
}

/** Read-only listing of registered users for the development switcher. */
export async function listTestAccounts(): Promise<TestAccountDto[]> {
  const rows = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      accountRole: true,
    },
    take: TEST_ACCOUNT_LIST_LIMIT * 2,
  });

  const mapped = rows
    .map(toTestAccountDto)
    .filter((row): row is TestAccountDto => Boolean(row));

  return sortTestAccounts(mapped).slice(0, TEST_ACCOUNT_LIST_LIMIT);
}

export async function findTestAccountById(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      accountRole: true,
    },
  });
  if (!row?.email?.trim()) return null;
  return {
    id: row.id,
    email: row.email.trim().toLowerCase(),
    name: row.name,
    accountRole: parseAccountRole(row.accountRole),
  };
}
