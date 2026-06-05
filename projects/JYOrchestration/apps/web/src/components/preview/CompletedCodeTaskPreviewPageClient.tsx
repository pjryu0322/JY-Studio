"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchProjectById } from "@/components/project-spec/api";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { buildIntegrationScopeDetailLines } from "@/lib/prototype/implementationIntegrationScopeUi";

export function CompletedCodeTaskPreviewPageClient(props: { readonly projectId: string }) {
  const projectId = props.projectId.trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeRaw, setScopeRaw] = useState<unknown>(null);
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
        const { project, errorMessage } = await fetchProjectById(projectId);
        if (cancelled) return;
        if (!project) {
          setError(errorMessage?.trim() || "프로젝트를 불러올 수 없습니다.");
          return;
        }
        const state = parseRequirementsStateJson(project.requirementsStateJson);
        setScopeRaw(state?.implementationPreviewScopeV1);
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

  const scope = useMemo(() => parseImplementationPreviewScopeV1(scopeRaw), [scopeRaw]);
  const runtime = useMemo(() => parseImplementationPreviewRuntimeV1(runtimeRaw), [runtimeRaw]);

  if (loading) {
    return <p style={{ padding: 24 }}>Preview 범위를 불러오는 중…</p>;
  }
  if (error) {
    return <p style={{ padding: 24 }}>{error}</p>;
  }
  if (!scope?.includedCodeTasks.length) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>CodeTask 통합 Preview</h1>
        <p>완료된 CodeTask 기준 Preview 범위가 없습니다. 구현 탭에서 통합을 실행해 주세요.</p>
        <p style={{ marginTop: 16 }}>
          <Link href={`/execution?projectId=${encodeURIComponent(projectId)}`}>구현 탭으로 이동</Link>
        </p>
      </div>
    );
  }

  const detailLines = buildIntegrationScopeDetailLines(scope);

  return (
    <div style={{ padding: 24, maxWidth: 720, lineHeight: 1.6 }} data-testid="completed-codetask-preview-page">
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>CodeTask 통합 Preview</h1>
      <p style={{ marginBottom: 16 }}>
        이번 Preview는 완료된 CodeTask {scope.includedCodeTasks.length}개 기준입니다.
      </p>
      {scope.warnings.map((warning) => (
        <p key={warning} style={{ color: "#b45309", marginBottom: 8 }}>
          {warning}
        </p>
      ))}
      {runtime?.status === "ready" ? (
        <p style={{ color: "#047857", marginBottom: 16 }}>Preview 준비 완료</p>
      ) : null}
      {runtime?.status === "failed" && runtime.errorMessage ? (
        <p style={{ color: "#b91c1c", marginBottom: 16 }}>Preview 준비 실패: {runtime.errorMessage}</p>
      ) : null}
      <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 16, borderRadius: 8 }}>
        {detailLines.join("\n")}
      </pre>
      <p style={{ marginTop: 16 }}>
        <Link href={`/execution?projectId=${encodeURIComponent(projectId)}`}>구현 탭으로 돌아가기</Link>
      </p>
    </div>
  );
}
