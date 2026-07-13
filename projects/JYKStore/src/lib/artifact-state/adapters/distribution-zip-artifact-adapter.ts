import type { LatestPackVersionArtifactInput } from "@/lib/artifact-state/types";

export function hasDistributionZipPayload(
  version: LatestPackVersionArtifactInput,
): boolean {
  return Boolean(version?.payload?.id);
}

export function hasDistributionMetadata(
  version: LatestPackVersionArtifactInput,
): boolean {
  return Boolean(version?.distributionMetadata);
}
