import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionUserWithPlatformFields = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly nickname: string | null;
  readonly avatarUrl: string | null;
  readonly globalRole: string;
  readonly createdAt: Date;
  readonly accountStatus: "ACTIVE" | "SUSPENDED";
  readonly planTier: string;
  readonly lastLoginAt: Date | null;
  readonly defaultOpenaiApiKeyMasked: string | null;
  readonly defaultOpenaiApiKey: string | null;
};

export function isPrismaUnknownFieldError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientValidationError && String(e.message).includes("Unknown field");
}

/** 스키마·DB 컬럼 미적용(옛 Prisma 클라이언트 또는 마이그레이션 전) 시 레거시 쿼리로 재시도 */
export function isPrismaPlatformUserColumnMismatch(e: unknown): boolean {
  if (isPrismaUnknownFieldError(e)) return true;
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022";
}

const legacySelect = {
  id: true,
  email: true,
  name: true,
  globalRole: true,
  createdAt: true,
  defaultOpenaiApiKeyMasked: true,
  defaultOpenaiApiKey: true,
} as const;

const profileSelect = {
  nickname: true,
  avatarUrl: true,
} as const;

const fullSelect = {
  ...legacySelect,
  ...profileSelect,
  accountStatus: true,
  planTier: true,
  lastLoginAt: true,
} as const;

/**
 * `pnpm db:generate` 전·DLL 잠금 등으로 Prisma 클라이언트가 스키마보다 옛날일 때
 * 레거시 select로 폴백한다(DB 마이그레이션 전에는 기본값으로 채움).
 */
export async function findUserForSessionOrMe(userId: string): Promise<SessionUserWithPlatformFields | null> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: fullSelect,
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      nickname: u.nickname ?? null,
      avatarUrl: u.avatarUrl ?? null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      accountStatus: u.accountStatus,
      planTier: u.planTier,
      lastLoginAt: u.lastLoginAt,
      defaultOpenaiApiKeyMasked: u.defaultOpenaiApiKeyMasked,
      defaultOpenaiApiKey: u.defaultOpenaiApiKey,
    };
  } catch (e) {
    if (!isPrismaPlatformUserColumnMismatch(e)) throw e;
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: legacySelect,
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      nickname: null,
      avatarUrl: null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      accountStatus: "ACTIVE",
      planTier: "free",
      lastLoginAt: null,
      defaultOpenaiApiKeyMasked: u.defaultOpenaiApiKeyMasked,
      defaultOpenaiApiKey: u.defaultOpenaiApiKey,
    };
  }
}

export async function findUserForLogin(email: string): Promise<
  | (SessionUserWithPlatformFields & { readonly passwordHash: string })
  | null
> {
  const full = {
    ...fullSelect,
    passwordHash: true,
  } as const;
  try {
    const u = await prisma.user.findUnique({
      where: { email },
      select: full,
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      nickname: u.nickname ?? null,
      avatarUrl: u.avatarUrl ?? null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      accountStatus: u.accountStatus,
      planTier: u.planTier,
      lastLoginAt: u.lastLoginAt,
      defaultOpenaiApiKeyMasked: u.defaultOpenaiApiKeyMasked,
      defaultOpenaiApiKey: u.defaultOpenaiApiKey,
      passwordHash: u.passwordHash,
    };
  } catch (e) {
    if (!isPrismaPlatformUserColumnMismatch(e)) throw e;
    const u = await prisma.user.findUnique({
      where: { email },
      select: { ...legacySelect, passwordHash: true },
    });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      nickname: null,
      avatarUrl: null,
      globalRole: u.globalRole,
      createdAt: u.createdAt,
      accountStatus: "ACTIVE",
      planTier: "free",
      lastLoginAt: null,
      defaultOpenaiApiKeyMasked: u.defaultOpenaiApiKeyMasked,
      defaultOpenaiApiKey: u.defaultOpenaiApiKey,
      passwordHash: u.passwordHash,
    };
  }
}

export async function touchUserLastLogin(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (e) {
    if (isPrismaPlatformUserColumnMismatch(e)) return;
    throw e;
  }
}

/**
 * `User.avatarUrl` 컬럼·Prisma 클라이언트가 맞을 때만 조회.
 * 옛 클라이언트(`pnpm db:generate` 미실행)나 마이그레이션 전 DB면 `supported: false`.
 */
export async function getUserAvatarUrlForMutation(
  userId: string
): Promise<{ readonly supported: true; readonly url: string | null } | { readonly supported: false }> {
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    return { supported: true, url: row?.avatarUrl ?? null };
  } catch (e) {
    if (isPrismaPlatformUserColumnMismatch(e)) return { supported: false };
    throw e;
  }
}
