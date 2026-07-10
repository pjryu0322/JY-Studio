import type { AccountRole } from "@/lib/account-role";
import type { AdminAccountListItem } from "@/lib/admin-accounts-service";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string | { message?: string }; message?: string };
    if (typeof body.error === "string") return body.error;
    if (body.error && typeof body.error === "object" && body.error.message) {
      return body.error.message;
    }
    return body.message ?? `요청에 실패했습니다. (${res.status})`;
  } catch {
    return `요청에 실패했습니다. (${res.status})`;
  }
}

export async function fetchAdminAccountsApi(): Promise<{ items: AdminAccountListItem[] }> {
  const response = await fetch("/api/v1/admin/accounts", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as { items: AdminAccountListItem[] };
}

export async function updateAdminAccountRoleApi(
  userId: string,
  accountRole: AccountRole,
): Promise<{ account: AdminAccountListItem }> {
  const response = await fetch(`/api/v1/admin/accounts/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountRole }),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as { account: AdminAccountListItem };
}
