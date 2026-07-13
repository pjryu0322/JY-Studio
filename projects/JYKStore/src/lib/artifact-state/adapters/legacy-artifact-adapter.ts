import type { LatestPackVersionArtifactInput } from "@/lib/artifact-state/types";
import { hasDistributionMetadata, hasDistributionZipPayload } from "@/lib/artifact-state/adapters/distribution-zip-artifact-adapter";
import { pickReadyExternalImport } from "@/lib/artifact-state/adapters/external-import-artifact-adapter";

/** True when the version has no distribution metadata and no zip/external artifact markers. */
export function isLegacyArtifactVersion(version: LatestPackVersionArtifactInput): boolean {
  if (hasDistributionZipPayload(version)) return false;
  if (hasDistributionMetadata(version)) return false;
  if (pickReadyExternalImport(version?.externalImports)) return false;
  return true;
}
