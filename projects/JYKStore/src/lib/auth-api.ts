export type StoreAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type StoreAuthSessionResponse = {
  loggedIn: boolean;
  clientId?: string;
  user?: StoreAuthUser;
  providerProfile?: import("@/lib/provider-profile-dto").ProviderProfileDto | null;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `요청에 실패했습니다. (${res.status})`;
  } catch {
    return `요청에 실패했습니다. (${res.status})`;
  }
}

export async function fetchAuthSession(): Promise<StoreAuthSessionResponse> {
  const res = await fetch("/api/v1/auth/session", { method: "GET", credentials: "include" });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as StoreAuthSessionResponse;
}

export async function loginStoreAccount(input: { email: string; displayName: string }) {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as { user: StoreAuthUser };
}

export async function logoutStoreAccount() {
  const res = await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}
