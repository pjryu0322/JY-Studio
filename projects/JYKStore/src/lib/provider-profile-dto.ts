import type { ProviderProfile } from "@prisma/client";

export type ProviderProfileDto = {
  id: string;
  displayName: string;
  description: string;
  websiteUrl: string | null;
  contactEmail: string | null;
  status: string;
};

export function toProviderProfileDto(profile: ProviderProfile): ProviderProfileDto {
  return {
    id: profile.id,
    displayName: profile.displayName,
    description: profile.description,
    websiteUrl: profile.websiteUrl,
    contactEmail: profile.contactEmail,
    status: profile.status,
  };
}
