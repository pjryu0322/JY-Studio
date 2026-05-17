"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState, InlineAlert, LoadingState } from "@/components/ui";
import { WorkflowStageChrome } from "@/components/workflow/primitives/WorkflowStageChrome";
import { PilotValidationReviewPanel } from "@/components/orchestration/pilot-validation";
import { buildPilotValidationUserSummaryVmFromDiagnosticData } from "@/lib/overlay-ui/pilotValidationUserSummaryVmFromDiagnostic";
import { uiTokens as t } from "@/components/ui/tokens";

type OverlayRuntimeDiagnosticResponse =
  | { success: true; data: Record<string, unknown> }
  | { success: false; message?: string };

export function PilotValidationPageClient() {
  const search = useSearchParams();
  const router = useRouter();
  const projectId = search?.get("projectId")?.trim() ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<Record<string, unknown> | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadDiagnostic = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setLoading(true);
    setError(null);
    setDiagnosticData(null);
    try {
      const qs = new URLSearchParams({
        projectId: pid,
        audienceMode: "user",
      });
      const res = await fetch(`/api/diagnostics/overlay-runtime?${qs.toString()}`, {
        credentials: "include",
      });
      const json = (await res.json()) as OverlayRuntimeDiagnosticResponse;
      if (!res.ok || !json.success) {
        setError(
          json.success === false
            ? json.message ?? "파일럿 검증 상태를 불러오지 못했습니다."
            : "파일럿 검증 상태를 불러오지 못했습니다."
        );
        return;
      }
      setDiagnosticData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일럿 검증 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDiagnostic();
  }, [loadDiagnostic]);

  const vm = useMemo(
    () => (diagnosticData ? buildPilotValidationUserSummaryVmFromDiagnosticData(diagnosticData) : null),
    [diagnosticData]
  );

  const requirementsHref = projectId
    ? `/requirements?projectId=${encodeURIComponent(projectId)}`
    : "/requirements";

  return (
    <WorkflowStageChrome title={null} subtitle={undefined}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: 14,
          boxSizing: "border-box",
          gap: 12,
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {!projectId ? (
          <EmptyState
            title="프로젝트가 지정되지 않았습니다."
            description="URL에 ?projectId= 를 붙여 다시 열어 주세요."
          />
        ) : loading ? (
          <LoadingState />
        ) : error ? (
          <InlineAlert variant="danger">{error}</InlineAlert>
        ) : !vm ? (
          <InlineAlert variant="warning">
            파일럿 검증 준비 데이터가 아직 없습니다. 프로젝트 오케스트레이션 진단이 생성된 뒤 다시 확인해 주세요.
          </InlineAlert>
        ) : (
          <>
            <PilotValidationReviewPanel
              vm={vm}
              onViewDiagnostics={() => setDetailsOpen((open) => !open)}
              onCancel={() => router.push(requirementsHref)}
            />
            {detailsOpen ? (
              <section
                data-testid="pilot-validation-details"
                style={{
                  border: `1px solid ${t.border}`,
                  borderRadius: t.radiusMd,
                  padding: 12,
                  background: t.bgPage,
                  fontSize: 12,
                  color: t.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
                  검증 상세 요약
                </h3>
                <p style={{ margin: 0 }}>
                  이 화면은 read-only 검증 준비 상태입니다. 실제 runner·adapter·sandbox 실행은 연결되어 있지 않습니다.
                </p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </WorkflowStageChrome>
  );
}
