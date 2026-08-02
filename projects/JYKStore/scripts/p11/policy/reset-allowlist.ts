/** Canonical post-reset accounts (passwordless email auth). */
export const P11_CANONICAL_ACCOUNTS = [
  {
    email: "admin@jyk.local",
    name: "JYKStore Admin",
    accountRole: "ADMIN" as const,
  },
  {
    email: "provider@jyk.local",
    name: "JYKStore Provider",
    accountRole: "PROVIDER" as const,
  },
  {
    email: "user@jyk.local",
    name: "JYKStore User",
    accountRole: "USER" as const,
  },
] as const;

export const KEEP_EMAILS = new Set(
  P11_CANONICAL_ACCOUNTS.map((a) => a.email.toLowerCase()),
);

export const CONFIRM_TOKEN = "JYKSTORE_CLEAN_RESET";
