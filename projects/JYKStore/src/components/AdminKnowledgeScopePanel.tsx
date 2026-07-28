"use client";

/**
 * P2 skeleton: KNOWLEDGE_SCOPE step.
 * Full Inventory DB / per-file include-exclude lands in P3.
 * Surfaces existing ZIP preflight exclusions and advances to GENERATION.
 */
import { useState } from "react";
import { AdminZipPreflightInventoryPanel } from "@/components/AdminZipPreflightInventoryDialog";

export function AdminKnowledgeScopePanel({
  packId,
  packName,
  onConfirmScope,
  onGoGeneration,
}: {
  readonly packId: string;
  readonly packName?: string | null;
  readonly onConfirmScope: () => void;
  readonly onGoGeneration: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="space-y-4">
      <header className="space-y-1 rounded-2xl border border-store-border bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-store-muted">
          지식화 대상 확인
        </p>
        <h2 className="text-lg font-semibold text-store-ink">Worker에 넘길 파일 범위를 확정합니다</h2>
        <p className="text-sm text-store-muted">
          P2에서는 기존 ZIP 사전정리(제외 경로)를 연결합니다. 파일별 Inventory DB·미리보기·제공자
          포함/제외 판단은 후속 단계에서 구현합니다. 가짜 inventory 데이터는 만들지 않습니다.
        </p>
        <div className="pt-2">
          <button
            type="button"
            className="rounded-xl bg-store-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            onClick={() => {
              onConfirmScope();
              onGoGeneration();
            }}
          >
            대상 확정 후 생성으로
          </button>
        </div>
      </header>

      <AdminZipPreflightInventoryPanel
        packId={packId}
        packName={packName ?? undefined}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
    </section>
  );
}
