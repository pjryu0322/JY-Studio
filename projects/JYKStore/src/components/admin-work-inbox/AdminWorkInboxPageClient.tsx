"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminCorrectionQueuePanel } from "@/components/AdminCorrectionQueuePanel";
import { AdminKnowledgeGenerationPanel } from "@/components/AdminKnowledgeGenerationPanel";
import { AdminZipPreflightInventoryPanel } from "@/components/AdminZipPreflightInventoryDialog";
import { AdminWorkInboxSections } from "@/components/admin-work-inbox/AdminWorkInboxSections";
import { AdminWorkInboxSummary } from "@/components/admin-work-inbox/AdminWorkInboxSummary";
import { AdminWorkInboxTable } from "@/components/admin-work-inbox/AdminWorkInboxTable";
import { AdminWorkInboxToolbar } from "@/components/admin-work-inbox/AdminWorkInboxToolbar";
import {
  FILTER_TO_GROUPS,
  type AdminWorkInboxPageClientProps,
  type WorkStatusFilter,
} from "@/components/admin-work-inbox/admin-work-inbox.types";
import type { AdminReviewListItemDto } from "@/lib/admin-review-dto";
import { isAdminQualityReviewAcknowledged } from "@/lib/admin-quality-review-ack-session";
import {
  fetchAdminReviewItems,
  fetchAdminWorkerZipRequests,
  type AdminProviderReturnedPackListItem,
  type AdminWorkerZipRequestListItem,
} from "@/lib/admin-review-api";
import {
  returnedItemToViewModel,
  reviewItemToViewModel,
  zipItemToViewModel,
} from "@/lib/admin-work-inbox/admin-work-inbox-mappers";
import {
  countAdminWorkInboxWaiting,
  filterAdminCorrectionQueue,
  filterAdminWorkInboxByQueueGroup,
  filterAdminWorkQueue,
  mergeAdminWorkInboxViewModels,
  partitionAdminReviewRequiredByServicePhase,
} from "@/lib/admin-work-inbox-view-model";
import {
  ADMIN_WORK_EMPTY,
  ADMIN_WORK_FILTER_NO_MATCH,
} from "@/lib/role-based-ux-copy";
import { parseAdminWorkQueue, type AdminWorkQueueKey } from "@/lib/routes";

/**
 * Admin first screen — work inbox ordered by what the admin must do next.
 * Stage rails pass `?queue=` (or legacy queueScope prop) to filter the list.
 */
export function AdminWorkInboxPageClient({
  initialStatusFilter = "all",
  lockStatusFilter = false,
  queueScope,
}: AdminWorkInboxPageClientProps = {}) {
  const searchParams = useSearchParams();
  const activeQueue: AdminWorkQueueKey =
    queueScope === "generation"
      ? "generation"
      : queueScope && queueScope !== "all"
        ? queueScope
        : parseAdminWorkQueue(searchParams.get("queue"));
  const stageFiltered = activeQueue !== "all";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zipItems, setZipItems] = useState<AdminWorkerZipRequestListItem[]>([]);
  const [returnedItems, setReturnedItems] = useState<AdminProviderReturnedPackListItem[]>(
    [],
  );
  const [reviewItems, setReviewItems] = useState<AdminReviewListItemDto[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WorkStatusFilter>(initialStatusFilter);
  const [selectedGenerationPackId, setSelectedGenerationPackId] = useState<string | null>(null);
  const [selectedQualityPackId, setSelectedQualityPackId] = useState<string | null>(null);
  const [selectedCorrectionPack, setSelectedCorrectionPack] = useState<{
    packId: string;
    packName: string;
  } | null>(null);
  const [qualityAckEpoch, setQualityAckEpoch] = useState(0);
  const [selectedPreflightPack, setSelectedPreflightPack] = useState<{
    packId: string;
    packName: string;
  } | null>(null);
  const [preflightCollapsed, setPreflightCollapsed] = useState(false);
  const statusFilterLocked = lockStatusFilter || stageFiltered;

  useEffect(() => {
    if (activeQueue !== "correction") return;
    const bump = () => setQualityAckEpoch((n) => n + 1);
    bump();
    window.addEventListener("focus", bump);
    return () => window.removeEventListener("focus", bump);
  }, [activeQueue]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zip, reviews] = await Promise.all([
        fetchAdminWorkerZipRequests(),
        fetchAdminReviewItems(),
      ]);
      setZipItems(zip.items);
      setReturnedItems(zip.returnedItems ?? []);
      setReviewItems(reviews.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "작업 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const allViewItems = useMemo(
    () =>
      mergeAdminWorkInboxViewModels([
        ...zipItems.map(zipItemToViewModel),
        ...returnedItems.map(returnedItemToViewModel),
        ...reviewItems.map(reviewItemToViewModel),
      ]),
    [zipItems, returnedItems, reviewItems],
  );

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allViewItems) {
      if (item.categoryId) {
        map.set(item.categoryId, item.categoryName?.trim() || item.categoryId);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [allViewItems]);

  const filteredViewItems = useMemo(() => {
    const byCategory = allViewItems.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      return true;
    });

    if (stageFiltered && activeQueue !== "ops") {
      if (activeQueue === "correction") {
        return filterAdminCorrectionQueue(byCategory, isAdminQualityReviewAcknowledged);
      }
      return filterAdminWorkQueue(byCategory, activeQueue);
    }

    const groups = FILTER_TO_GROUPS[statusFilter];
    return byCategory.filter((item) => {
      if (groups && !groups.includes(item.adminQueueGroup)) return false;
      if (statusFilter === "service_validation") {
        return (
          item.adminQueueGroup === "ADMIN_REVIEW_REQUIRED" &&
          item.serviceValidationPhase !== "PASSED"
        );
      }
      if (statusFilter === "pack_review") {
        return (
          item.adminQueueGroup === "ADMIN_REVIEW_REQUIRED" &&
          item.serviceValidationPhase === "PASSED"
        );
      }
      return true;
    });
  }, [allViewItems, categoryFilter, statusFilter, stageFiltered, activeQueue, qualityAckEpoch]);

  useEffect(() => {
    if (activeQueue !== "generation") {
      setSelectedGenerationPackId(null);
      setSelectedPreflightPack(null);
      setPreflightCollapsed(false);
    }
    if (activeQueue !== "quality") {
      setSelectedQualityPackId(null);
    }
    if (activeQueue !== "correction") {
      setSelectedCorrectionPack(null);
    }
    if (
      selectedGenerationPackId &&
      !filteredViewItems.some((item) => item.packId === selectedGenerationPackId)
    ) {
      setSelectedGenerationPackId(null);
    }
    if (
      selectedQualityPackId &&
      !filteredViewItems.some((item) => item.packId === selectedQualityPackId)
    ) {
      setSelectedQualityPackId(null);
    }
    if (
      selectedCorrectionPack &&
      !filteredViewItems.some((item) => item.packId === selectedCorrectionPack.packId)
    ) {
      setSelectedCorrectionPack(null);
    }
    if (
      selectedPreflightPack &&
      !filteredViewItems.some((item) => item.packId === selectedPreflightPack.packId)
    ) {
      setSelectedPreflightPack(null);
      setPreflightCollapsed(false);
    }
  }, [
    activeQueue,
    filteredViewItems,
    selectedGenerationPackId,
    selectedQualityPackId,
    selectedCorrectionPack,
    selectedPreflightPack,
  ]);

  const acceptItems =
    stageFiltered
      ? activeQueue === "receipt" || activeQueue === "accept"
        ? filteredViewItems
        : []
      : filterAdminWorkInboxByQueueGroup(filteredViewItems, "ACCEPT_REQUIRED");
  const generateItems = stageFiltered
    ? activeQueue === "receipt" || activeQueue === "accept"
      ? []
      : filteredViewItems
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "GENERATE_REQUIRED");
  const providerReviewInProgressItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "PROVIDER_REVIEW_IN_PROGRESS");
  const adminReviewRequiredItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "ADMIN_REVIEW_REQUIRED");
  const { serviceValidationWaiting: serviceValidationItems, approvalWaiting: packReviewRequiredItems } =
    partitionAdminReviewRequiredByServicePhase(adminReviewRequiredItems);
  const packReviewInProgressItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "ADMIN_REVIEW_IN_PROGRESS");
  const returnedOrRejectedItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "PROVIDER_SUPPLEMENT_REQUIRED");
  const legacyReturnedItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "RETURNED_OR_REJECTED");
  const publishedItems = stageFiltered
    ? []
    : filterAdminWorkInboxByQueueGroup(filteredViewItems, "PUBLISHED");

  const returnedMetaByPack = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of returnedItems) {
      const vm = returnedItemToViewModel(item);
      if (vm.metaLine) map.set(item.packId, vm.metaLine);
    }
    return map;
  }, [returnedItems]);

  const totalWaiting = countAdminWorkInboxWaiting(filteredViewItems);
  const rawTotal = allViewItems.length;
  const visibleCount = stageFiltered
    ? filteredViewItems.length
    : acceptItems.length +
      generateItems.length +
      providerReviewInProgressItems.length +
      serviceValidationItems.length +
      packReviewRequiredItems.length +
      packReviewInProgressItems.length +
      returnedOrRejectedItems.length +
      legacyReturnedItems.length +
      publishedItems.length;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <AdminWorkInboxSummary
          loading={loading}
          activeQueue={activeQueue}
          totalWaiting={totalWaiting}
          rawTotal={rawTotal}
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
        />
        <AdminWorkInboxToolbar
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          categoryOptions={categoryOptions}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          statusFilterLocked={statusFilterLocked}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : rawTotal === 0 ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-sm text-store-muted">
          {ADMIN_WORK_EMPTY}
        </p>
      ) : visibleCount === 0 ? (
        <p className="rounded-2xl border border-dashed border-store-border bg-white px-4 py-3 text-sm text-store-muted">
          {ADMIN_WORK_FILTER_NO_MATCH}
        </p>
      ) : stageFiltered ? (
        <div className="space-y-4">
          <AdminWorkInboxTable
            items={filteredViewItems}
            activeQueue={activeQueue}
            metaByPack={returnedMetaByPack}
            selectedPackId={
              activeQueue === "generation"
                ? selectedGenerationPackId
                : activeQueue === "quality"
                  ? selectedQualityPackId
                  : activeQueue === "correction"
                    ? (selectedCorrectionPack?.packId ?? null)
                    : null
            }
            onSelectPack={
              activeQueue === "generation"
                ? (item) => {
                    // Show generation card only — do not auto-start. Collapse preflight if open.
                    setPreflightCollapsed(true);
                    setSelectedGenerationPackId(item.packId);
                  }
                : activeQueue === "quality"
                  ? (item) => {
                      setSelectedQualityPackId(item.packId);
                    }
                  : activeQueue === "correction"
                    ? (item) => {
                        setSelectedCorrectionPack((prev) =>
                          prev?.packId === item.packId
                            ? null
                            : { packId: item.packId, packName: item.packName },
                        );
                      }
                    : undefined
            }
            selectedPreflightPackId={
              activeQueue === "generation" ? (selectedPreflightPack?.packId ?? null) : null
            }
            onSelectPreflight={
              activeQueue === "generation"
                ? (item) =>
                    setSelectedPreflightPack((prev) => {
                      if (prev?.packId === item.packId) {
                        setPreflightCollapsed(false);
                        return null;
                      }
                      setPreflightCollapsed(false);
                      return { packId: item.packId, packName: item.packName };
                    })
                : undefined
            }
          />
          {activeQueue === "generation" && selectedPreflightPack ? (
            <AdminZipPreflightInventoryPanel
              key={`preflight-${selectedPreflightPack.packId}`}
              packId={selectedPreflightPack.packId}
              packName={selectedPreflightPack.packName}
              collapsed={preflightCollapsed}
              onCollapsedChange={setPreflightCollapsed}
            />
          ) : null}
          {activeQueue === "generation" && selectedGenerationPackId ? (
            <AdminKnowledgeGenerationPanel
              key={`gen-${selectedGenerationPackId}`}
              packId={selectedGenerationPackId}
              workbenchMode="generation"
              onReviewDetailRefresh={refresh}
            />
          ) : null}
          {activeQueue === "quality" && selectedQualityPackId ? (
            <AdminKnowledgeGenerationPanel
              key={`quality-${selectedQualityPackId}`}
              packId={selectedQualityPackId}
              workbenchMode="quality"
              preferQualitySection
              onReviewDetailRefresh={refresh}
            />
          ) : null}
          {activeQueue === "correction" && selectedCorrectionPack ? (
            <AdminCorrectionQueuePanel
              key={`correction-${selectedCorrectionPack.packId}`}
              packId={selectedCorrectionPack.packId}
              packName={selectedCorrectionPack.packName}
              onChanged={refresh}
            />
          ) : null}
        </div>
      ) : (
        <AdminWorkInboxSections
          acceptItems={acceptItems}
          generateItems={generateItems}
          providerReviewInProgressItems={providerReviewInProgressItems}
          serviceValidationItems={serviceValidationItems}
          packReviewRequiredItems={packReviewRequiredItems}
          packReviewInProgressItems={packReviewInProgressItems}
          returnedOrRejectedItems={returnedOrRejectedItems}
          legacyReturnedItems={legacyReturnedItems}
          publishedItems={publishedItems}
          activeQueue={activeQueue}
          returnedMetaByPack={returnedMetaByPack}
        />
      )}
    </div>
  );
}
