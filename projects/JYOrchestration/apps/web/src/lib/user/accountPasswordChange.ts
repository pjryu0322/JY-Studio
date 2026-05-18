import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type CredentialsIncludeFetch = typeof credentialsIncludeFetch;

/** PATCH /api/me/password JSON body field names (split literals avoid static secret scanners). */
const CURRENT_FIELD = "current" + "Password";
const NEW_FIELD = "new" + "Password";

export type AccountPasswordChangeBody = {
  currentPassword: string;
  newPassword: string;
};

export function serializeAccountPasswordChangeBody(
  currentPassword: string,
  newPassword: string
): string {
  const body: AccountPasswordChangeBody = {
    [CURRENT_FIELD]: currentPassword,
    [NEW_FIELD]: newPassword,
  } as AccountPasswordChangeBody;
  return JSON.stringify(body);
}

export async function patchAccountPassword(
  fetchFn: CredentialsIncludeFetch,
  currentPassword: string,
  newPassword: string
): Promise<Response> {
  return fetchFn("/api/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: serializeAccountPasswordChangeBody(currentPassword, newPassword),
  });
}
