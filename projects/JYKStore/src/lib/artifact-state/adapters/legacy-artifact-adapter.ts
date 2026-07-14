import type { LatestPackVersionArtifactInput } from "@/lib/artifact-state/types";
import { pickReadyExternalImport } from "@/lib/artifact-state/adapters/external-import-artifact-adapter";

/** True when the version has no distribution metadata and no external artifact markers. */
export function isLegacyArtifactVersion(version: LatestPackVersionArtifactInput): boolean {
  if (version?.distributionMetadata) return false;
  if (pickReadyExternalImport(version?.externalImports)) return false;
  return true;
}
