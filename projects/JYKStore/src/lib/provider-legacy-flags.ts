/**
 * P7.3: feature flags isolating legacy Provider UI from the default screen.
 *
 * The legacy Docling JSON/Markdown manual-upload UI is hidden from Providers by
 * default (they should only attach a ZIP and request generation). The backend
 * compatibility bridge, DTOs, and test fixtures are NOT removed — this only
 * controls whether the manual-upload card is rendered. Enable for admin/debug via
 * `NEXT_PUBLIC_PROVIDER_LEGACY_DOCLING=1`.
 */
export function isProviderLegacyDoclingUiEnabled(
  env: Record<string, string | undefined> = readPublicEnv(),
): boolean {
  return env.NEXT_PUBLIC_PROVIDER_LEGACY_DOCLING === "1";
}

function readPublicEnv(): Record<string, string | undefined> {
  // Guarded so this is safe to import in both server and client bundles.
  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {};
}
