import type { AccountRole } from "@/lib/account-role";
import type { StoreAuthUser } from "@/lib/auth-api";
import type { TestAccountDto } from "@/lib/test-account-service";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `요청에 실패했습니다. (${res.status})`;
  } catch {
    return `요청에 실패했습니다. (${res.status})`;
  }
}

export async function fetchTestAccounts(): Promise<{ accounts: TestAccountDto[] }> {
  const res = await fetch("/api/v1/dev/test-accounts", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 404) {
    return { accounts: [] };
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as { accounts: TestAccountDto[] };
}

export async function loginWithTestAccount(userId: string): Promise<{
  user: StoreAuthUser;
  accountRole: AccountRole;
  testLogin: true;
}> {
  const res = await fetch("/api/v1/dev/test-accounts/login", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as {
    user: StoreAuthUser;
    accountRole: AccountRole;
    testLogin: true;
  };
}
