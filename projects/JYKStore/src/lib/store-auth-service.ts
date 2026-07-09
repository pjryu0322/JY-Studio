import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StoreLoginInput = {
  email: string;
  displayName: string;
};

export type StoreLoginValidationError = "EMAIL_REQUIRED" | "EMAIL_INVALID" | "DISPLAY_NAME_REQUIRED";

export function validateStoreLoginInput(input: StoreLoginInput): StoreLoginValidationError | null {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!email) return "EMAIL_REQUIRED";
  if (!EMAIL_PATTERN.test(email)) return "EMAIL_INVALID";
  if (!displayName || displayName.length < 2 || displayName.length > 80) return "DISPLAY_NAME_REQUIRED";
  return null;
}

export async function loginOrCreateStoreUser(input: StoreLoginInput) {
  const validation = validateStoreLoginInput(input);
  if (validation) {
    return { error: validation };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.displayName.trim();

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name },
    update: { name },
  });

  return {
    user: {
      id: user.id,
      email: user.email ?? email,
      name: user.name ?? name,
    },
  };
}

export async function getStoreUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
