"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AdminChunkManager } from "@/components/AdminChunkManager";
import { AdminReviewSourceDocuments } from "@/components/AdminReviewSourceDocuments";
import { ChunkQualityPanel } from "@/components/ChunkQualityPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { KnowledgeGraphPanel } from "@/components/KnowledgeGraphPanel";
import { ReleaseGatePanel } from "@/components/ReleaseGatePanel";
import { RetrievalEvaluationPanel } from "@/components/RetrievalEvaluationPanel";
import { StructureQualityPanel } from "@/components/StructureQualityPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  defaultOpenAdminReviewSections,
  type AdminReviewDetailSectionKey,
} from "@/lib/admin-review-decision";
import {
  ADMIN_REVIEW_CTA_CHUNK,
  ADMIN_REVIEW_CTA_RELEASE_GATE,
  ADMIN_REVIEW_CTA_RETRIEVAL_GENERATE,
  ADMIN_REVIEW_CTA_RETRIEVAL_RUN,
  ADMIN_REVIEW_CTA_STRUCTURE,
  ADMIN_REVIEW_DETAIL_SECTIONS_TITLE,
} from "@/lib/role-based-ux-copy";

function DetailDisclosure({
  sectionKey,
  title,
  openMap,
  onToggle,
  children,
}: {
  readonly sectionKey: AdminReviewDetailSectionKey;
  readonly title: string;
  readonly openMap: Partial<Record<AdminReviewDetailSectionKey, boolean>>;
  readonly onToggle: (key: AdminReviewDetailSectionKey, open: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <details
      className="rounded-2xl border border-store-border bg-white shadow-card"
      open={Boolean(openMap[sectionKey])}
      onToggle={(e) => onToggle(sectionKey, (e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span>{title}</span>
          <span className="text-xs font-semibold text-store-muted">
            {openMap[sectionKey] ? "접기" : "펼치기"}
          </span>
        </span>
      </summary>
      <div className="border-t border-store-border px-2 pb-2 pt-1 sm:px-3">{children}</div>
    </details>
  );
}

export function AdminReviewDetailSections({
  packId,
  detail,
  onUpdated,
  actions,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly onUpdated: (detail: AdminReviewDetailDto) => void;
  readonly actions: {
    evaluateStructure: () => Promise<void>;
    evaluateChunk: () => Promise<void>;
    generateRetrievalCases: (replace?: boolean) => Promise<void>;
    runRetrievalEvaluation: () => Promise<void>;
    evaluateReleaseGate: () => Promise<void>;
  };
}) {
  const defaults = useMemo(() => defaultOpenAdminReviewSections(detail), [detail]);
  const [openMap, setOpenMap] = useState(defaults);

  const onToggle = (key: AdminReviewDetailSectionKey, open: boolean) => {
    setOpenMap((prev) => ({ ...prev, [key]: open }));
  };

  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">
        {ADMIN_REVIEW_DETAIL_SECTIONS_TITLE}
      </h2>

      <DetailDisclosure
        sectionKey="structure"
        title="구조/품질 상세 보기"
        openMap={openMap}
        onToggle={onToggle}
      >
        <StructureQualityPanel
          packId={packId}
          structureQuality={detail.structureQuality}
          editable
          evaluateButtonLabel={ADMIN_REVIEW_CTA_STRUCTURE}
          onEvaluate={actions.evaluateStructure}
        />
      </DetailDisclosure>

      <DetailDisclosure
        sectionKey="chunk"
        title="청킹 품질 상세 보기"
        openMap={openMap}
        onToggle={onToggle}
      >
        <ChunkQualityPanel
          packId={packId}
          chunkQuality={detail.chunkQuality}
          editable
          evaluateButtonLabel={ADMIN_REVIEW_CTA_CHUNK}
          onEvaluate={actions.evaluateChunk}
        />
      </DetailDisclosure>

      <DetailDisclosure
        sectionKey="retrieval"
        title="검색 품질 상세 보기"
        openMap={openMap}
        onToggle={onToggle}
      >
        <RetrievalEvaluationPanel
          packId={packId}
          retrievalEvaluation={detail.retrievalEvaluation}
          editable
          generateButtonLabel={ADMIN_REVIEW_CTA_RETRIEVAL_GENERATE}
          runButtonLabel={ADMIN_REVIEW_CTA_RETRIEVAL_RUN}
          onGenerate={actions.generateRetrievalCases}
          onRun={actions.runRetrievalEvaluation}
        />
      </DetailDisclosure>

      <DetailDisclosure
        sectionKey="releaseGate"
        title="릴리스 게이트 상세 보기"
        openMap={openMap}
        onToggle={onToggle}
      >
        <ReleaseGatePanel
          packId={packId}
          releaseGate={detail.releaseGate}
          editable
          evaluateButtonLabel={ADMIN_REVIEW_CTA_RELEASE_GATE}
          onEvaluate={async () => {
            await actions.evaluateReleaseGate();
          }}
        />
      </DetailDisclosure>

      <DetailDisclosure
        sectionKey="sources"
        title="원천 문서 상세 보기"
        openMap={openMap}
        onToggle={onToggle}
      >
        <AdminReviewSourceDocuments
          packId={packId}
          versions={detail.versions}
          onValidated={onUpdated}
        />
      </DetailDisclosure>

      <DetailDisclosure
        sectionKey="advanced"
        title="고급 도구"
        openMap={openMap}
        onToggle={onToggle}
      >
        <div className="space-y-3 p-2">
          <AdminChunkManager packId={packId} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <KnowledgeGraphPanel packId={packId} />
            <ExportPanel packId={packId} />
          </div>
        </div>
      </DetailDisclosure>
    </section>
  );
}
