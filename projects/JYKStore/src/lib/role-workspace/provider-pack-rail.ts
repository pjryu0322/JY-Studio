import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { ProviderPackTabId } from "@/lib/provider-pack-tabs";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";
import type { RoleRailItem } from "@/lib/role-workspace/types";

/**
 * Provider pack workflow rail — registration → review → publish/ops language.
 */
export function getProviderPackRailState(input: {
  packId: string;
  activeTab: ProviderPackTabId;
  pack: ProviderPackDetailDto | null;
  tabLocks?: Partial<Record<ProviderPackTabId, { locked: boolean; reason?: string }>>;
}): RoleRailItem[] {
  const { packId, activeTab, pack, tabLocks } = input;
  const base = providerPackDetailPath(packId);

  const reviewStatus = pack?.latestReviewStatus ?? null;
  const submitted = reviewStatus === "PENDING" || reviewStatus === "IN_REVIEW";
  const rejected = pack?.status === "DRAFT" && Boolean(pack.latestRejectionReason);
  const published = pack?.status === "PUBLISHED" || pack?.status === "VERIFIED";

  const tabs: Array<{ id: string; label: string; href: string }> = [
    { id: "list", label: "내 지식팩", href: ROUTES.provider },
    { id: "basic", label: "기본정보", href: `${base}?tab=basic` },
    { id: "payload", label: "자료등록", href: `${base}?tab=payload` },
    { id: "knowledge", label: "데이터 구조화", href: `${base}?tab=knowledge` },
    {
      id: "serviceValidation",
      label: "검색데이터 생성·검증",
      href: `${base}?tab=serviceValidation`,
    },
    { id: "distribution", label: "유통정보", href: `${base}?tab=distributionReview` },
    { id: "reviewRequest", label: "검수요청", href: `${base}?tab=distributionReview` },
    { id: "result", label: "검수결과", href: `${base}?tab=distributionReview` },
    { id: "publish", label: "공개 관리", href: `${base}?tab=distributionReview` },
    { id: "insights", label: "성과/사용량", href: ROUTES.accountPlan },
  ];

  const order = [
    "basic",
    "payload",
    "knowledge",
    "serviceValidation",
    "distribution",
    "reviewRequest",
    "result",
    "publish",
    "insights",
  ] as const;

  const activeRailId =
    activeTab === "distributionReview"
      ? submitted || rejected
        ? "result"
        : published
          ? "publish"
          : "distribution"
      : activeTab;

  const activeIdx = order.indexOf(activeRailId as (typeof order)[number]);

  return tabs.map((tab) => {
    if (tab.id === "list") {
      return { id: tab.id, label: tab.label, href: tab.href, status: "idle" as const };
    }

    if (tab.id === "result") {
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status: submitted || rejected ? ("current" as const) : published ? ("completed" as const) : ("idle" as const),
      };
    }

    if (tab.id === "publish" || tab.id === "insights") {
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status: published
          ? tab.id === "publish" && activeRailId === "publish"
            ? ("current" as const)
            : tab.id === "insights" && activeRailId === "insights"
              ? ("current" as const)
              : published
                ? ("next" as const)
                : ("idle" as const)
          : ("idle" as const),
      };
    }

    if (tab.id === "distribution" || tab.id === "reviewRequest") {
      const lock = tabLocks?.distributionReview;
      const isActive =
        activeRailId === tab.id ||
        (activeTab === "distributionReview" &&
          !submitted &&
          !rejected &&
          !published &&
          tab.id === "distribution");
      let status: RoleRailItem["status"] = "idle";
      if (lock?.locked) status = "blocked";
      else if (isActive) status = "current";
      else if (submitted || rejected || published) status = "completed";
      else if (activeIdx >= 0 && order.indexOf(tab.id as (typeof order)[number]) === activeIdx + 1) {
        status = "next";
      } else if (activeIdx >= 0 && order.indexOf(tab.id as (typeof order)[number]) < activeIdx) {
        status = "completed";
      }
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status,
        blockedReason: lock?.locked ? lock.reason : undefined,
      };
    }

    const lock = tabLocks?.[tab.id as ProviderPackTabId];
    const idx = order.indexOf(tab.id as (typeof order)[number]);
    let status: RoleRailItem["status"] = "idle";
    if (lock?.locked) status = "blocked";
    else if (tab.id === activeRailId) status = "current";
    else if (idx >= 0 && activeIdx >= 0 && idx < activeIdx) status = "completed";
    else if (idx === activeIdx + 1) status = "next";

    return {
      id: tab.id,
      label: tab.label,
      href: tab.href,
      status,
      blockedReason: lock?.locked ? lock.reason : undefined,
    };
  });
}
