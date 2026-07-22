import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { ProviderPackTabId } from "@/lib/provider-pack-tabs";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";
import type { RoleRailItem } from "@/lib/role-workspace/types";

/**
 * Provider pack workflow rail — maps editor tabs to a sequential flow.
 * Locks / incomplete reasons come from existing tab lock helpers when provided.
 */
export function getProviderPackRailState(input: {
  packId: string;
  activeTab: ProviderPackTabId;
  pack: ProviderPackDetailDto | null;
  tabLocks?: Partial<Record<ProviderPackTabId, { locked: boolean; reason?: string }>>;
}): RoleRailItem[] {
  const { packId, activeTab, pack, tabLocks } = input;
  const base = providerPackDetailPath(packId);

  const tabs: Array<{ id: ProviderPackTabId | "list" | "result"; label: string; href: string }> = [
    { id: "list", label: "내 지식팩", href: ROUTES.provider },
    { id: "basic", label: "기본정보", href: `${base}?tab=basic` },
    { id: "payload", label: "자료등록", href: `${base}?tab=payload` },
    { id: "knowledge", label: "데이터 구조화", href: `${base}?tab=knowledge` },
    { id: "serviceValidation", label: "검색데이터 생성·검증", href: `${base}?tab=serviceValidation` },
    { id: "distributionReview", label: "유통정보·검수요청", href: `${base}?tab=distributionReview` },
    { id: "result", label: "검수결과", href: `${base}?tab=distributionReview` },
  ];

  const order: ProviderPackTabId[] = [
    "basic",
    "payload",
    "knowledge",
    "serviceValidation",
    "distributionReview",
  ];
  const activeIdx = order.indexOf(activeTab);

  const reviewStatus = pack?.latestReviewStatus ?? null;
  const submitted = reviewStatus === "PENDING" || reviewStatus === "IN_REVIEW";
  const rejected = pack?.status === "DRAFT" && Boolean(pack.latestRejectionReason);

  return tabs.map((tab) => {
    if (tab.id === "list") {
      return { id: tab.id, label: tab.label, href: tab.href, status: "idle" as const };
    }
    if (tab.id === "result") {
      return {
        id: tab.id,
        label: tab.label,
        href: tab.href,
        status: submitted || rejected ? ("current" as const) : ("idle" as const),
      };
    }

    const lock = tabLocks?.[tab.id];
    const idx = order.indexOf(tab.id);
    let status: RoleRailItem["status"] = "idle";
    if (lock?.locked) status = "blocked";
    else if (tab.id === activeTab) status = "current";
    else if (idx >= 0 && idx < activeIdx) status = "completed";
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
