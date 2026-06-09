import { buildInternalGeneratedAppPreviewUrl } from "@/lib/prototype/generatedAppPreviewUrlResolver";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  isExternalPreviewUrl,
  isHttpUrl,
} from "@/lib/prototype/previewUrlClassification";

export type ImplementationPreviewRuntimeKindV1 =
  | "actual_integrated_app"
  | "codetask_diagnostic_preview"
  | "scope_summary_fallback";

export function isSyntheticInternalGeneratedAppPreviewUrl(
  projectId: string,
  url: string | null | undefined,
): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  const pid = projectId.trim();
  if (!pid) return false;
  if (u === buildInternalGeneratedAppPreviewUrl(pid)) return true;
  try {
    const path = u.startsWith("http") ? new URL(u).pathname + new URL(u).search : u;
    return path.includes("/preview/app") && path.includes("scope=latest") && !path.includes("/integration");
  } catch {
    return u.includes("/preview/app") && u.includes("scope=latest") && !u.includes("/integration");
  }
}

export function resolveImplementationPreviewRuntimeKindV1(input: {
  readonly projectId?: string | null;
  readonly runtime?: ImplementationPreviewRuntimeV1 | null;
}): ImplementationPreviewRuntimeKindV1 | null {
  const runtime = input.runtime ?? null;
  if (!runtime) return null;

  const explicit = runtime.runtimeKind;
  if (
    explicit === "actual_integrated_app" ||
    explicit === "codetask_diagnostic_preview" ||
    explicit === "scope_summary_fallback"
  ) {
    return explicit;
  }

  if (
    runtime.openMode === "scope_summary_fallback" ||
    runtime.renderMode === "scope_summary_fallback"
  ) {
    return "scope_summary_fallback";
  }

  const external = String(runtime.externalPreviewUrl ?? "").trim();
  if (external && isExternalPreviewUrl(external)) {
    return "actual_integrated_app";
  }

  const localServer = String(runtime.localPreviewServerUrl ?? "").trim();
  if (localServer && isHttpUrl(localServer)) {
    return "actual_integrated_app";
  }

  const previewUrl = String(runtime.previewUrl ?? "").trim();
  if (previewUrl.includes("/preview?") && !previewUrl.includes("/preview/app")) {
    return "codetask_diagnostic_preview";
  }

  const pid = String(input.projectId ?? "").trim();
  const internal = String(runtime.internalAppPreviewUrl ?? "").trim();
  if (pid && isSyntheticInternalGeneratedAppPreviewUrl(pid, internal)) {
    return "codetask_diagnostic_preview";
  }

  if (runtime.renderMode === "external_preview" && external) {
    return "actual_integrated_app";
  }

  if (
    runtime.renderMode === "internal_generated_app" ||
    runtime.renderMode === "generated_app"
  ) {
    return "codetask_diagnostic_preview";
  }

  return "codetask_diagnostic_preview";
}

export function isActualIntegratedAppPreviewRuntime(input: {
  readonly projectId?: string | null;
  readonly runtime?: ImplementationPreviewRuntimeV1 | null;
}): boolean {
  return resolveImplementationPreviewRuntimeKindV1(input) === "actual_integrated_app";
}
