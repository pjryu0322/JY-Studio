"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, InlineAlert } from "@/components/ui";
import type { ReferenceLibraryItem } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";

type ApiListResponse = {
  success: boolean;
  message?: string;
  data?: { items: ReferenceLibraryItem[] };
};

export type ProjectReferencePickerSelection = Readonly<{
  referenceSnapshotId: string;
  item: ReferenceLibraryItem;
}>;

type Props = Readonly<{
  disabled?: boolean;
  selection: ProjectReferencePickerSelection | null;
  onSelectionChange: (next: ProjectReferencePickerSelection | null) => void;
}>;

function readinessLabel(readiness: ReferenceLibraryItem["readiness"]): string {
  return readiness === "VERIFIED" ? "검증된 참조 가능" : "참조 가능";
}

function ProjectReferenceLibraryCard(props: Readonly<{
  item: ReferenceLibraryItem;
  onSelect: () => void;
  onDetail: () => void;
}>) {
  const { item } = props;
  return (
    <div
      className="rounded-lg border border-neutral-200 bg-white p-3"
      data-testid={`reference-library-card-${item.referenceSnapshotId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-900">{item.projectTitle}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{item.snapshotTitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
          {readinessLabel(item.readiness)}
        </span>
      </div>
      {item.projectDescription ? (
        <p className="mt-2 line-clamp-2 text-xs text-neutral-600">{item.projectDescription}</p>
      ) : null}
      <p className="mt-2 text-xs text-neutral-600">
        Actor {item.counts.actors}개 · Flow {item.counts.serviceFlows}개 · Feature {item.counts.features}개
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={props.onDetail}>
          상세 보기
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={props.onSelect}>
          이 프로젝트 참고
        </Button>
      </div>
    </div>
  );
}

export function ProjectReferenceSelectionSummary(props: Readonly<{
  selection: ProjectReferencePickerSelection;
  onClear: () => void;
  onDetail: () => void;
  disabled?: boolean;
}>) {
  const { item } = props.selection;
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3" data-testid="reference-selection-summary">
      <p className="text-xs text-neutral-600">
        선택한 프로젝트는 그대로 복사되지 않고, 새 프로젝트 기획 시 참고 정보로만 사용됩니다.
      </p>
      <p className="mt-2 text-sm font-bold text-neutral-900">{item.projectTitle}</p>
      <p className="text-xs text-neutral-600">{item.snapshotTitle}</p>
      <p className="mt-1 text-xs text-neutral-700">
        Actor {item.counts.actors}개 · Flow {item.counts.serviceFlows}개 · Feature {item.counts.features}개 · Graph{" "}
        {item.counts.reusableGraphNodes}개
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={props.disabled} onClick={props.onDetail}>
          상세 보기
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={props.disabled} onClick={props.onClear}>
          선택 해제
        </Button>
      </div>
    </div>
  );
}

export function ProjectReferencePicker({ disabled, selection, onSelectionChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ReferenceLibraryItem | null>(null);
  const [items, setItems] = useState<ReferenceLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [purpose, setPurpose] = useState<"all" | "candidate" | "package">("all");

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (purpose !== "all") params.set("purpose", purpose);
      params.set("sort", "recent");
      params.set("limit", "50");
      const res = await fetch(`/api/projects/reference-library?${params.toString()}`, { credentials: "include" });
      const json = (await res.json()) as ApiListResponse;
      if (!res.ok || !json.success) {
        setError(json.message ?? "참조 목록을 불러오지 못했습니다.");
        setItems([]);
        return;
      }
      setItems(json.data?.items ?? []);
    } catch {
      setError("참조 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, purpose]);

  useEffect(() => {
    if (!modalOpen) return;
    void loadLibrary();
  }, [modalOpen, loadLibrary]);

  const detail = detailItem ?? selection?.item ?? null;

  const detailPanel = useMemo(() => {
    if (!detail) return null;
    return (
      <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-700">
        <p className="font-bold text-neutral-900">{detail.projectTitle}</p>
        <p className="mt-1">{detail.snapshotTitle}</p>
        <p className="mt-2">{readinessLabel(detail.readiness)}</p>
        <p className="mt-2 text-neutral-600">복사되지 않고 참고 정보로만 사용됩니다.</p>
        {detail.reusableAssets.actors.length ? (
          <p className="mt-2">Actor: {detail.reusableAssets.actors.slice(0, 6).join(", ")}</p>
        ) : null}
        {detail.reusableAssets.serviceFlows.length ? (
          <p className="mt-1">Flow: {detail.reusableAssets.serviceFlows.slice(0, 6).join(", ")}</p>
        ) : null}
        {detail.reusableAssets.features.length ? (
          <p className="mt-1">Feature: {detail.reusableAssets.features.slice(0, 6).join(", ")}</p>
        ) : null}
        {detail.reusableAssets.decisions.length ? (
          <p className="mt-1">Decision: {detail.reusableAssets.decisions.slice(0, 4).join(", ")}</p>
        ) : null}
      </div>
    );
  }, [detail]);

  return (
    <div className="space-y-2" data-testid="project-reference-picker">
      <p className="text-sm font-semibold text-neutral-800">참조 프로젝트 선택(선택사항)</p>
      <p className="text-xs text-neutral-600">
        이전 프로젝트의 액터, 서비스 흐름, 기능 구조, 지식 그래프를 새 프로젝트 기획에 참고 정보로 사용할 수
        있습니다.
      </p>

      {selection ? (
        <ProjectReferenceSelectionSummary
          selection={selection}
          disabled={disabled}
          onClear={() => onSelectionChange(null)}
          onDetail={() => setDetailItem(selection.item)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onSelectionChange(null)}>
            참조 프로젝트 없음
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={disabled}
            data-testid="open-reference-library-modal"
            onClick={() => {
              setDetailItem(null);
              setModalOpen(true);
            }}
          >
            프로젝트 선택
          </Button>
        </div>
      )}

      {detailItem && !modalOpen ? detailPanel : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          data-testid="reference-library-modal"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-neutral-900">참조 프로젝트 선택</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                닫기
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="프로젝트명·설명·자산 검색"
                className="h-9 flex-1 rounded-md border border-neutral-300 px-2 text-sm"
              />
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as typeof purpose)}
                className="h-9 rounded-md border border-neutral-300 px-2 text-sm"
              >
                <option value="all">전체</option>
                <option value="candidate">참조 가능</option>
                <option value="package">검증된 참조</option>
              </select>
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadLibrary()}>
                검색
              </Button>
            </div>
            {error ? (
              <InlineAlert variant="danger" style={{ marginTop: 12 }}>
                {error}
              </InlineAlert>
            ) : null}
            {loading ? <p className="mt-4 text-sm text-neutral-500">불러오는 중…</p> : null}
            <div className="mt-4 space-y-3">
              {!loading && items.length === 0 ? (
                <p className="text-sm text-neutral-500">선택 가능한 참조 저장본이 없습니다.</p>
              ) : null}
              {items.map((item) => (
                <ProjectReferenceLibraryCard
                  key={item.referenceSnapshotId}
                  item={item}
                  onDetail={() => setDetailItem(item)}
                  onSelect={() => {
                    onSelectionChange({ referenceSnapshotId: item.referenceSnapshotId, item });
                    setModalOpen(false);
                    setDetailItem(null);
                  }}
                />
              ))}
            </div>
            {detailItem && modalOpen ? detailPanel : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
