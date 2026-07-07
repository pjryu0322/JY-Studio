import { AuditAction } from "@prisma/client";
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
  | "DESCRIPTION_REQUIRED"
  | "DESCRIPTION_LENGTH";

export function validateProviderProfileInput(
  input: ProviderProfileUpsertInput,
): ProfileValidationError | null {
  const displayName = input.displayName.trim();
  const description = input.description.trim();

  if (!displayName) return "DISPLAY_NAME_REQUIRED";
  if (displayName.length < 2 || displayName.length > 80) return "DISPLAY_NAME_LENGTH";
  if (!description) return "DESCRIPTION_REQUIRED";
  if (description.length < 10 || description.length > 500) return "DESCRIPTION_LENGTH";

  return null;
}

export async function getProviderProfileByClientId(clientId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  return profile ? toProviderProfileDto(profile) : null;
}

export async function upsertProviderProfileForClient(
  clientId: string,
  input: ProviderProfileUpsertInput,
) {
  const validation = validateProviderProfileInput(input);
  if (validation) {
    return { error: validation };
  }

  const displayName = input.displayName.trim();
  const description = input.description.trim();
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

export async function requireProviderProfileForClient(clientId: string) {
  const row = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  return row;
}
