import { AuditAction, Prisma, type ProviderProfile } from "@prisma/client";
import { parseAccountRole } from "@/lib/account-role";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";
import { toProviderProfileDto } from "@/lib/provider-profile-dto";

export type ProviderProfileUpsertInput = {
  displayName: string;
  description: string;
  websiteUrl?: string;
  contactEmail?: string;
};

export type ProfileValidationError =
  | "DISPLAY_NAME_REQUIRED"
  | "DISPLAY_NAME_LENGTH"
  | "DESCRIPTION_LENGTH"
  | "WEBSITE_URL_INVALID"
  | "CONTACT_EMAIL_INVALID";

const DEFAULT_DESCRIPTION = "제공자 계정으로 연결된 공개 프로필입니다.";

export function resolveProviderDisplayName(input: {
  displayName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  clientId?: string | null;
}): string {
  const fromProfile = input.displayName?.trim();
  if (fromProfile) return fromProfile;
  const fromUser = input.userName?.trim() || input.userEmail?.trim();
  if (fromUser) return fromUser;
  return input.clientId?.trim() || "제공자";
}

export function validateProviderProfileInput(
  input: ProviderProfileUpsertInput,
): ProfileValidationError | null {
  const displayName = input.displayName.trim();
  const description = input.description.trim();
  const websiteUrl = input.websiteUrl?.trim() ?? "";
  const contactEmail = input.contactEmail?.trim() ?? "";

  if (!displayName) return "DISPLAY_NAME_REQUIRED";
  if (displayName.length < 1 || displayName.length > 80) return "DISPLAY_NAME_LENGTH";
  if (description.length > 500) return "DESCRIPTION_LENGTH";
  if (websiteUrl) {
    try {
      const parsed = new URL(websiteUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "WEBSITE_URL_INVALID";
      }
    } catch {
      return "WEBSITE_URL_INVALID";
    }
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return "CONTACT_EMAIL_INVALID";
  }

  return null;
}

function canAutoCreateProviderProfile(accountRole: string | null | undefined): boolean {
  const role = parseAccountRole(accountRole);
  return role === "PROVIDER" || role === "ADMIN";
}

/** Links legacy clientId-only profiles on first login. Does not auto-create. */
export async function findProviderProfileForUser(userId: string, clientId?: string | null) {
  const byUser = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  if (byUser) return byUser;

  if (!clientId) return null;

  const legacy = await prisma.providerProfile.findUnique({
    where: { clientId },
  });
  if (!legacy || legacy.userId) return null;

  return prisma.providerProfile.update({
    where: { id: legacy.id },
    data: { userId },
  });
}

/**
 * Ensures a ProviderProfile exists for PROVIDER/ADMIN accounts.
 * USER accounts are not auto-created.
 *
 * clientId is browser-scoped and may already belong to another user after account
 * switching. Never steal another user's clientId binding; create without clientId
 * when the cookie is already claimed. Concurrent session requests may race on
 * create — recover by re-reading after P2002.
 */
export async function ensureProviderProfileForAccount(input: {
  userId: string;
  clientId: string;
}): Promise<
  | { ok: true; profile: ProviderProfile }
  | { ok: false; error: "USER_NOT_FOUND" | "NOT_PROVIDER" }
> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true, accountRole: true },
  });

  if (!user) {
    return { ok: false, error: "USER_NOT_FOUND" };
  }

  // Existing profiles win even when stored accountRole is still USER
  // (session/Provider Center already treat profile as provider access).
  const existing = await findProviderProfileForUser(input.userId, input.clientId);
  if (existing) {
    const needsClientId = !existing.clientId && input.clientId;
    const needsUserId = !existing.userId;
    if (needsClientId || needsUserId) {
      try {
        const updated = await prisma.providerProfile.update({
          where: { id: existing.id },
          data: {
            ...(needsUserId ? { userId: input.userId } : {}),
            ...(needsClientId ? { clientId: input.clientId } : {}),
          },
        });
        return { ok: true, profile: updated };
      } catch (error) {
        // clientId unique conflict — keep profile linked by userId only.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return { ok: true, profile: existing };
        }
        throw error;
      }
    }
    return { ok: true, profile: existing };
  }

  if (!canAutoCreateProviderProfile(user.accountRole)) {
    return { ok: false, error: "NOT_PROVIDER" };
  }

  const byClientId = input.clientId
    ? await prisma.providerProfile.findUnique({ where: { clientId: input.clientId } })
    : null;

  if (byClientId && (!byClientId.userId || byClientId.userId === input.userId)) {
    const updated = await prisma.providerProfile.update({
      where: { id: byClientId.id },
      data: { userId: input.userId },
    });
    return { ok: true, profile: updated };
  }

  // Cookie already bound to another account — do not steal; create user-scoped row.
  const clientIdForCreate =
    byClientId && byClientId.userId && byClientId.userId !== input.userId
      ? null
      : input.clientId;

  const displayName = resolveProviderDisplayName({
    userName: user.name,
    userEmail: user.email,
    clientId: input.clientId,
  });

  try {
    const profile = await prisma.providerProfile.create({
      data: {
        userId: input.userId,
        clientId: clientIdForCreate,
        displayName,
        description: DEFAULT_DESCRIPTION,
        contactEmail: user.email?.trim() || null,
        status: "ACTIVE",
      },
    });

    await recordProviderAudit({
      action: AuditAction.PROVIDER_PROFILE_UPSERT,
      entityType: "ProviderProfile",
      entityId: profile.id,
      metadata: {
        userId: input.userId,
        clientId: input.clientId,
        action: "auto_ensure",
        clientIdBound: Boolean(clientIdForCreate),
      },
    });

    return { ok: true, profile };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const recovered =
        (await findProviderProfileForUser(input.userId, input.clientId)) ??
        (input.clientId
          ? await prisma.providerProfile.findUnique({ where: { clientId: input.clientId } })
          : null);
      if (recovered && (!recovered.userId || recovered.userId === input.userId)) {
        if (!recovered.userId) {
          const linked = await prisma.providerProfile.update({
            where: { id: recovered.id },
            data: { userId: input.userId },
          });
          return { ok: true, profile: linked };
        }
        return { ok: true, profile: recovered };
      }
      // Last resort: user-only profile without contested clientId.
      const fallback = await prisma.providerProfile.create({
        data: {
          userId: input.userId,
          clientId: null,
          displayName,
          description: DEFAULT_DESCRIPTION,
          contactEmail: user.email?.trim() || null,
          status: "ACTIVE",
        },
      });
      return { ok: true, profile: fallback };
    }
    throw error;
  }
}

export async function findOrEnsureProviderProfileForUser(userId: string, clientId: string) {
  const result = await ensureProviderProfileForAccount({ userId, clientId });
  if (!result.ok) return null;
  return result.profile;
}

export async function getProviderProfileByUserId(userId: string) {
  const profile = await prisma.providerProfile.findFirst({
    where: { userId },
  });
  return profile ? toProviderProfileDto(profile) : null;
}

export async function getProviderProfileByClientId(clientId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  return profile ? toProviderProfileDto(profile) : null;
}

export async function upsertProviderProfileForUser(
  userId: string,
  clientId: string,
  input: ProviderProfileUpsertInput,
) {
  const validation = validateProviderProfileInput(input);
  if (validation) {
    return { error: validation };
  }

  const displayName = input.displayName.trim();
  const description = input.description.trim() || DEFAULT_DESCRIPTION;
  const websiteUrl = input.websiteUrl?.trim() || null;
  const contactEmail = input.contactEmail?.trim() || null;

  const ensured = await ensureProviderProfileForAccount({ userId, clientId });
  if (!ensured.ok) {
    return { error: ensured.error === "NOT_PROVIDER" ? ("NOT_PROVIDER" as const) : ("USER_NOT_FOUND" as const) };
  }

  const profile = await prisma.providerProfile.update({
    where: { id: ensured.profile.id },
    data: {
      displayName,
      description,
      websiteUrl,
      contactEmail,
      userId,
      clientId: ensured.profile.clientId ?? clientId,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PROFILE_UPSERT,
    entityType: "ProviderProfile",
    entityId: profile.id,
    metadata: { userId, clientId },
  });

  return { profile: toProviderProfileDto(profile) };
}

/** @deprecated Use upsertProviderProfileForUser after login. */
export async function upsertProviderProfileForClient(
  clientId: string,
  input: ProviderProfileUpsertInput,
) {
  const validation = validateProviderProfileInput(input);
  if (validation) {
    return { error: validation };
  }

  const displayName = input.displayName.trim();
  const description = input.description.trim() || DEFAULT_DESCRIPTION;
  const websiteUrl = input.websiteUrl?.trim() || null;
  const contactEmail = input.contactEmail?.trim() || null;

  const profile = await prisma.providerProfile.upsert({
    where: { clientId },
    create: {
      clientId,
      displayName,
      description,
      websiteUrl,
      contactEmail,
    },
    update: {
      displayName,
      description,
      websiteUrl,
      contactEmail,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PROFILE_UPSERT,
    entityType: "ProviderProfile",
    entityId: profile.id,
    metadata: { clientId },
  });

  return { profile: toProviderProfileDto(profile) };
}

export async function requireProviderProfileForUser(userId: string, clientId?: string | null) {
  if (!clientId) {
    return findProviderProfileForUser(userId, clientId);
  }
  return findOrEnsureProviderProfileForUser(userId, clientId);
}

/** @deprecated Use requireProviderProfileForUser */
export async function requireProviderProfileForClient(clientId: string) {
  const row = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  return row;
}
