"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectWithRetry } from "@/components/project-spec/api";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  isActualIntegratedAppPreviewRuntime,
  resolveImplementationPreviewRuntimeKindV1,
} from "@/lib/prototype/implementationPreviewRuntimeKind";
import { canIframeInternalAppPreviewUrl } from "@/lib/prototype/generatedAppPreviewUrlResolver";
import { isExternalPreviewUrl } from "@/lib/prototype/previewUrlClassification";

const NOT_READY_MESSAGE =
  "실제 앱 Preview가 아직 준비되지 않았습니다.\n통합 및 Preview 준비를 실행해 주세요.";

export function GeneratedAppPreviewPageClient(props: { readonly projectId: string }) {
  const projectId = props.projectId.trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runtimeRaw, setRuntimeRaw] = useState<unknown>(null);

  useEffect(() => {
    if (!projectId) {
      setError("프로젝트 ID가 필요합니다.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { project, errorMessage } = await fetchProjectWithRetry(projectId);
        if (cancelled) return;
        if (!project) {
          setError(errorMessage?.trim() || "프로젝트를 불러올 수 없습니다.");
          return;
        }
        const state = parseRequirementsStateJson(project.requirementsStateJson);
        setRuntimeRaw(state?.implementationPreviewRuntimeV1);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const runtime = useMemo(() => parseImplementationPreviewRuntimeV1(runtimeRaw) ?? null, [runtimeRaw]);
  const runtimeKind = useMemo(
    () => resolveImplementationPreviewRuntimeKindV1({ projectId, runtime }),
    [projectId, runtime],
  );
  const actualReady = useMemo(
    () => isActualIntegratedAppPreviewRuntime({ projectId, runtime }),
    [projectId, runtime],
  );

  if (loading) {
    return <p style={{ padding: 24 }}>실제 앱 Preview를 불러오는 중…</p>;
  }
  if (error) {
    return <p style={{ padding: 24 }}>{error}</p>;
  }

  if (!actualReady || runtimeKind !== "actual_integrated_app") {
    return (
      <div style={{ padding: 24, maxWidth: 560 }} data-testid="actual-app-preview-not-ready">
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{NOT_READY_MESSAGE}</p>
        <p style={{ marginTop: 16, color: "var(--muted-foreground, #666)" }}>
          CodeTask 진단 Preview는{" "}
          <a href={`/projects/${encodeURIComponent(projectId)}/preview?scope=latest`}>
            /preview?scope=latest
          </a>
          에서 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  const external = String(runtime?.externalPreviewUrl ?? "").trim();
  if (external && isExternalPreviewUrl(external)) {
    return (
      <div style={{ padding: 24 }} data-testid="actual-app-preview-external">
        <p>실제 앱 Preview가 외부 URL로 준비되었습니다.</p>
        <a href={external} target="_blank" rel="noopener noreferrer">
          Preview 열기
        </a>
      </div>
    );
  }

  const iframeSrc =
    String(runtime?.localPreviewServerUrl ?? "").trim() ||
    String(runtime?.internalAppPreviewUrl ?? "").trim() ||
    null;

  if (iframeSrc && canIframeInternalAppPreviewUrl(iframeSrc)) {
    return (
      <iframe
        title="Integrated app preview"
        src={iframeSrc}
        style={{ border: 0, width: "100%", minHeight: "80vh" }}
        data-testid="actual-app-preview-iframe"
      />
    );
  }

  return (
    <div style={{ padding: 24 }} data-testid="actual-app-preview-url-missing">
      <p style={{ whiteSpace: "pre-wrap" }}>{NOT_READY_MESSAGE}</p>
    </div>
  );
}
