"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectById } from "@/components/project-spec/api";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { GeneratedAppPreviewRenderer } from "@/components/preview/GeneratedAppPreviewRenderer";

export function GeneratedAppPreviewPageClient(props: { readonly projectId: string }) {
  const projectId = props.projectId.trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [scopeRaw, setScopeRaw] = useState<unknown>(null);

  useEffect(() => {
    if (!projectId) {
      setError("프로젝트 ID가 필요합니다.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { project, errorMessage } = await fetchProjectById(projectId);
        if (cancelled) return;
        if (!project) {
          setError(errorMessage?.trim() || "프로젝트를 불러올 수 없습니다.");
          return;
        }
        setProjectName(String(project.name ?? "").trim());
        const state = parseRequirementsStateJson(project.requirementsStateJson);
        setScopeRaw(state?.implementationPreviewScopeV1);
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

  const scope = useMemo(() => parseImplementationPreviewScopeV1(scopeRaw), [scopeRaw]);

  if (loading) {
    return <p style={{ padding: 24 }}>생성 앱 Preview를 불러오는 중…</p>;
  }
  if (error) {
    return <p style={{ padding: 24 }}>{error}</p>;
  }
  if (!scope?.includedCodeTasks.length) {
    return <p style={{ padding: 24 }}>표시할 완료 CodeTask Preview 범위가 없습니다.</p>;
  }

  return (
    <GeneratedAppPreviewRenderer projectId={projectId} projectName={projectName} previewScope={scope} />
  );
}
