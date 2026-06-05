"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchProjectById } from "@/components/project-spec/api";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { buildIntegrationScopeDetailLines } from "@/lib/prototype/implementationIntegrationScopeUi";
import {
  resolveCompletedCodeTaskPreviewMainMode,
  shouldShowPreviewFallbackNotice,
} from "@/lib/prototype/completedCodeTaskPreviewView";
import styles from "@/components/preview/completedCodeTaskPreviewPage.module.css";

export function CompletedCodeTaskPreviewScopeDetails(props: {
  readonly scope: NonNullable<ReturnType<typeof parseImplementationPreviewScopeV1>>;
}) {
  const detailLines = buildIntegrationScopeDetailLines(props.scope);
  return (
    <details className={styles.scopeDetails} data-testid="completed-codetask-preview-scope-details">
      <summary className={styles.scopeDetailsSummary}>범위 상세 보기</summary>
      <div className={styles.scopeDetailsBody}>
        <pre className={styles.fallbackPre}>{detailLines.join("\n")}</pre>
      </div>
    </details>
  );
}

export function CompletedCodeTaskPreviewScopeSummaryFallback(props: {
  readonly scope: NonNullable<ReturnType<typeof parseImplementationPreviewScopeV1>>;
  readonly showFallbackNotice: boolean;
}) {
  const detailLines = buildIntegrationScopeDetailLines(props.scope);
  return (
    <div className={styles.fallbackBody} data-testid="completed-codetask-preview-scope-fallback">
      {props.showFallbackNotice ? (
        <p className={styles.noticeWarning}>
          실제 앱 Preview URL을 찾지 못해 통합 범위 요약을 표시합니다.
        </p>
      ) : null}
      <pre className={styles.fallbackPre}>{detailLines.join("\n")}</pre>
    </div>
  );
}

export function CompletedCodeTaskPreviewPageClient(props: { readonly projectId: string }) {
  const projectId = props.projectId.trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
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
        setProjectName(String(project.name ?? "").trim());
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
  const mainMode = useMemo(() => resolveCompletedCodeTaskPreviewMainMode(runtime), [runtime]);
  const showFallbackNotice = useMemo(() => shouldShowPreviewFallbackNotice(runtime), [runtime]);

  if (loading) {
    return <p style={{ padding: 24 }}>Preview를 불러오는 중…</p>;
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

  const excludedCount = scope.excludedCodeTasks.length;
  const appPreviewUrl = String(runtime?.appPreviewUrl ?? "").trim();

  return (
    <div className={styles.root} data-testid="completed-codetask-preview-page">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>
              Preview · 완료된 CodeTask {scope.includedCodeTasks.length}개 기준
            </h1>
            <p className={styles.summaryLine}>
              {excludedCount > 0
                ? `미완료 CodeTask ${excludedCount}개 제외`
                : "제외된 CodeTask 없음"}
            </p>
            {scope.warnings.map((warning) => (
              <p key={warning} className={styles.noticeWarning}>
                {warning}
              </p>
            ))}
            {runtime?.status === "ready" && mainMode === "iframe" ? (
              <p className={styles.noticeOk}>Preview 준비 완료</p>
            ) : null}
            {runtime?.status === "failed" && runtime.errorMessage ? (
              <p className={styles.noticeError}>Preview 준비 실패: {runtime.errorMessage}</p>
            ) : null}
          </div>
          <Link className={styles.backLink} href={`/execution?projectId=${encodeURIComponent(projectId)}`}>
            구현 탭으로 돌아가기
          </Link>
        </div>
        <CompletedCodeTaskPreviewScopeDetails scope={scope} />
      </header>

      <div className={styles.mainArea}>
        {mainMode === "iframe" && appPreviewUrl ? (
          <iframe
            src={appPreviewUrl}
            title={`${projectName || "생성 앱"} Preview`}
            className={styles.iframe}
            data-testid="completed-codetask-preview-iframe"
          />
        ) : (
          <CompletedCodeTaskPreviewScopeSummaryFallback
            scope={scope}
            showFallbackNotice={showFallbackNotice}
          />
        )}
      </div>
    </div>
  );
}
